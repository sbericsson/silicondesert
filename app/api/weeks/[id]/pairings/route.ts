import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getApiSession, unauthorizedResponse } from '@/lib/api-auth'
import { writeAuditLog } from '@/lib/audit'
import { getCourseTee, getPlayerSeasonTeeColor } from '@/lib/course-tee'
import { generatePairings, generatePositioningPairings, type PairingResult } from '@/lib/matchmaking'
import { getPlayerHandicapIndexValue, getPlayingHandicap } from '@/lib/playing-handicap'
import { getPositioningBasis, getPositioningRanks } from '@/lib/positioning'
import { getWeeklyTrailingPlayerId } from '@/lib/week-commissioner'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const body = await request.json().catch(() => ({}))
  const requestedPlayerIds = Array.isArray(body?.playerIds)
    ? body.playerIds.filter((playerId: unknown): playerId is string => typeof playerId === 'string')
    : null

  const week = await prisma.week.findUnique({
    where: { id: params.id },
    include: {
      attendance: {
        where: { present: true },
        include: {
          player: {
            include: {
              handicapRecords: {
                where: { countsForHandicap: true },
                orderBy: { date: 'desc' },
                take: 20
              },
              seasonTeeChoices: true
            }
          }
        },
        orderBy: { checkedInAt: 'asc' }
      },
      course: {
        include: {
          tees: true
        }
      },
      matches: {
        select: {
          id: true,
          locked: true,
          player1Id: true,
          player2Id: true,
          player2ScorecardOnly: true
        }
      },
      season: {
        select: {
          type: true,
          archivedAt: true,
          weeks: {
            where: {
              id: { not: params.id }
            },
            select: { id: true, weekNumber: true }
          }
        }
      }
    }
  })

  if (!week) {
    return NextResponse.json({ error: 'Week not found' }, { status: 404 })
  }

  if (week.season.archivedAt) {
    return NextResponse.json({ error: 'Archived seasons cannot be edited' }, { status: 409 })
  }

  if (week.completedAt) {
    return NextResponse.json({ error: 'Closed weeks cannot be edited' }, { status: 409 })
  }

  if (week.locked) {
    return NextResponse.json({ error: 'Week is locked' }, { status: 409 })
  }

  if (!week.courseId) {
    return NextResponse.json({ error: 'Select a course before generating pairings' }, { status: 400 })
  }

  if (!week.course) {
    return NextResponse.json({ error: 'Selected course could not be loaded' }, { status: 409 })
  }

  if (!week.ctpHoleNumber) {
    return NextResponse.json({ error: 'Select a CTP hole before generating pairings' }, { status: 400 })
  }

  const alreadyPairedPlayerIds = new Set(
    week.matches.flatMap((match) => [match.player1Id, match.player2Id])
  )
  const requestedPlayerIdSet = requestedPlayerIds ? new Set(requestedPlayerIds) : null

  const priorWeekIds = week.season.weeks.map((seasonWeek) => seasonWeek.id)
  const priorMatches = priorWeekIds.length
    ? await prisma.match.findMany({
        where: {
          weekId: { in: priorWeekIds }
        },
        select: {
          player1Id: true,
          player2Id: true
        }
      })
    : []

  // Builds a matchmaking Player from a checked-in attendance entry. `order` becomes the
  // checkInOrder (standard) or the standings position (positioning).
  const toPairingPlayer = (
    entry: (typeof week.attendance)[number],
    order: number
  ) => {
    const handicapIndexValue = getPlayerHandicapIndexValue(entry.player)
    const teeColor = getPlayerSeasonTeeColor(
      entry.player.seasonTeeChoices,
      week.seasonId,
      entry.player.gender,
      entry.player.defaultTeeColor
    )
    const tee = getCourseTee(week.course!.tees, teeColor, entry.player.gender, {
      color: 'white',
      gender: 'man',
      nineHolePar: week.course!.nineHolePar,
      nineHoleRating: week.course!.nineHoleRating,
      nineHoleSlope: week.course!.nineHoleSlope
    })

    return {
      id: entry.player.id,
      name: entry.player.name,
      handicapIndex: getPlayingHandicap(week.handicapMode, handicapIndexValue, tee),
      checkInOrder: order,
      earlyBirdRequested: entry.earlyBirdRequested
    }
  }

  const positioningBasis = getPositioningBasis({
    seasonType: week.season.type,
    weekNumber: week.weekNumber,
    seasonWeekNumbers: [...week.season.weeks.map((seasonWeek) => seasonWeek.weekNumber), week.weekNumber]
  })

  let generated: PairingResult
  let matchIdsToDelete: string[] = []

  if (positioningBasis) {
    const availableAttendance = week.attendance.filter(
      (entry) =>
        !alreadyPairedPlayerIds.has(entry.playerId) &&
        (!requestedPlayerIdSet || requestedPlayerIdSet.has(entry.playerId))
    )

    if (availableAttendance.length < 2) {
      return NextResponse.json(
        {
          error:
            week.matches.length > 0
              ? 'Need at least 2 unmatched checked-in players to generate more pairings'
              : 'Need at least 2 checked-in players'
        },
        { status: 400 }
      )
    }

    const ranks = await getPositioningRanks(positioningBasis, { id: week.id, seasonId: week.seasonId })
    const rankedAttendance = [...availableAttendance].sort((a, b) => {
      const rankA = ranks.get(a.playerId) ?? Number.POSITIVE_INFINITY
      const rankB = ranks.get(b.playerId) ?? Number.POSITIVE_INFINITY
      if (rankA !== rankB) {
        return rankA - rankB
      }
      return a.player.name.localeCompare(b.player.name)
    })

    generated = generatePositioningPairings(
      rankedAttendance.map((entry, index) => toPairingPlayer(entry, index + 1)),
      priorMatches
    )
  } else {
    const trailingPlayerId = getWeeklyTrailingPlayerId(week.attendance, week.commissionerPlayerId)
    const trailingPlayerCurrentGroupMatches =
      trailingPlayerId && week.matches.length > 0
        ? week.matches.filter(
            (match) => match.player1Id === trailingPlayerId || match.player2Id === trailingPlayerId
          )
        : []
    const trailingPlayerCurrentGroupPlayerIds = new Set(
      trailingPlayerCurrentGroupMatches.flatMap((match) => [match.player1Id, match.player2Id])
    )
    const shouldRebuildTrailingPlayerGroup =
      Boolean(trailingPlayerId) &&
      trailingPlayerCurrentGroupMatches.length > 0 &&
      week.attendance.some(
        (entry) =>
          !alreadyPairedPlayerIds.has(entry.playerId) &&
          entry.playerId !== trailingPlayerId &&
          (!requestedPlayerIdSet || requestedPlayerIdSet.has(entry.playerId))
      )

    const availableAttendance = week.attendance.filter(
      (entry) =>
        ((!alreadyPairedPlayerIds.has(entry.playerId) &&
          (!requestedPlayerIdSet || requestedPlayerIdSet.has(entry.playerId))) ||
          (shouldRebuildTrailingPlayerGroup &&
            trailingPlayerCurrentGroupPlayerIds.has(entry.playerId)))
    )

    if (availableAttendance.length < 2) {
      return NextResponse.json(
        {
          error:
            week.matches.length > 0
              ? 'Need at least 2 unmatched checked-in players to generate more pairings'
              : 'Need at least 2 checked-in players'
        },
        { status: 400 }
      )
    }

    const pairingInput = availableAttendance.map((entry, index) => toPairingPlayer(entry, index + 1))

    generated = generatePairings(pairingInput, priorMatches, {
      trailingPlayerId
    })

    matchIdsToDelete = shouldRebuildTrailingPlayerGroup
      ? trailingPlayerCurrentGroupMatches.map((match) => match.id)
      : []
  }

  const result = await prisma.$transaction(async (tx) => {
    const createdMatches = []

    if (matchIdsToDelete.length > 0) {
      await tx.match.deleteMany({
        where: {
          id: {
            in: matchIdsToDelete
          }
        }
      })
    }

    for (const group of generated.groups) {
      if (group.type === 'match') {
        createdMatches.push(
          await tx.match.create({
            data: {
              weekId: params.id,
              player1Id: group.match.player1.id,
              player2Id: group.match.player2.id
            }
          })
        )
      } else {
        createdMatches.push(
          await tx.match.create({
            data: {
              weekId: params.id,
              player1Id: group.threesome.matchA.player1.id,
              player2Id: group.threesome.matchA.player2.id
            }
          })
        )

        createdMatches.push(
          await tx.match.create({
            data: {
              weekId: params.id,
              player1Id: group.threesome.matchBRef.player.id,
              player2Id: group.threesome.matchBRef.referencePlayer.id,
              player2ScorecardOnly: true
            }
          })
        )
      }
    }

    await writeAuditLog(tx, {
      weekId: params.id,
      action: 'pairings_generate',
      field: 'matchCount',
      oldValue: String(week.matches.length),
      newValue: String(week.matches.length - matchIdsToDelete.length + createdMatches.length)
    })

    return createdMatches
  }).catch((error: Error) => {
    return error
  })

  if (result instanceof Error) {
    return NextResponse.json({ error: result.message }, { status: 409 })
  }

  return NextResponse.json({
    matchesCreated: result.length,
    pairingResult: generated
  })
}

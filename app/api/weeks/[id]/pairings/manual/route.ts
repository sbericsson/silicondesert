import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getApiSession, unauthorizedResponse } from '@/lib/api-auth'
import { writeAuditLog } from '@/lib/audit'
import { getCourseTee, getPlayerSeasonTeeColor } from '@/lib/course-tee'
import { buildPairingFlags } from '@/lib/matchmaking'
import { getPlayerHandicapIndexValue, getPlayingHandicap } from '@/lib/playing-handicap'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const body = await request.json().catch(() => null)
  const player1Id = typeof body?.player1Id === 'string' ? body.player1Id : null
  const player2Id = typeof body?.player2Id === 'string' ? body.player2Id : null

  if (!player1Id || !player2Id || player1Id === player2Id) {
    return NextResponse.json(
      { error: 'Select two different checked-in players for a manual match' },
      { status: 400 }
    )
  }

  const week = await prisma.week.findUnique({
    where: { id: params.id },
    include: {
      season: {
        select: {
          archivedAt: true,
          weeks: {
            where: {
              id: { not: params.id }
            },
            select: { id: true, date: true }
          }
        }
      },
      attendance: {
        where: {
          present: true,
          playerId: {
            in: [player1Id, player2Id]
          }
        },
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
        }
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
          player2Id: true
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

  if (week.attendance.length !== 2) {
    return NextResponse.json(
      { error: 'Both manual pairing players must be checked in for this week' },
      { status: 400 }
    )
  }

  const pairedPlayerIds = new Set(week.matches.flatMap((match) => [match.player1Id, match.player2Id]))
  if (pairedPlayerIds.has(player1Id) || pairedPlayerIds.has(player2Id)) {
    return NextResponse.json(
      { error: 'One of those players is already assigned to a match. Remove that match first.' },
      { status: 409 }
    )
  }

  const priorWeekIds = week.season.weeks
    .filter((seasonWeek) => seasonWeek.date.getTime() <= week.date.getTime())
    .map((seasonWeek) => seasonWeek.id)
  const priorMatches = priorWeekIds.length
    ? await prisma.match.findMany({
        where: {
          weekId: { in: priorWeekIds }
        },
        select: {
          player1Id: true,
          player2Id: true,
          player2ScorecardOnly: true
        }
      })
    : []

  const playersById = new Map(week.attendance.map((entry) => [entry.playerId, entry.player]))
  const pairingInput = [player1Id, player2Id].map((playerId, index) => {
    const player = playersById.get(playerId)!
    const handicapIndexValue = getPlayerHandicapIndexValue(player)
    const teeColor = getPlayerSeasonTeeColor(
      player.seasonTeeChoices,
      week.seasonId,
      player.gender,
      player.defaultTeeColor
    )
    const tee = week.course
      ? getCourseTee(week.course.tees, teeColor, player.gender, {
          color: 'white',
          gender: 'man',
          nineHolePar: week.course.nineHolePar,
          nineHoleRating: week.course.nineHoleRating,
          nineHoleSlope: week.course.nineHoleSlope
        })
      : null

    return {
      id: player.id,
      name: player.name,
      handicapIndex: getPlayingHandicap(week.handicapMode, handicapIndexValue, tee),
      checkInOrder: index + 1
    }
  })
  const pairingResult = {
    matches: [{ player1: pairingInput[0], player2: pairingInput[1] }],
    threesome: null,
    flags: buildPairingFlags([{ player1: pairingInput[0], player2: pairingInput[1] }], priorMatches.filter((m) => !m.player2ScorecardOnly))
  }

  const createdMatch = await prisma.$transaction(async (tx) => {
    const match = await tx.match.create({
      data: {
        weekId: params.id,
        player1Id,
        player2Id
      }
    })

    await writeAuditLog(tx, {
      weekId: params.id,
      matchId: match.id,
      action: 'pairings_manual_create',
      field: 'players',
      oldValue: null,
      newValue: `${player1Id}:${player2Id}`
    })

    return match
  })

  return NextResponse.json({ matchId: createdMatch.id, pairingResult })
}

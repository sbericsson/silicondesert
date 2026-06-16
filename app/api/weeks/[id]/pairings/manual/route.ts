import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getApiSession, unauthorizedResponse } from '@/lib/api-auth'
import { writeAuditLog } from '@/lib/audit'
import { getCourseDefaultTeeFallback, getCourseTee, getPlayerSeasonTeeColor } from '@/lib/course-tee'
import { HANDICAP_RECORDS_INCLUDE } from '@/lib/handicap-records'
import { buildPairingFlags, REFERENCE_SCORECARD_PLAYER_ID } from '@/lib/matchmaking'
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
  const referencePlayerId = typeof body?.referencePlayerId === 'string' ? body.referencePlayerId : null
  const isReferenceScorecardMatch = player2Id === REFERENCE_SCORECARD_PLAYER_ID

  if (!player1Id || !player2Id || (!isReferenceScorecardMatch && player1Id === player2Id)) {
    return NextResponse.json(
      { error: 'Select two different checked-in players for a manual match' },
      { status: 400 }
    )
  }

  if (isReferenceScorecardMatch && (!referencePlayerId || referencePlayerId === player1Id)) {
    return NextResponse.json(
      { error: 'Select a reference scorecard from the previous match' },
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
            in: isReferenceScorecardMatch ? [player1Id] : [player1Id, player2Id]
          }
        },
        include: {
          player: {
            include: {
              handicapRecords: HANDICAP_RECORDS_INCLUDE,
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
          player2Id: true,
          player2ScorecardOnly: true
        },
        orderBy: { createdAt: 'asc' }
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

  if (week.attendance.length !== (isReferenceScorecardMatch ? 1 : 2)) {
    return NextResponse.json(
      {
        error: isReferenceScorecardMatch
          ? 'Manual pairing player must be checked in for this week'
          : 'Both manual pairing players must be checked in for this week'
      },
      { status: 400 }
    )
  }

  const pairedPlayerIds = new Set(week.matches.flatMap((match) => [match.player1Id, match.player2Id]))
  const livePlayer2Id = isReferenceScorecardMatch ? referencePlayerId : player2Id
  if (pairedPlayerIds.has(player1Id) || (!isReferenceScorecardMatch && pairedPlayerIds.has(livePlayer2Id))) {
    return NextResponse.json(
      { error: 'One of those players is already assigned to a match. Remove that match first.' },
      { status: 409 }
    )
  }

  const referenceSourceMatch = [...week.matches]
    .reverse()
    .find((match) => !match.player2ScorecardOnly)

  if (
    isReferenceScorecardMatch &&
    (!referenceSourceMatch ||
      (referenceSourceMatch.player1Id !== referencePlayerId && referenceSourceMatch.player2Id !== referencePlayerId))
  ) {
    return NextResponse.json(
      { error: 'Reference scorecard must come from the previous live match' },
      { status: 400 }
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

  const manualPlayerIds = isReferenceScorecardMatch ? [player1Id, referencePlayerId!] : [player1Id, player2Id]
  const manualPlayers = isReferenceScorecardMatch
    ? await prisma.player.findMany({
        where: { id: { in: manualPlayerIds } },
        include: {
          handicapRecords: HANDICAP_RECORDS_INCLUDE,
          seasonTeeChoices: true
        }
      })
    : week.attendance.map((entry) => entry.player)
  const playersById = new Map(manualPlayers.map((player) => [player.id, player]))

  if (manualPlayerIds.some((playerId) => !playersById.has(playerId))) {
    return NextResponse.json({ error: 'Selected player could not be loaded' }, { status: 409 })
  }

  const pairingInput = manualPlayerIds.map((playerId, index) => {
    const player = playersById.get(playerId)!
    const handicapIndexValue = getPlayerHandicapIndexValue(player)
    const teeColor = getPlayerSeasonTeeColor(
      player.seasonTeeChoices,
      week.seasonId,
      player.gender,
      player.defaultTeeColor
    )
    const tee = week.course
      ? getCourseTee(week.course.tees, teeColor, player.gender, getCourseDefaultTeeFallback(week.course))
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
        player2Id: livePlayer2Id!,
        player2ScorecardOnly: isReferenceScorecardMatch
      }
    })

    await writeAuditLog(tx, {
      weekId: params.id,
      matchId: match.id,
      action: 'pairings_manual_create',
      field: 'players',
      oldValue: null,
      newValue: isReferenceScorecardMatch
        ? `${player1Id}:reference:${livePlayer2Id}`
        : `${player1Id}:${livePlayer2Id}`
    })

    return match
  })

  return NextResponse.json({ matchId: createdMatch.id, pairingResult })
}

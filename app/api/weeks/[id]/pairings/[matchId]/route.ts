import { NextRequest, NextResponse } from 'next/server'
import type { TeeColor } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getApiSession, unauthorizedResponse } from '@/lib/api-auth'
import { writeAuditLog } from '@/lib/audit'
import { getCourseTee, getPlayerMatchTeeColor } from '@/lib/course-tee'
import { submitMatchScores } from '@/lib/match-score'
import { getPlayerHandicapIndexValue, getPlayingHandicap } from '@/lib/playing-handicap'

function parseTeeOverrideColor(value: unknown) {
  if (value === null || value === '') {
    return null
  }

  if (value === 'blue' || value === 'silver' || value === 'white' || value === 'yellow') {
    return value as TeeColor
  }

  return undefined
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; matchId: string } }
) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const body = await request.json()
  const hasPlayer1Override = 'player1TeeOverrideColor' in body
  const hasPlayer2Override = 'player2TeeOverrideColor' in body

  if (!hasPlayer1Override && !hasPlayer2Override) {
    return NextResponse.json({ error: 'No tee override changes were provided' }, { status: 400 })
  }

  const player1TeeOverrideColor = hasPlayer1Override
    ? parseTeeOverrideColor(body.player1TeeOverrideColor)
    : undefined
  const player2TeeOverrideColor = hasPlayer2Override
    ? parseTeeOverrideColor(body.player2TeeOverrideColor)
    : undefined

  if ((hasPlayer1Override && player1TeeOverrideColor === undefined) || (hasPlayer2Override && player2TeeOverrideColor === undefined)) {
    return NextResponse.json({ error: 'Invalid tee override color' }, { status: 400 })
  }

  const match = await prisma.match.findFirst({
    where: {
      id: params.matchId,
      weekId: params.id
    },
    include: {
      week: {
        include: {
          course: {
            include: {
              tees: true
            }
          },
          season: {
            select: {
              archivedAt: true,
              id: true
            }
          }
        }
      },
      player1: {
        include: {
          handicapRecords: {
            orderBy: { date: 'desc' },
            take: 20
          },
          seasonTeeChoices: true
        }
      },
      player2: {
        include: {
          handicapRecords: {
            orderBy: { date: 'desc' },
            take: 20
          },
          seasonTeeChoices: true
        }
      }
    }
  })

  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  }

  if (match.week.season.archivedAt) {
    return NextResponse.json({ error: 'Archived seasons cannot be edited' }, { status: 409 })
  }

  if (!match.week.course) {
    return NextResponse.json({ error: 'Choose a course before changing match tees' }, { status: 409 })
  }

  const nextPlayer1TeeOverrideColor =
    player1TeeOverrideColor === undefined ? match.player1TeeOverrideColor : player1TeeOverrideColor
  const nextPlayer2TeeOverrideColor =
    player2TeeOverrideColor === undefined ? match.player2TeeOverrideColor : player2TeeOverrideColor

  const player1HandicapIndex = match.player1HandicapIndex ?? getPlayerHandicapIndexValue(match.player1)
  const player2HandicapIndex = match.player2HandicapIndex ?? getPlayerHandicapIndexValue(match.player2)
  const player1TeeColor = getPlayerMatchTeeColor(
    match.player1.seasonTeeChoices,
    match.week.season.id,
    match.player1.gender,
    match.player1.defaultTeeColor,
    nextPlayer1TeeOverrideColor
  )
  const player2TeeColor = getPlayerMatchTeeColor(
    match.player2.seasonTeeChoices,
    match.week.season.id,
    match.player2.gender,
    match.player2.defaultTeeColor,
    nextPlayer2TeeOverrideColor
  )
  const player1Tee = getCourseTee(match.week.course.tees, player1TeeColor, match.player1.gender, {
    color: 'white',
    gender: 'man',
    nineHolePar: match.week.course.nineHolePar,
    nineHoleRating: match.week.course.nineHoleRating,
    nineHoleSlope: match.week.course.nineHoleSlope
  })
  const player2Tee = getCourseTee(match.week.course.tees, player2TeeColor, match.player2.gender, {
    color: 'white',
    gender: 'man',
    nineHolePar: match.week.course.nineHolePar,
    nineHoleRating: match.week.course.nineHoleRating,
    nineHoleSlope: match.week.course.nineHoleSlope
  })
  const shouldSnapshotHandicaps = match.week.locked || match.locked
  const player1PlayingHandicap = getPlayingHandicap(match.week.handicapMode, player1HandicapIndex, player1Tee)
  const player2PlayingHandicap = getPlayingHandicap(match.week.handicapMode, player2HandicapIndex, player2Tee)

  await prisma.$transaction(async (tx) => {
    await tx.match.update({
      where: { id: match.id },
      data: {
        player1TeeOverrideColor: nextPlayer1TeeOverrideColor,
        player2TeeOverrideColor: nextPlayer2TeeOverrideColor,
        player1PlayingHandicap: shouldSnapshotHandicaps ? player1PlayingHandicap : null,
        player2PlayingHandicap: shouldSnapshotHandicaps ? player2PlayingHandicap : null
      }
    })

    await writeAuditLog(tx, {
      weekId: params.id,
      matchId: params.matchId,
      action: 'match_tee_override_edit',
      field: 'tee_override',
      oldValue: JSON.stringify({
        player1TeeOverrideColor: match.player1TeeOverrideColor,
        player2TeeOverrideColor: match.player2TeeOverrideColor
      }),
      newValue: JSON.stringify({
        player1TeeOverrideColor: nextPlayer1TeeOverrideColor,
        player2TeeOverrideColor: nextPlayer2TeeOverrideColor
      })
    })
  })

  const savedScores = await prisma.holeScore.findMany({
    where: {
      weekId: params.id,
      playerId: {
        in: [match.player1Id, match.player2Id]
      }
    },
    orderBy: { holeNumber: 'asc' }
  })

  if (savedScores.length > 0) {
    const player1Scores = savedScores
      .filter((score) => score.playerId === match.player1Id)
      .map((score) => ({
        holeNumber: score.holeNumber,
        grossScore: score.grossScore
      }))
    const player2Scores = savedScores
      .filter((score) => score.playerId === match.player2Id)
      .map((score) => ({
        holeNumber: score.holeNumber,
        grossScore: score.grossScore
      }))

    if (player1Scores.length !== 9 || player2Scores.length !== 9) {
      return NextResponse.json(
        { error: 'Saved scores are incomplete for this match, so the tee change could not be rescored' },
        { status: 409 }
      )
    }

    await submitMatchScores({
      weekId: params.id,
      matchId: params.matchId,
      player1Scores,
      player2Scores
    })
  }

  return NextResponse.json({
    ok: true,
    player1TeeOverrideColor: nextPlayer1TeeOverrideColor,
    player2TeeOverrideColor: nextPlayer2TeeOverrideColor,
    rescored: savedScores.length > 0
  })
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; matchId: string } }
) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const match = await prisma.match.findFirst({
    where: {
      id: params.matchId,
      weekId: params.id
    },
    include: {
      week: {
        include: {
          season: {
            select: {
              archivedAt: true
            }
          }
        }
      },
      holeScores: {
        select: { id: true }
      }
    }
  })

  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  }

  if (match.week.season.archivedAt) {
    return NextResponse.json({ error: 'Archived seasons cannot be edited' }, { status: 409 })
  }

  if (match.week.completedAt) {
    return NextResponse.json({ error: 'Closed weeks cannot be edited' }, { status: 409 })
  }

  if (match.week.locked || match.locked) {
    return NextResponse.json({ error: 'Locked matches cannot be removed' }, { status: 409 })
  }

  if (match.holeScores.length > 0) {
    return NextResponse.json({ error: 'Matches with saved scores cannot be removed' }, { status: 409 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.match.delete({
      where: { id: params.matchId }
    })

    await writeAuditLog(tx, {
      weekId: params.id,
      action: 'pairings_manual_delete',
      field: 'matchId',
      oldValue: params.matchId,
      newValue: null
    })
  })

  return NextResponse.json({ deleted: true })
}

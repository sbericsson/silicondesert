import { NextRequest, NextResponse } from 'next/server'
import type { HandicapMode, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getApiSession, unauthorizedResponse } from '@/lib/api-auth'
import { writeAuditLog } from '@/lib/audit'
import { getCourseTee, getPlayerMatchTeeColor } from '@/lib/course-tee'
import { calculateMatchOutcomeFromAdjustedScores } from '@/lib/match-net-scoring'
import { getPlayerHandicapIndexValue, getPlayingHandicap } from '@/lib/playing-handicap'

function parseOptionalInt(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed)) {
    return null
  }

  return parsed
}

async function getCoursePar3HoleNumbers(courseId: string) {
  const holes = await prisma.courseHole.findMany({
    where: { courseId },
    select: {
      holeNumber: true,
      par: true
    }
  })

  return holes.filter((hole) => hole.par === 3).map((hole) => hole.holeNumber)
}

async function rescoreLockedWeekMatchesForHandicapMode(
  tx: Prisma.TransactionClient,
  weekId: string,
  handicapMode: HandicapMode
) {
  const week = await tx.week.findUnique({
    where: { id: weekId },
    include: {
      course: {
        include: {
          holes: {
            orderBy: { holeNumber: 'asc' }
          },
          tees: true
        }
      },
      season: {
        select: {
          id: true
        }
      },
      matches: {
        include: {
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
          },
          holeScores: {
            select: {
              playerId: true,
              holeNumber: true,
              adjustedScore: true
            }
          }
        }
      }
    }
  })

  if (!week || !week.course) {
    throw new Error('Locked weeks must have a course before handicap basis can change')
  }

  let rescoredMatchCount = 0

  for (const match of week.matches) {
    const player1HandicapIndex = match.player1HandicapIndex ?? getPlayerHandicapIndexValue(match.player1)
    const player2HandicapIndex = match.player2HandicapIndex ?? getPlayerHandicapIndexValue(match.player2)
    const player1TeeColor = getPlayerMatchTeeColor(
      match.player1.seasonTeeChoices,
      week.season.id,
      match.player1.gender,
      match.player1.defaultTeeColor,
      match.player1TeeOverrideColor
    )
    const player2TeeColor = getPlayerMatchTeeColor(
      match.player2.seasonTeeChoices,
      week.season.id,
      match.player2.gender,
      match.player2.defaultTeeColor,
      match.player2TeeOverrideColor
    )
    const player1Tee = getCourseTee(week.course.tees, player1TeeColor, match.player1.gender, {
      color: 'white',
      gender: 'man',
      nineHolePar: week.course.nineHolePar,
      nineHoleRating: week.course.nineHoleRating,
      nineHoleSlope: week.course.nineHoleSlope
    })
    const player2Tee = getCourseTee(week.course.tees, player2TeeColor, match.player2.gender, {
      color: 'white',
      gender: 'man',
      nineHolePar: week.course.nineHolePar,
      nineHoleRating: week.course.nineHoleRating,
      nineHoleSlope: week.course.nineHoleSlope
    })
    const player1PlayingHandicap = getPlayingHandicap(handicapMode, player1HandicapIndex, player1Tee)
    const player2PlayingHandicap = getPlayingHandicap(handicapMode, player2HandicapIndex, player2Tee)
    const adjustedScoreByKey = new Map(
      match.holeScores.map((score) => [`${score.playerId}:${score.holeNumber}`, score.adjustedScore])
    )
    const hasSavedScores = match.holeScores.length > 0
    const outcome = hasSavedScores
      ? calculateMatchOutcomeFromAdjustedScores({
          player1Id: match.player1Id,
          player2Id: match.player2Id,
          player1PlayingHandicap,
          player2PlayingHandicap,
          player2ScorecardOnly: match.player2ScorecardOnly,
          holes: week.course.holes.map((hole) => ({
            holeNumber: hole.holeNumber,
            strokeIndex: hole.strokeIndex,
            player1AdjustedScore: adjustedScoreByKey.get(`${match.player1Id}:${hole.holeNumber}`) ?? null,
            player2AdjustedScore: adjustedScoreByKey.get(`${match.player2Id}:${hole.holeNumber}`) ?? null
          }))
        })
      : null

    await tx.match.update({
      where: { id: match.id },
      data: {
        player1PlayingHandicap,
        player2PlayingHandicap,
        strokeWinnerId: outcome?.strokeWinnerId ?? null,
        matchPlayLeadBy: outcome?.matchPlayLeadBy ?? null,
        matchPlayHolesRemaining: outcome?.matchPlayHolesRemaining ?? null,
        matchPlayWinnerId: outcome?.matchPlayWinnerId ?? null
      }
    })

    if (hasSavedScores) {
      rescoredMatchCount += 1
    }
  }

  return rescoredMatchCount
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const body = await request.json()
  const updates: {
    courseId?: string | null
    handicapMode?: HandicapMode
    ctpHoleNumber?: number | null
    longestPuttHoleNumber?: number | null
    ctpWinnerId?: string | null
    longestPuttWinnerId?: string | null
  } = {}

  if ('courseId' in body) {
    updates.courseId = body.courseId || null
  }

  if ('handicapMode' in body) {
    if (body.handicapMode !== 'index' && body.handicapMode !== 'course') {
      return NextResponse.json(
        { error: 'Handicap basis must be index or course handicap' },
        { status: 400 }
      )
    }

    updates.handicapMode = body.handicapMode
  }

  if ('ctpHoleNumber' in body) {
    updates.ctpHoleNumber = parseOptionalInt(body.ctpHoleNumber)
  }

  if ('longestPuttHoleNumber' in body) {
    updates.longestPuttHoleNumber = parseOptionalInt(body.longestPuttHoleNumber)
  }

  if ('ctpWinnerId' in body) {
    updates.ctpWinnerId = typeof body.ctpWinnerId === 'string' ? body.ctpWinnerId : null
  }

  if ('longestPuttWinnerId' in body) {
    updates.longestPuttWinnerId = typeof body.longestPuttWinnerId === 'string' ? body.longestPuttWinnerId : null
  }

  const existingWeek = await prisma.week.findUnique({
    where: { id: params.id },
    include: {
      attendance: {
        select: {
          playerId: true,
          present: true,
          ctpPoolPaid: true,
          longestPuttPoolPaid: true
        }
      },
      course: {
        include: {
          holes: true
        }
      },
      season: {
        select: {
          archivedAt: true
        }
      }
    }
  })

  if (!existingWeek) {
    return NextResponse.json({ error: 'Week not found' }, { status: 404 })
  }

  if (existingWeek.season.archivedAt) {
    return NextResponse.json({ error: 'Archived seasons cannot be edited' }, { status: 409 })
  }

  if (existingWeek.completedAt) {
    return NextResponse.json({ error: 'Closed weeks cannot be edited' }, { status: 409 })
  }

  // CTP/LP winner fields can be updated after lock (post-round data).
  // Course and prize-hole configuration stay fixed after lock, but handicap basis can
  // still change so saved matches can be rescored without reopening the week.
  const lockedFields = ['courseId', 'ctpHoleNumber', 'longestPuttHoleNumber'] as const
  const hasLockedFieldUpdate = lockedFields.some((field) => field in updates)
  if (existingWeek.locked && hasLockedFieldUpdate) {
    return NextResponse.json({ error: 'Locked weeks cannot be edited' }, { status: 409 })
  }

  const effectiveCourseId = updates.courseId !== undefined ? updates.courseId : existingWeek.courseId
  const requestedCtpHoleNumber =
    updates.ctpHoleNumber !== undefined ? updates.ctpHoleNumber : existingWeek.ctpHoleNumber

  if (updates.ctpHoleNumber !== undefined && updates.ctpHoleNumber !== null && !effectiveCourseId) {
    return NextResponse.json(
      { error: 'Select a course before choosing the CTP hole' },
      { status: 400 }
    )
  }

  let validPar3HoleNumbers: number[] = []
  if (effectiveCourseId) {
    validPar3HoleNumbers = await getCoursePar3HoleNumbers(effectiveCourseId)
  }

  if (
    requestedCtpHoleNumber !== null &&
    requestedCtpHoleNumber !== undefined &&
    effectiveCourseId &&
    !validPar3HoleNumbers.includes(requestedCtpHoleNumber)
  ) {
    if (updates.ctpHoleNumber !== undefined) {
      return NextResponse.json(
        { error: 'Closest to pin must be set to a par 3 hole on the selected course' },
        { status: 400 }
      )
    }

    // Only auto-reset CTP when the course itself is being changed, not when
    // updating other fields (e.g. ctpWinnerId) while the hole is stale.
    if ('courseId' in updates) {
      updates.ctpHoleNumber = null
      updates.ctpWinnerId = null
    } else {
      return NextResponse.json(
        {
          error: `CTP hole ${requestedCtpHoleNumber} is not a par 3 on the selected course. Clear the CTP hole before saving a winner.`
        },
        { status: 409 }
      )
    }
  }

  if (updates.ctpWinnerId) {
    const eligibleCtpWinner = existingWeek.attendance.find(
      (entry) =>
        entry.playerId === updates.ctpWinnerId && entry.present && entry.ctpPoolPaid
    )

    if (!eligibleCtpWinner) {
      return NextResponse.json(
        { error: 'CTP winner must be checked in and paid into the CTP pool for this week' },
        { status: 400 }
      )
    }
  }

  if (updates.longestPuttWinnerId) {
    const eligibleLongestPuttWinner = existingWeek.attendance.find(
      (entry) =>
        entry.playerId === updates.longestPuttWinnerId &&
        entry.present &&
        entry.longestPuttPoolPaid
    )

    if (!eligibleLongestPuttWinner) {
      return NextResponse.json(
        { error: 'LP winner must be checked in and paid into the LPM pool for this week' },
        { status: 400 }
      )
    }
  }

  const updatedWeek = await prisma.$transaction(async (tx) => {
    const week = await tx.week.update({
      where: { id: params.id },
      data: updates
    })
    const rescoredMatchCount =
      existingWeek.locked &&
      updates.handicapMode !== undefined &&
      updates.handicapMode !== existingWeek.handicapMode
        ? await rescoreLockedWeekMatchesForHandicapMode(tx, params.id, updates.handicapMode)
        : 0

    for (const [field, newValue] of Object.entries(updates)) {
      const oldValue = existingWeek[field as keyof typeof existingWeek]
      if (oldValue !== newValue) {
        await writeAuditLog(tx, {
          weekId: params.id,
          action: 'week_update',
          field,
          oldValue: oldValue === null || oldValue === undefined ? null : String(oldValue),
          newValue: newValue === null || newValue === undefined ? null : String(newValue)
        })
      }
    }

    if (rescoredMatchCount > 0) {
      await writeAuditLog(tx, {
        weekId: params.id,
        action: 'week_rescore',
        field: 'handicapMode',
        oldValue: existingWeek.handicapMode,
        newValue: JSON.stringify({
          handicapMode: updates.handicapMode,
          rescoredMatchCount
        })
      })
    }

    return {
      ...week,
      rescoredMatchCount
    }
  })

  return NextResponse.json(updatedWeek)
}

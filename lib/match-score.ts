import { prisma } from '@/lib/db'
import {
  applyESC,
  courseHandicap,
  exactHandicapIndex,
  roundToWholeHandicap,
  scoreDifferential,
  strokesReceivedOnHole
} from '@/lib/handicap'
import { getCourseTee, getPlayerMatchTeeColor } from '@/lib/course-tee'
import { getMatchStrokeAllocation } from '@/lib/match-net-scoring'
import { getHandicapModeLabel, getPlayingHandicap } from '@/lib/playing-handicap'
import { calculateMatchPlayResult, calculateMatchPoints } from '@/lib/scoring'
import { recomputeUsedInIndex } from '@/lib/handicap-records'
import { writeAuditLog } from '@/lib/audit'

function getEffectiveHandicapIndex(player: {
  seedHandicap: number | null
  handicapRecords: Array<{ courseDifferential: number; date?: Date }>
}, snapshot: number | null) {
  if (snapshot !== null) {
    return snapshot
  }

  const records = [...player.handicapRecords].sort((left, right) => {
    if (!left.date || !right.date) {
      return 0
    }

    return left.date.getTime() - right.date.getTime()
  })

  return exactHandicapIndex(records.map((record) => record.courseDifferential)) ?? player.seedHandicap ?? 0
}

function getFirstRoundHandicapIndex(
  player: {
    handicapRecords: Array<{ date: Date; weekId: string | null }>
  },
  currentWeekId: string,
  currentWeekDate: Date,
  grossScore: number,
  tee: {
    nineHoleRating: number
    nineHoleSlope: number
  }
) {
  const hasPriorRound = player.handicapRecords.some(
    (record) => record.weekId !== currentWeekId && record.date.getTime() < currentWeekDate.getTime()
  )
  if (hasPriorRound) {
    return null
  }

  return exactHandicapIndex([
    scoreDifferential(grossScore, tee.nineHoleRating, tee.nineHoleSlope)
  ])
}

function sum(values: Array<number | null>) {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0)
}

function normalizeScores(scores: Array<{ holeNumber: number; grossScore: number }>) {
  const uniqueHoleNumbers = new Set(scores.map((score) => score.holeNumber))
  const validHoleNumbers = new Set(Array.from({ length: 9 }, (_, index) => index + 1))

  if (scores.length !== 9 || uniqueHoleNumbers.size !== 9) {
    throw new Error('Exactly 9 unique hole scores are required for each player')
  }

  for (const score of scores) {
    if (!validHoleNumbers.has(score.holeNumber) || !Number.isInteger(score.grossScore) || score.grossScore < 1) {
      throw new Error('Invalid hole score payload')
    }
  }

  return [...scores].sort((a, b) => a.holeNumber - b.holeNumber)
}

async function getNextPendingMatchId(weekId: string, currentMatch: {
  id: string
  createdAt: Date
}) {
  const nextLaterMatch = await prisma.match.findFirst({
    where: {
      weekId,
      locked: true,
      matchPlayLeadBy: null,
      createdAt: {
        gt: currentMatch.createdAt
      }
    },
    orderBy: [{ createdAt: 'asc' }]
  })

  if (nextLaterMatch) {
    return nextLaterMatch.id
  }

  const nextFromTop = await prisma.match.findFirst({
    where: {
      weekId,
      locked: true,
      matchPlayLeadBy: null,
      id: {
        not: currentMatch.id
      }
    },
    orderBy: [{ createdAt: 'asc' }]
  })

  return nextFromTop?.id ?? null
}

export async function getMatchScorePageData(weekId: string, matchId: string) {
  if (!process.env.DATABASE_URL) {
    return null
  }

  const match = await prisma.match.findFirst({
    where: {
      id: matchId,
      weekId
    },
    include: {
      week: {
        include: {
          course: {
            include: {
              tees: true,
              holes: {
                orderBy: { holeNumber: 'asc' }
              }
            }
          },
          attendance: true,
          season: true
        }
      },
      player1: {
        include: {
          handicapRecords: {
            where: { countsForHandicap: true },
            orderBy: { date: 'desc' },
            take: 20
          },
          seasonTeeChoices: true
        }
      },
      player2: {
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
  })

  if (!match || !match.week.course) {
    return null
  }

  const holeScores = await prisma.holeScore.findMany({
    where: {
      weekId,
      playerId: {
        in: [match.player1Id, match.player2Id]
      }
    },
    orderBy: { holeNumber: 'asc' }
  })

  const attendanceMap = new Map(match.week.attendance.map((entry) => [entry.playerId, entry.present]))
  const player1BaseIndex = getEffectiveHandicapIndex(match.player1, match.player1HandicapIndex)
  const player2BaseIndex = getEffectiveHandicapIndex(match.player2, match.player2HandicapIndex)
  const player1TeeColor = getPlayerMatchTeeColor(
    match.player1.seasonTeeChoices,
    match.week.season.id,
    match.player1.gender,
    match.player1.defaultTeeColor,
    match.player1TeeOverrideColor
  )
  const player2TeeColor = getPlayerMatchTeeColor(
    match.player2.seasonTeeChoices,
    match.week.season.id,
    match.player2.gender,
    match.player2.defaultTeeColor,
    match.player2TeeOverrideColor
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
  const savedPlayer1Scores = holeScores.filter((score) => score.playerId === match.player1Id)
  const savedPlayer2Scores = holeScores.filter((score) => score.playerId === match.player2Id)
  const savedPlayer1Gross =
    savedPlayer1Scores.length === 9 ? sum(savedPlayer1Scores.map((score) => score.grossScore)) : null
  const savedPlayer2Gross =
    savedPlayer2Scores.length === 9 ? sum(savedPlayer2Scores.map((score) => score.grossScore)) : null
  const firstRoundPlayer1Index =
    savedPlayer1Gross === null
      ? null
      : getFirstRoundHandicapIndex(match.player1, weekId, match.week.date, savedPlayer1Gross, player1Tee)
  const firstRoundPlayer2Index =
    savedPlayer2Gross === null
      ? null
      : getFirstRoundHandicapIndex(match.player2, weekId, match.week.date, savedPlayer2Gross, player2Tee)
  const player1Index = firstRoundPlayer1Index ?? player1BaseIndex
  const player2Index = firstRoundPlayer2Index ?? player2BaseIndex
  const player1CourseHandicap = courseHandicap(
    player1Index,
    player1Tee.nineHoleSlope,
    player1Tee.nineHoleRating,
    player1Tee.nineHolePar
  )
  const player2CourseHandicap = courseHandicap(
    player2Index,
    player2Tee.nineHoleSlope,
    player2Tee.nineHoleRating,
    player2Tee.nineHolePar
  )
  const player1EscHandicap = roundToWholeHandicap(player1Index)
  const player2EscHandicap = roundToWholeHandicap(player2Index)
  const player1PlayingHandicap =
    firstRoundPlayer1Index === null
      ? match.player1PlayingHandicap ??
        getPlayingHandicap(match.week.handicapMode, player1Index, player1Tee)
      : getPlayingHandicap(match.week.handicapMode, player1Index, player1Tee)
  const player2PlayingHandicap =
    firstRoundPlayer2Index === null
      ? match.player2PlayingHandicap ??
        getPlayingHandicap(match.week.handicapMode, player2Index, player2Tee)
      : getPlayingHandicap(match.week.handicapMode, player2Index, player2Tee)

  const scoreMap = new Map(holeScores.map((score) => [`${score.playerId}:${score.holeNumber}`, score]))

  const rows = match.week.course.holes.map((hole) => {
    const p1 = scoreMap.get(`${match.player1Id}:${hole.holeNumber}`)
    const p2 = scoreMap.get(`${match.player2Id}:${hole.holeNumber}`)
    const { player1MatchStrokes, player2MatchStrokes } = getMatchStrokeAllocation(
      player1PlayingHandicap,
      player2PlayingHandicap,
      hole.strokeIndex
    )
    const player1AdjustedStrokesReceived = strokesReceivedOnHole(player1EscHandicap, hole.strokeIndex)
    const player2AdjustedStrokesReceived = strokesReceivedOnHole(player2EscHandicap, hole.strokeIndex)

    return {
      holeNumber: hole.holeNumber,
      par: hole.par,
      strokeIndex: hole.strokeIndex,
      player1StrokesReceived: player1MatchStrokes,
      player1AdjustedStrokesReceived,
      player2StrokesReceived: player2MatchStrokes,
      player2AdjustedStrokesReceived,
      player1Gross: p1?.grossScore ?? null,
      player1Adj: p1 ? applyESC(p1.grossScore, hole.par, player1AdjustedStrokesReceived) : null,
      player1Net: p1 ? p1.grossScore - player1MatchStrokes : null,
      player2Gross: p2?.grossScore ?? null,
      player2Adj: p2 ? applyESC(p2.grossScore, hole.par, player2AdjustedStrokesReceived) : null,
      player2Net: p2 ? p2.grossScore - player2MatchStrokes : null
    }
  })

  const player1NetTotal = rows.every((row) => row.player1Net !== null) ? sum(rows.map((row) => row.player1Net)) : null
  const player2NetTotal = rows.every((row) => row.player2Net !== null) ? sum(rows.map((row) => row.player2Net)) : null
  const nextPendingMatchId = await getNextPendingMatchId(weekId, {
    id: match.id,
    createdAt: match.createdAt
  })

  return {
    match: {
      id: match.id,
      weekId,
      weekLabel: `Week ${match.week.weekNumber} - ${match.week.season.name}`,
      courseName: match.week.course.name,
      handicapMode: match.week.handicapMode,
      handicapModeLabel: getHandicapModeLabel(match.week.handicapMode),
      ctpHoleNumber: match.week.ctpHoleNumber,
      locked: match.locked,
      seasonArchived: Boolean(match.week.season.archivedAt),
      weekCompleted: Boolean(match.week.completedAt),
      player2ScorecardOnly: match.player2ScorecardOnly,
      matchPlayLeadBy: match.matchPlayLeadBy,
      matchPlayHolesRemaining: match.matchPlayHolesRemaining,
      matchPlayWinnerId: match.matchPlayWinnerId,
      player1: {
        id: match.player1.id,
        name: match.player1.name,
        teeColor: player1TeeColor,
        handicapIndex: player1Index,
        playingHandicap: player1PlayingHandicap,
        courseHandicap: player1CourseHandicap,
        present: attendanceMap.get(match.player1Id) ?? false
      },
      player2: {
        id: match.player2.id,
        name: match.player2.name,
        teeColor: player2TeeColor,
        handicapIndex: player2Index,
        playingHandicap: player2PlayingHandicap,
        courseHandicap: player2CourseHandicap,
        present: attendanceMap.get(match.player2Id) ?? false
      },
      player1NetTotal,
      player2NetTotal,
      nextPendingMatchId
    },
    rows
  }
}

export async function getMatchScorePageDataByMatchId(matchId: string) {
  if (!process.env.DATABASE_URL) {
    return null
  }

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { weekId: true }
  })

  if (!match) {
    return null
  }

  return getMatchScorePageData(match.weekId, matchId)
}

export async function submitMatchScores(input: {
  weekId: string
  matchId: string
  player1Scores: Array<{ holeNumber: number; grossScore: number }>
  player2Scores: Array<{ holeNumber: number; grossScore: number }>
}) {
  const player1Scores = normalizeScores(input.player1Scores)
  const player2Scores = normalizeScores(input.player2Scores)

  const match = await prisma.match.findFirst({
    where: {
      id: input.matchId,
      weekId: input.weekId
    },
    include: {
      week: {
        include: {
          course: {
            include: {
              tees: true,
              holes: {
                orderBy: { holeNumber: 'asc' }
              }
            }
          },
          attendance: true,
          season: true
        }
      },
      player1: {
        include: {
          handicapRecords: {
            where: { countsForHandicap: true },
            orderBy: { date: 'desc' }
          },
          seasonTeeChoices: true
        }
      },
      player2: {
        include: {
          handicapRecords: {
            where: { countsForHandicap: true },
            orderBy: { date: 'desc' }
          },
          seasonTeeChoices: true
        }
      }
    }
  })

  if (!match || !match.week.course) {
    throw new Error('Match not found')
  }

  if (match.week.season.archivedAt) {
    throw new Error('Archived seasons cannot be edited')
  }

  const course = match.week.course

  if (!match.locked || !match.week.locked) {
    throw new Error('Match must be locked before scores can be entered')
  }

  const attendanceMap = new Map(match.week.attendance.map((entry) => [entry.playerId, entry.present]))
  if (!attendanceMap.get(match.player1Id) || !attendanceMap.get(match.player2Id)) {
    throw new Error('Both players must be checked in before scores can be entered')
  }

  const player1Index = getEffectiveHandicapIndex(match.player1, match.player1HandicapIndex)
  const player2Index = getEffectiveHandicapIndex(match.player2, match.player2HandicapIndex)
  const player1TeeColor = getPlayerMatchTeeColor(
    match.player1.seasonTeeChoices,
    match.week.season.id,
    match.player1.gender,
    match.player1.defaultTeeColor,
    match.player1TeeOverrideColor
  )
  const player2TeeColor = getPlayerMatchTeeColor(
    match.player2.seasonTeeChoices,
    match.week.season.id,
    match.player2.gender,
    match.player2.defaultTeeColor,
    match.player2TeeOverrideColor
  )
  const player1Tee = getCourseTee(course.tees, player1TeeColor, match.player1.gender, {
    color: 'white',
    gender: 'man',
    nineHolePar: course.nineHolePar,
    nineHoleRating: course.nineHoleRating,
    nineHoleSlope: course.nineHoleSlope
  })
  const player2Tee = getCourseTee(course.tees, player2TeeColor, match.player2.gender, {
    color: 'white',
    gender: 'man',
    nineHolePar: course.nineHolePar,
    nineHoleRating: course.nineHoleRating,
    nineHoleSlope: course.nineHoleSlope
  })
  const player1Gross = sum(player1Scores.map((score) => score.grossScore))
  const player2Gross = sum(player2Scores.map((score) => score.grossScore))
  const firstRoundPlayer1Index = getFirstRoundHandicapIndex(
    match.player1,
    input.weekId,
    match.week.date,
    player1Gross,
    player1Tee
  )
  const firstRoundPlayer2Index = getFirstRoundHandicapIndex(
    match.player2,
    input.weekId,
    match.week.date,
    player2Gross,
    player2Tee
  )
  const scoringPlayer1Index = firstRoundPlayer1Index ?? player1Index
  const scoringPlayer2Index = firstRoundPlayer2Index ?? player2Index
  const player1EscHandicap = roundToWholeHandicap(scoringPlayer1Index)
  const player2EscHandicap = roundToWholeHandicap(scoringPlayer2Index)
  const player1PlayingHandicap =
    firstRoundPlayer1Index === null
      ? match.player1PlayingHandicap ??
        getPlayingHandicap(match.week.handicapMode, scoringPlayer1Index, player1Tee)
      : getPlayingHandicap(match.week.handicapMode, scoringPlayer1Index, player1Tee)
  const player2PlayingHandicap =
    firstRoundPlayer2Index === null
      ? match.player2PlayingHandicap ??
        getPlayingHandicap(match.week.handicapMode, scoringPlayer2Index, player2Tee)
      : getPlayingHandicap(match.week.handicapMode, scoringPlayer2Index, player2Tee)

  const holeByNumber = new Map(course.holes.map((hole) => [hole.holeNumber, hole]))

  const processedP1 = player1Scores.map((score) => {
    const hole = holeByNumber.get(score.holeNumber)
    if (!hole) {
      throw new Error('Invalid hole')
    }

    const { player1MatchStrokes } = getMatchStrokeAllocation(
      player1PlayingHandicap,
      player2PlayingHandicap,
      hole.strokeIndex
    )
    const handicapStrokes = strokesReceivedOnHole(player1EscHandicap, hole.strokeIndex)
    const adjustedScore = applyESC(score.grossScore, hole.par, handicapStrokes)

    return {
      holeNumber: score.holeNumber,
      grossScore: score.grossScore,
      adjustedScore,
      netScore: score.grossScore - player1MatchStrokes
    }
  })

  const processedP2 = player2Scores.map((score) => {
    const hole = holeByNumber.get(score.holeNumber)
    if (!hole) {
      throw new Error('Invalid hole')
    }

    const { player2MatchStrokes } = getMatchStrokeAllocation(
      player1PlayingHandicap,
      player2PlayingHandicap,
      hole.strokeIndex
    )
    const handicapStrokes = strokesReceivedOnHole(player2EscHandicap, hole.strokeIndex)
    const adjustedScore = applyESC(score.grossScore, hole.par, handicapStrokes)

    return {
      holeNumber: score.holeNumber,
      grossScore: score.grossScore,
      adjustedScore,
      netScore: score.grossScore - player2MatchStrokes
    }
  })

  const player1NetTotal = sum(processedP1.map((score) => score.netScore))
  const player2NetTotal = sum(processedP2.map((score) => score.netScore))
  const player1AdjustedGross = sum(processedP1.map((score) => score.adjustedScore))
  const player2AdjustedGross = sum(processedP2.map((score) => score.adjustedScore))
  const matchPlayResult = calculateMatchPlayResult(
    processedP1.map((score, index) => ({
      player1Net: score.netScore,
      player2Net: processedP2[index]?.netScore ?? null
    })),
    match.player1Id,
    match.player2Id
  )

  const strokeWinnerId = player1NetTotal < player2NetTotal
    ? match.player1Id
    : player2NetTotal < player1NetTotal
      ? match.player2Id
      : null

  await prisma.$transaction(async (tx) => {
    for (const score of processedP1) {
      const existing = await tx.holeScore.findUnique({
        where: {
          weekId_playerId_holeNumber: {
            weekId: input.weekId,
            playerId: match.player1Id,
            holeNumber: score.holeNumber
          }
        }
      })

      await tx.holeScore.upsert({
        where: {
          weekId_playerId_holeNumber: {
            weekId: input.weekId,
            playerId: match.player1Id,
            holeNumber: score.holeNumber
          }
        },
        update: {
          grossScore: score.grossScore,
          adjustedScore: score.adjustedScore,
          matchId: existing?.matchId ?? input.matchId
        },
        create: {
          weekId: input.weekId,
          playerId: match.player1Id,
          holeNumber: score.holeNumber,
          grossScore: score.grossScore,
          adjustedScore: score.adjustedScore,
          matchId: input.matchId
        }
      })
    }

    for (const score of processedP2) {
      const existing = await tx.holeScore.findUnique({
        where: {
          weekId_playerId_holeNumber: {
            weekId: input.weekId,
            playerId: match.player2Id,
            holeNumber: score.holeNumber
          }
        }
      })

      await tx.holeScore.upsert({
        where: {
          weekId_playerId_holeNumber: {
            weekId: input.weekId,
            playerId: match.player2Id,
            holeNumber: score.holeNumber
          }
        },
        update: {
          grossScore: score.grossScore,
          adjustedScore: score.adjustedScore,
          matchId: existing?.matchId ?? input.matchId
        },
        create: {
          weekId: input.weekId,
          playerId: match.player2Id,
          holeNumber: score.holeNumber,
          grossScore: score.grossScore,
          adjustedScore: score.adjustedScore,
          matchId: input.matchId
        }
      })
    }

    await tx.match.update({
      where: { id: input.matchId },
      data: {
        ...(firstRoundPlayer1Index === null
          ? {}
          : {
              player1HandicapIndex: scoringPlayer1Index,
              player1PlayingHandicap
            }),
        ...(firstRoundPlayer2Index === null
          ? {}
          : {
              player2HandicapIndex: scoringPlayer2Index,
              player2PlayingHandicap
            }),
        strokeWinnerId,
        matchPlayLeadBy: matchPlayResult?.matchPlayLeadBy ?? null,
        matchPlayHolesRemaining: matchPlayResult?.matchPlayHolesRemaining ?? null,
        matchPlayWinnerId: matchPlayResult?.matchPlayWinnerId ?? null
      }
    })

    await writeAuditLog(tx, {
      weekId: input.weekId,
      matchId: input.matchId,
      action: 'score_edit',
      field: 'match_scores',
      oldValue: null,
      newValue: JSON.stringify({
        player1Gross,
        player2Gross,
        player1AdjustedGross,
        player2AdjustedGross,
        matchPlayLeadBy: matchPlayResult?.matchPlayLeadBy ?? null,
        matchPlayHolesRemaining: matchPlayResult?.matchPlayHolesRemaining ?? null,
        matchPlayWinnerId: matchPlayResult?.matchPlayWinnerId ?? null
      })
    })

    await tx.handicapRecord.upsert({
      where: {
        playerId_weekId: {
          playerId: match.player1Id,
          weekId: input.weekId
        }
      },
      update: {
        date: match.week.date,
        grossScore: player1Gross,
        adjustedGrossScore: player1AdjustedGross,
        courseRating: player1Tee.nineHoleRating,
        slopeRating: player1Tee.nineHoleSlope,
        coursePar: player1Tee.nineHolePar,
        courseDifferential: scoreDifferential(
          player1AdjustedGross,
          player1Tee.nineHoleRating,
          player1Tee.nineHoleSlope
        )
      },
      create: {
        playerId: match.player1Id,
        weekId: input.weekId,
        date: match.week.date,
        grossScore: player1Gross,
        adjustedGrossScore: player1AdjustedGross,
        courseRating: player1Tee.nineHoleRating,
        slopeRating: player1Tee.nineHoleSlope,
        coursePar: player1Tee.nineHolePar,
        courseDifferential: scoreDifferential(
          player1AdjustedGross,
          player1Tee.nineHoleRating,
          player1Tee.nineHoleSlope
        )
      }
    })

    await tx.handicapRecord.upsert({
      where: {
        playerId_weekId: {
          playerId: match.player2Id,
          weekId: input.weekId
        }
      },
      update: {
        date: match.week.date,
        grossScore: player2Gross,
        adjustedGrossScore: player2AdjustedGross,
        courseRating: player2Tee.nineHoleRating,
        slopeRating: player2Tee.nineHoleSlope,
        coursePar: player2Tee.nineHolePar,
        courseDifferential: scoreDifferential(
          player2AdjustedGross,
          player2Tee.nineHoleRating,
          player2Tee.nineHoleSlope
        )
      },
      create: {
        playerId: match.player2Id,
        weekId: input.weekId,
        date: match.week.date,
        grossScore: player2Gross,
        adjustedGrossScore: player2AdjustedGross,
        courseRating: player2Tee.nineHoleRating,
        slopeRating: player2Tee.nineHoleSlope,
        coursePar: player2Tee.nineHolePar,
        courseDifferential: scoreDifferential(
          player2AdjustedGross,
          player2Tee.nineHoleRating,
          player2Tee.nineHoleSlope
        )
      }
    })

    await Promise.all([
      recomputeUsedInIndex(tx, match.player1Id),
      recomputeUsedInIndex(tx, match.player2Id)
    ])
  })

  const pointsSummary = calculateMatchPoints(
    {
      player1Id: match.player1Id,
      player2Id: match.player2Id,
      player1NetScore: player1NetTotal,
      player2NetScore: player2NetTotal,
      matchPlayWinnerId: matchPlayResult?.matchPlayWinnerId ?? null,
      matchPlayLeadBy: matchPlayResult?.matchPlayLeadBy ?? null,
      player2ScorecardOnly: match.player2ScorecardOnly
    },
    attendanceMap.get(match.player1Id) ?? false,
    attendanceMap.get(match.player2Id) ?? false
  )

  const nextPendingMatchId = await getNextPendingMatchId(input.weekId, {
    id: match.id,
    createdAt: match.createdAt
  })

  return {
    match: {
      id: match.id,
      strokeWinnerId,
      matchPlayLeadBy: matchPlayResult?.matchPlayLeadBy ?? null,
      matchPlayHolesRemaining: matchPlayResult?.matchPlayHolesRemaining ?? null,
      matchPlayWinnerId: matchPlayResult?.matchPlayWinnerId ?? null
    },
    pointsSummary,
    nextPendingMatchId
  }
}

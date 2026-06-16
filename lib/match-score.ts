import type { Gender, HandicapMode, TeeColor } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  applyESC,
  courseHandicap,
  exactHandicapIndex,
  roundToWholeHandicap,
  scoreDifferential,
  strokesReceivedOnHole
} from '@/lib/handicap'
import { getCourseDefaultTeeFallback, getCourseTee, getPlayerMatchTeeColor } from '@/lib/course-tee'
import { getMatchStrokeAllocation } from '@/lib/match-net-scoring'
import { getHandicapModeLabel, getPlayingHandicap } from '@/lib/playing-handicap'
import { calculateMatchPlayResult, calculateMatchPoints } from '@/lib/scoring'
import { HANDICAP_RECORDS_INCLUDE, recomputeUsedInIndex } from '@/lib/handicap-records'
import { writeAuditLog } from '@/lib/audit'

type CourseTee = {
  color: TeeColor
  gender: Gender
  nineHolePar: number
  nineHoleRating: number
  nineHoleSlope: number
}

type CourseHole = {
  holeNumber: number
  par: number
  strokeIndex: number
  womenStrokeIndex: number
}

type WeekWithCourse = {
  id: string
  date: Date
  handicapMode: HandicapMode
  season: { id: string }
  course: {
    nineHolePar: number
    nineHoleRating: number
    nineHoleSlope: number
    tees: CourseTee[]
    holes: CourseHole[]
  }
}

type MatchPlayer = {
  gender: Gender
  defaultTeeColor: TeeColor | null
  seedHandicap: number | null
  seasonTeeChoices: Array<{ seasonId: string; teeColor: TeeColor }>
  handicapRecords: Array<{ courseDifferential: number; date: Date; weekId: string | null }>
}

type MatchWithPlayers = {
  player1: MatchPlayer
  player2: MatchPlayer
  player1HandicapIndex: number | null
  player2HandicapIndex: number | null
  player1PlayingHandicap: number | null
  player2PlayingHandicap: number | null
  player1TeeOverrideColor: TeeColor | null
  player2TeeOverrideColor: TeeColor | null
}

type HoleScoreInput = {
  holeNumber: number
  grossScore: number
}

type ProcessedScore = {
  holeNumber: number
  grossScore: number
  adjustedScore: number
  netScore: number
}

type HoleScoreWriter = {
  holeScore: {
    upsert: typeof prisma.holeScore.upsert
  }
}

type HandicapRecordWriter = {
  handicapRecord: {
    upsert: typeof prisma.handicapRecord.upsert
  }
}

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

function resolveMatchHandicaps(
  match: MatchWithPlayers,
  week: WeekWithCourse,
  grossScores: {
    player1Gross: number | null
    player2Gross: number | null
  } = { player1Gross: null, player2Gross: null }
) {
  const player1BaseIndex = getEffectiveHandicapIndex(match.player1, match.player1HandicapIndex)
  const player2BaseIndex = getEffectiveHandicapIndex(match.player2, match.player2HandicapIndex)
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
  const player1Tee = getCourseTee(
    week.course.tees,
    player1TeeColor,
    match.player1.gender,
    getCourseDefaultTeeFallback(week.course)
  )
  const player2Tee = getCourseTee(
    week.course.tees,
    player2TeeColor,
    match.player2.gender,
    getCourseDefaultTeeFallback(week.course)
  )
  const firstRoundPlayer1Index =
    grossScores.player1Gross === null
      ? null
      : getFirstRoundHandicapIndex(match.player1, week.id, week.date, grossScores.player1Gross, player1Tee)
  const firstRoundPlayer2Index =
    grossScores.player2Gross === null
      ? null
      : getFirstRoundHandicapIndex(match.player2, week.id, week.date, grossScores.player2Gross, player2Tee)
  const player1Index = firstRoundPlayer1Index ?? player1BaseIndex
  const player2Index = firstRoundPlayer2Index ?? player2BaseIndex
  const player1PlayingHandicap =
    firstRoundPlayer1Index === null && match.player1PlayingHandicap !== null
      ? match.player1PlayingHandicap
      : getPlayingHandicap(week.handicapMode, player1Index, player1Tee)
  const player2PlayingHandicap =
    firstRoundPlayer2Index === null && match.player2PlayingHandicap !== null
      ? match.player2PlayingHandicap
      : getPlayingHandicap(week.handicapMode, player2Index, player2Tee)

  return {
    player1Index,
    player2Index,
    firstRoundPlayer1Index,
    firstRoundPlayer2Index,
    player1PlayingHandicap,
    player2PlayingHandicap,
    player1Tee,
    player2Tee,
    player1TeeColor,
    player2TeeColor
  }
}

function getMatchStrokeMaps(holes: CourseHole[], player1PlayingHandicap: number, player2PlayingHandicap: number, anyWoman: boolean) {
  const player1MatchStrokes = new Map<number, number>()
  const player2MatchStrokes = new Map<number, number>()

  for (const hole of holes) {
    const matchStrokeIndex = anyWoman ? hole.womenStrokeIndex : hole.strokeIndex
    const strokes = getMatchStrokeAllocation(
      player1PlayingHandicap,
      player2PlayingHandicap,
      matchStrokeIndex
    )
    player1MatchStrokes.set(hole.holeNumber, strokes.player1MatchStrokes)
    player2MatchStrokes.set(hole.holeNumber, strokes.player2MatchStrokes)
  }

  return { player1MatchStrokes, player2MatchStrokes }
}

function processPlayerScores(
  scores: HoleScoreInput[],
  holesByNumber: Map<number, CourseHole>,
  gender: Gender,
  escHandicap: number,
  matchStrokes: Map<number, number>
): ProcessedScore[] {
  return scores.map((score) => {
    const hole = holesByNumber.get(score.holeNumber)
    if (!hole) {
      throw new Error('Invalid hole')
    }

    const escStrokeIndex = gender === 'woman' ? hole.womenStrokeIndex : hole.strokeIndex
    const handicapStrokes = strokesReceivedOnHole(escHandicap, escStrokeIndex)
    const adjustedScore = applyESC(score.grossScore, hole.par, handicapStrokes)
    const playerMatchStrokes = matchStrokes.get(score.holeNumber) ?? 0

    return {
      holeNumber: score.holeNumber,
      grossScore: score.grossScore,
      adjustedScore,
      netScore: score.grossScore - playerMatchStrokes
    }
  })
}

async function upsertPlayerHoleScores(
  tx: HoleScoreWriter,
  weekId: string,
  playerId: string,
  matchId: string,
  scores: ProcessedScore[],
  existingMatchIds: Map<string, string | null>
) {
  for (const score of scores) {
    await tx.holeScore.upsert({
      where: {
        weekId_playerId_holeNumber: {
          weekId,
          playerId,
          holeNumber: score.holeNumber
        }
      },
      update: {
        grossScore: score.grossScore,
        adjustedScore: score.adjustedScore,
        matchId: existingMatchIds.get(`${playerId}-${score.holeNumber}`) ?? matchId
      },
      create: {
        weekId,
        playerId,
        holeNumber: score.holeNumber,
        grossScore: score.grossScore,
        adjustedScore: score.adjustedScore,
        matchId
      }
    })
  }
}

async function upsertHandicapRecord(
  tx: HandicapRecordWriter,
  weekId: string,
  playerId: string,
  date: Date,
  grossScore: number,
  adjustedGrossScore: number,
  tee: CourseTee
) {
  const courseDifferential = scoreDifferential(
    adjustedGrossScore,
    tee.nineHoleRating,
    tee.nineHoleSlope
  )

  await tx.handicapRecord.upsert({
    where: {
      playerId_weekId: {
        playerId,
        weekId
      }
    },
    update: {
      date,
      grossScore,
      adjustedGrossScore,
      courseRating: tee.nineHoleRating,
      slopeRating: tee.nineHoleSlope,
      coursePar: tee.nineHolePar,
      courseDifferential
    },
    create: {
      playerId,
      weekId,
      date,
      grossScore,
      adjustedGrossScore,
      courseRating: tee.nineHoleRating,
      slopeRating: tee.nineHoleSlope,
      coursePar: tee.nineHolePar,
      courseDifferential
    }
  })
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
          handicapRecords: HANDICAP_RECORDS_INCLUDE,
          seasonTeeChoices: true
        }
      },
      player2: {
        include: {
          handicapRecords: HANDICAP_RECORDS_INCLUDE,
          seasonTeeChoices: true
        }
      }
    }
  })

  if (!match || !match.week.course) {
    return null
  }
  const week = {
    ...match.week,
    course: match.week.course
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

  const savedPlayer1Scores = holeScores.filter((score) => score.playerId === match.player1Id)
  const savedPlayer2Scores = holeScores.filter((score) => score.playerId === match.player2Id)
  const savedPlayer1Gross =
    savedPlayer1Scores.length === 9 ? sum(savedPlayer1Scores.map((score) => score.grossScore)) : null
  const savedPlayer2Gross =
    savedPlayer2Scores.length === 9 ? sum(savedPlayer2Scores.map((score) => score.grossScore)) : null
  const attendanceMap = new Map(match.week.attendance.map((entry) => [entry.playerId, entry.present]))
  const {
    player1Index,
    player2Index,
    player1PlayingHandicap,
    player2PlayingHandicap,
    player1Tee,
    player2Tee,
    player1TeeColor,
    player2TeeColor
  } = resolveMatchHandicaps(match, week, {
    player1Gross: savedPlayer1Gross,
    player2Gross: savedPlayer2Gross
  })
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

  const scoreMap = new Map(holeScores.map((score) => [`${score.playerId}:${score.holeNumber}`, score]))

  const anyWoman = match.player1.gender === 'woman' || match.player2.gender === 'woman'

  const rows = week.course.holes.map((hole) => {
    const p1 = scoreMap.get(`${match.player1Id}:${hole.holeNumber}`)
    const p2 = scoreMap.get(`${match.player2Id}:${hole.holeNumber}`)
    const matchStrokeIndex = anyWoman ? hole.womenStrokeIndex : hole.strokeIndex
    const player1EscStrokeIndex = match.player1.gender === 'woman' ? hole.womenStrokeIndex : hole.strokeIndex
    const player2EscStrokeIndex = match.player2.gender === 'woman' ? hole.womenStrokeIndex : hole.strokeIndex
    const { player1MatchStrokes, player2MatchStrokes } = getMatchStrokeAllocation(
      player1PlayingHandicap,
      player2PlayingHandicap,
      matchStrokeIndex
    )
    const player1AdjustedStrokesReceived = strokesReceivedOnHole(player1EscHandicap, player1EscStrokeIndex)
    const player2AdjustedStrokesReceived = strokesReceivedOnHole(player2EscHandicap, player2EscStrokeIndex)

    return {
      holeNumber: hole.holeNumber,
      par: hole.par,
      strokeIndex: matchStrokeIndex,
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
      courseName: week.course.name,
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
            where: HANDICAP_RECORDS_INCLUDE.where,
            orderBy: { date: 'desc' }
          },
          seasonTeeChoices: true
        }
      },
      player2: {
        include: {
          handicapRecords: {
            where: HANDICAP_RECORDS_INCLUDE.where,
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
  const week = {
    ...match.week,
    course: match.week.course
  }

  if (match.week.season.archivedAt) {
    throw new Error('Archived seasons cannot be edited')
  }

  const course = week.course

  if (!match.locked || !match.week.locked) {
    throw new Error('Match must be locked before scores can be entered')
  }

  const attendanceMap = new Map(match.week.attendance.map((entry) => [entry.playerId, entry.present]))
  if (!attendanceMap.get(match.player1Id) || !attendanceMap.get(match.player2Id)) {
    throw new Error('Both players must be checked in before scores can be entered')
  }

  const player1Gross = sum(player1Scores.map((score) => score.grossScore))
  const player2Gross = sum(player2Scores.map((score) => score.grossScore))
  const {
    player1Index: scoringPlayer1Index,
    player2Index: scoringPlayer2Index,
    firstRoundPlayer1Index,
    firstRoundPlayer2Index,
    player1PlayingHandicap,
    player2PlayingHandicap,
    player1Tee,
    player2Tee
  } = resolveMatchHandicaps(match, week, {
    player1Gross,
    player2Gross
  })
  const player1EscHandicap = roundToWholeHandicap(scoringPlayer1Index)
  const player2EscHandicap = roundToWholeHandicap(scoringPlayer2Index)

  const holeByNumber = new Map(course.holes.map((hole) => [hole.holeNumber, hole]))
  const anyWoman = match.player1.gender === 'woman' || match.player2.gender === 'woman'
  const { player1MatchStrokes, player2MatchStrokes } = getMatchStrokeMaps(
    course.holes,
    player1PlayingHandicap,
    player2PlayingHandicap,
    anyWoman
  )

  const processedP1 = processPlayerScores(
    player1Scores,
    holeByNumber,
    match.player1.gender,
    player1EscHandicap,
    player1MatchStrokes
  )
  const processedP2 = processPlayerScores(
    player2Scores,
    holeByNumber,
    match.player2.gender,
    player2EscHandicap,
    player2MatchStrokes
  )

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
    const existingHoleScores = await tx.holeScore.findMany({
      where: {
        weekId: input.weekId,
        playerId: {
          in: [match.player1Id, match.player2Id]
        }
      },
      select: {
        playerId: true,
        holeNumber: true,
        matchId: true
      }
    })
    const existingMatchIdByScore = new Map(
      existingHoleScores.map((score) => [`${score.playerId}-${score.holeNumber}`, score.matchId])
    )

    await upsertPlayerHoleScores(
      tx,
      input.weekId,
      match.player1Id,
      input.matchId,
      processedP1,
      existingMatchIdByScore
    )
    await upsertPlayerHoleScores(
      tx,
      input.weekId,
      match.player2Id,
      input.matchId,
      processedP2,
      existingMatchIdByScore
    )

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

    await upsertHandicapRecord(
      tx,
      input.weekId,
      match.player1Id,
      match.week.date,
      player1Gross,
      player1AdjustedGross,
      player1Tee
    )
    await upsertHandicapRecord(
      tx,
      input.weekId,
      match.player2Id,
      match.week.date,
      player2Gross,
      player2AdjustedGross,
      player2Tee
    )

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

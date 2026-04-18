import { prisma } from '@/lib/db'
import { getCourseTee, getPlayerMatchTeeColor } from '@/lib/course-tee'
import { getHandicapModeLabel, getPlayerHandicapIndexValue, getPlayingHandicap } from '@/lib/playing-handicap'
import { applyStoredMatchResult } from '@/lib/points'
import { resolveStrokeWinnerId } from '@/lib/stroke-result'
import { formatDate } from '@/lib/week'

function formatMatchPlaySummary(input: {
  matchPlayWinnerId: string | null
  matchPlayLeadBy: number | null
  matchPlayHolesRemaining: number | null
  player1Id: string
  player1Name: string
  player2Id: string
  player2Name: string
}) {
  if (input.matchPlayLeadBy === null) {
    return 'Pending'
  }

  function winLabel(name: string) {
    const lead = input.matchPlayLeadBy!
    const remaining = input.matchPlayHolesRemaining ?? 0
    return remaining > 0 ? `${name} (${lead}&${remaining})` : `${name} (${lead} up)`
  }

  if (input.matchPlayWinnerId === input.player1Id) {
    return winLabel(input.player1Name)
  }

  if (input.matchPlayWinnerId === input.player2Id) {
    return winLabel(input.player2Name)
  }

  return input.matchPlayLeadBy === 0 ? 'Halved' : 'All square'
}

export async function getLatestPublishedWeekId() {
  if (!process.env.DATABASE_URL) {
    return null
  }

  const week = await prisma.week.findFirst({
    where: {
      locked: true,
      season: {
        archivedAt: null
      }
    },
    orderBy: [{ date: 'desc' }]
  })

  return week?.id ?? null
}

export async function getPublicWeekData(weekId: string) {
  if (!process.env.DATABASE_URL) {
    return null
  }

  const week = await prisma.week.findUnique({
    where: { id: weekId },
    include: {
      season: true,
      course: {
        include: {
          tees: true
        }
      },
      ctpWinner: {
        select: { name: true }
      },
      longestPuttWinner: {
        select: { name: true }
      },
      attendance: {
        select: {
          playerId: true,
          present: true
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
          }
        },
        orderBy: { createdAt: 'asc' }
      }
    }
  })

  if (!week) {
    return null
  }

  const attendanceMap = new Map(week.attendance.map((entry) => [entry.playerId, entry.present]))
  const scoredMatchCount = week.matches.filter((match) => match.matchPlayLeadBy !== null).length
  const allScoresComplete = week.matches.length > 0 && scoredMatchCount === week.matches.length
  const pairingsVisible = week.locked
  const resultsVisible = allScoresComplete

  const handicapRecords = await prisma.handicapRecord.findMany({
    where: { weekId },
    select: {
      playerId: true,
      grossScore: true,
      adjustedGrossScore: true,
      courseRating: true,
      slopeRating: true,
      coursePar: true
    }
  })
  const handicapRecordMap = new Map(handicapRecords.map((record) => [record.playerId, record]))

  return {
    id: week.id,
    seasonId: week.season.id,
    weekNumber: week.weekNumber,
    seasonName: week.season.name,
    dateLabel: formatDate(week.date),
    courseName: week.course?.name ?? 'Course not selected',
    handicapMode: week.handicapMode,
    handicapModeLabel: getHandicapModeLabel(week.handicapMode),
    locked: week.locked,
    scoredMatchCount,
    matchCount: week.matches.length,
    allScoresComplete,
    pairingsVisible,
    resultsVisible,
    ctpHoleNumber: week.ctpHoleNumber,
    ctpWinnerName: week.ctpWinner?.name ?? null,
    longestPuttHoleNumber: week.longestPuttHoleNumber,
    longestPuttWinnerName: week.longestPuttWinner?.name ?? null,
    matches: week.matches.map((match, index) => {
      const player1Index = match.player1HandicapIndex ?? getPlayerHandicapIndexValue(match.player1)
      const player2Index = match.player2HandicapIndex ?? getPlayerHandicapIndexValue(match.player2)
      const p1Record = handicapRecordMap.get(match.player1Id)
      const p2Record = handicapRecordMap.get(match.player2Id)
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
      const player1Tee = week.course
        ? getCourseTee(week.course.tees, player1TeeColor, match.player1.gender, {
            color: 'white',
            gender: 'man',
            nineHolePar: week.course.nineHolePar,
            nineHoleRating: week.course.nineHoleRating,
            nineHoleSlope: week.course.nineHoleSlope
          })
        : null
      const player2Tee = week.course
        ? getCourseTee(week.course.tees, player2TeeColor, match.player2.gender, {
            color: 'white',
            gender: 'man',
            nineHolePar: week.course.nineHolePar,
            nineHoleRating: week.course.nineHoleRating,
            nineHoleSlope: week.course.nineHoleSlope
          })
        : null
      const player1PlayingHandicap =
        match.player1PlayingHandicap ??
        getPlayingHandicap(week.handicapMode, player1Index, player1Tee)
      const player2PlayingHandicap =
        match.player2PlayingHandicap ??
        getPlayingHandicap(week.handicapMode, player2Index, player2Tee)
      const matchStrokeDiff = Math.abs(player1PlayingHandicap - player2PlayingHandicap)
      const player1MatchStrokes = player1PlayingHandicap > player2PlayingHandicap ? matchStrokeDiff : 0
      const player2MatchStrokes = player2PlayingHandicap > player1PlayingHandicap ? matchStrokeDiff : 0
      const resolvedStrokeWinnerId = resolveStrokeWinnerId({
        player1Id: match.player1Id,
        player2Id: match.player2Id,
        player1Gross: p1Record?.grossScore ?? null,
        player2Gross: p2Record?.grossScore ?? null,
        player1PlayingHandicap,
        player2PlayingHandicap,
        player2ScorecardOnly: match.player2ScorecardOnly,
        storedStrokeWinnerId: match.strokeWinnerId
      })
      const points = match.matchPlayLeadBy === null
        ? null
        : applyStoredMatchResult({
            player1Id: match.player1Id,
            player2Id: match.player2Id,
            strokeWinnerId: resolvedStrokeWinnerId,
            matchPlayWinnerId: match.matchPlayWinnerId,
            matchPlayLeadBy: match.matchPlayLeadBy,
            player2ScorecardOnly: match.player2ScorecardOnly,
            player1Present: attendanceMap.get(match.player1Id) ?? false,
            player2Present: attendanceMap.get(match.player2Id) ?? false
          })

      return {
        id: match.id,
        label: `Match ${index + 1}`,
        isThreesome: match.player2ScorecardOnly,
        player1Name: match.player1.name,
        player2Name: match.player2.name,
        player1HandicapIndex: player1Index,
        player2HandicapIndex: player2Index,
        player1PlayingHandicap,
        player2PlayingHandicap,
        player1Points: points?.player1.totalPoints ?? null,
        player2Points: points?.player2.totalPoints ?? null,
        player1Gross: p1Record?.grossScore ?? null,
        player1Net: p1Record ? p1Record.grossScore - player1MatchStrokes : null,
        player2Gross: p2Record?.grossScore ?? null,
        player2Net: p2Record ? p2Record.grossScore - player2MatchStrokes : null,
        strokeSummary:
          match.matchPlayLeadBy === null
            ? 'Pending'
            : resolvedStrokeWinnerId === match.player1Id
              ? match.player1.name
              : resolvedStrokeWinnerId === match.player2Id
                ? match.player2.name
                : 'Halved',
        matchPlaySummary: formatMatchPlaySummary({
          matchPlayWinnerId: match.matchPlayWinnerId,
          matchPlayLeadBy: match.matchPlayLeadBy,
          matchPlayHolesRemaining: match.matchPlayHolesRemaining,
          player1Id: match.player1Id,
          player1Name: match.player1.name,
          player2Id: match.player2Id,
          player2Name: match.player2.name
        })
      }
    })
  }
}

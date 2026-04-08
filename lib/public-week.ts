import { prisma } from '@/lib/db'
import { courseHandicap, handicapIndex } from '@/lib/handicap'
import { applyStoredMatchResult } from '@/lib/points'

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date)
}

function getDisplayHandicapIndex(player: {
  seedHandicap: number | null
  handicapRecords: Array<{ courseDifferential: number }>
}, snapshot: number | null) {
  if (snapshot !== null) {
    return snapshot
  }

  return handicapIndex(player.handicapRecords.map((record) => record.courseDifferential)) ?? player.seedHandicap ?? 0
}

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
      course: true,
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
              }
            }
          },
          player2: {
            include: {
              handicapRecords: {
                orderBy: { date: 'desc' },
                take: 20
              }
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
      const points = match.matchPlayLeadBy === null
        ? null
        : applyStoredMatchResult({
            player1Id: match.player1Id,
            player2Id: match.player2Id,
            strokeWinnerId: match.strokeWinnerId,
            matchPlayWinnerId: match.matchPlayWinnerId,
            matchPlayLeadBy: match.matchPlayLeadBy,
            player2ScorecardOnly: match.player2ScorecardOnly,
            player1Present: attendanceMap.get(match.player1Id) ?? false,
            player2Present: attendanceMap.get(match.player2Id) ?? false
          })

      const player1Index = getDisplayHandicapIndex(match.player1, match.player1HandicapIndex)
      const player2Index = getDisplayHandicapIndex(match.player2, match.player2HandicapIndex)
      const p1Record = handicapRecordMap.get(match.player1Id)
      const p2Record = handicapRecordMap.get(match.player2Id)
      const player1CourseHandicap = p1Record
        ? courseHandicap(player1Index, p1Record.slopeRating, p1Record.courseRating, p1Record.coursePar)
        : null
      const player2CourseHandicap = p2Record
        ? courseHandicap(player2Index, p2Record.slopeRating, p2Record.courseRating, p2Record.coursePar)
        : null

      // Match net = adjustedGross minus strokes received from opponent.
      // Total match strokes always equals the course handicap difference.
      const matchStrokeDiff =
        player1CourseHandicap !== null && player2CourseHandicap !== null
          ? Math.abs(player1CourseHandicap - player2CourseHandicap)
          : null
      const player1MatchStrokes =
        matchStrokeDiff !== null && player1CourseHandicap !== null && player2CourseHandicap !== null
          ? player1CourseHandicap > player2CourseHandicap ? matchStrokeDiff : 0
          : null
      const player2MatchStrokes =
        matchStrokeDiff !== null && player1CourseHandicap !== null && player2CourseHandicap !== null
          ? player2CourseHandicap > player1CourseHandicap ? matchStrokeDiff : 0
          : null

      return {
        id: match.id,
        label: `Match ${index + 1}`,
        isThreesome: match.player2ScorecardOnly,
        player1Name: match.player1.name,
        player2Name: match.player2.name,
        player1HandicapIndex: player1Index,
        player2HandicapIndex: player2Index,
        player1CourseHandicap,
        player2CourseHandicap,
        player1Points: points?.player1.totalPoints ?? null,
        player2Points: points?.player2.totalPoints ?? null,
        player1Gross: p1Record?.grossScore ?? null,
        player1Net: p1Record && player1MatchStrokes !== null ? p1Record.adjustedGrossScore - player1MatchStrokes : null,
        player2Gross: p2Record?.grossScore ?? null,
        player2Net: p2Record && player2MatchStrokes !== null ? p2Record.adjustedGrossScore - player2MatchStrokes : null,
        strokeSummary:
          match.matchPlayLeadBy === null
            ? 'Pending'
            : match.strokeWinnerId === match.player1Id
              ? match.player1.name
              : match.strokeWinnerId === match.player2Id
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

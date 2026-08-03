import { prisma } from '@/lib/db'
import { buildPublicUrl } from '@/lib/public-url'
import { resolveStrokeWinnerId } from '@/lib/stroke-result'
import { formatDate } from '@/lib/week'
import { buildPublicWeekPath } from '@/lib/public-week-url'

function formatMatchPlaySummary(match: {
  player1Id: string
  player1Name: string
  player2Id: string
  player2Name: string
  matchPlayWinnerId: string | null
  matchPlayLeadBy: number | null
  matchPlayHolesRemaining: number | null
}) {
  if (match.matchPlayLeadBy === null) {
    return 'Pending'
  }

  const winnerName =
    match.matchPlayWinnerId === match.player1Id
      ? match.player1Name
      : match.matchPlayWinnerId === match.player2Id
        ? match.player2Name
        : null

  if (!winnerName) {
    return match.matchPlayLeadBy === 0 ? 'Halved' : 'All square'
  }

  const holesRemaining = match.matchPlayHolesRemaining ?? 0

  if (holesRemaining > 0 && match.matchPlayLeadBy > holesRemaining) {
    return `${winnerName} ${match.matchPlayLeadBy} & ${holesRemaining}`
  }

  return holesRemaining === 0
    ? `${winnerName} ${match.matchPlayLeadBy} up`
    : `${winnerName} ${match.matchPlayLeadBy} up`
}

export async function getHistoryPageData() {
  if (!process.env.DATABASE_URL) {
    return {
      weeks: []
    }
  }

  const weeks = await prisma.week.findMany({
    include: {
      season: true,
      course: true,
      handicapRecords: {
        select: {
          playerId: true,
          grossScore: true
        }
      },
      ctpWinner: true,
      longestPuttWinner: true,
      matches: {
        include: {
          player1: true,
          player2: true
        },
        orderBy: { createdAt: 'asc' }
      }
    },
    orderBy: [{ date: 'desc' }]
  })

  return {
    weeks: weeks.map((week) => {
      const adjustedScoreByPlayerId = new Map(
        week.handicapRecords.map((record) => [record.playerId, record.grossScore])
      )
      const completed =
        week.matches.length > 0 && week.matches.every((match) => match.matchPlayLeadBy !== null)

      return {
        id: week.id,
        weekNumber: week.weekNumber,
        seasonName: week.season.name,
        seasonArchived: Boolean(week.season.archivedAt),
        dateLabel: formatDate(week.date),
        courseName: week.course?.name ?? 'Course not selected',
        locked: week.locked,
        matchCount: week.matches.length,
        publicResultsUrl: completed ? buildPublicUrl(buildPublicWeekPath(week.date)) : null,
        comparisonUrl: completed ? `/history/${week.id}/compare` : null,
        ctpHoleNumber: week.ctpHoleNumber,
        ctpWinnerName: week.ctpWinner?.name ?? null,
        longestPuttHoleNumber: week.longestPuttHoleNumber,
        longestPuttWinnerName: week.longestPuttWinner?.name ?? null,
        matches: week.matches.map((match) => {
          const strokeWinnerId = resolveStrokeWinnerId({
            player1Id: match.player1.id,
            player2Id: match.player2.id,
            player1Gross: adjustedScoreByPlayerId.get(match.player1.id) ?? null,
            player2Gross: adjustedScoreByPlayerId.get(match.player2.id) ?? null,
            player1PlayingHandicap: match.player1PlayingHandicap,
            player2PlayingHandicap: match.player2PlayingHandicap,
            player2ScorecardOnly: match.player2ScorecardOnly,
            storedStrokeWinnerId: match.strokeWinnerId
          })

          return {
            id: match.id,
            player1Name: match.player1.name,
            player1Id: match.player1.id,
            player2Name: match.player2.name,
            player2Id: match.player2.id,
            strokeWinnerId,
            matchPlayWinnerId: match.matchPlayWinnerId,
            matchPlayLeadBy: match.matchPlayLeadBy,
            matchPlayHolesRemaining: match.matchPlayHolesRemaining,
            matchPlaySummary: formatMatchPlaySummary({
              player1Id: match.player1.id,
              player1Name: match.player1.name,
              player2Id: match.player2.id,
              player2Name: match.player2.name,
              matchPlayWinnerId: match.matchPlayWinnerId,
              matchPlayLeadBy: match.matchPlayLeadBy,
              matchPlayHolesRemaining: match.matchPlayHolesRemaining
            }),
            player2ScorecardOnly: match.player2ScorecardOnly
          }
        })
      }
    })
  }
}

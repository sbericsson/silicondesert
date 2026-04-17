import { prisma } from '@/lib/db'
import { buildPublicUrl } from '@/lib/public-url'

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date)
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
    weeks: weeks.map((week) => ({
      id: week.id,
      weekNumber: week.weekNumber,
      seasonName: week.season.name,
      seasonArchived: Boolean(week.season.archivedAt),
      dateLabel: formatDate(week.date),
      courseName: week.course?.name ?? 'Course not selected',
      locked: week.locked,
      matchCount: week.matches.length,
      publicResultsUrl:
        week.matches.length > 0 && week.matches.every((match) => match.matchPlayLeadBy !== null)
          ? buildPublicUrl(`/public/weeks/${week.id}`)
          : null,
      ctpHoleNumber: week.ctpHoleNumber,
      ctpWinnerName: week.ctpWinner?.name ?? null,
      longestPuttHoleNumber: week.longestPuttHoleNumber,
      longestPuttWinnerName: week.longestPuttWinner?.name ?? null,
      matches: week.matches.map((match) => ({
        id: match.id,
        player1Name: match.player1.name,
        player1Id: match.player1.id,
        player2Name: match.player2.name,
        player2Id: match.player2.id,
        strokeWinnerId: match.strokeWinnerId,
        matchPlayWinnerId: match.matchPlayWinnerId,
        matchPlayLeadBy: match.matchPlayLeadBy,
        player2ScorecardOnly: match.player2ScorecardOnly
      }))
    }))
  }
}

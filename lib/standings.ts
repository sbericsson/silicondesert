import { prisma } from '@/lib/db'
import { applyStoredMatchResult } from '@/lib/points'
import { getCurrentWeekRecord, pickActiveSeason } from '@/lib/week'

export async function getStandingsPageData() {
  if (!process.env.DATABASE_URL) {
    return {
      seasons: [],
      selectedSeasonId: null,
      selectedSeasonName: null,
      standings: []
    }
  }

  const [currentWeek, seasons] = await Promise.all([
    getCurrentWeekRecord(),
    prisma.season.findMany({
      where: {
        archivedAt: null
      },
      include: {
        weeks: {
          select: {
            matches: {
              select: {
                matchPlayLeadBy: true
              }
            }
          }
        }
      },
      orderBy: [{ startDate: 'asc' }]
    })
  ])

  const selectedSeason = pickActiveSeason(seasons, currentWeek?.seasonId)

  if (!selectedSeason) {
    return {
      seasons: [],
      selectedSeasonId: null,
      selectedSeasonName: null,
      standings: []
    }
  }

  const weeks = await prisma.week.findMany({
    where: { seasonId: selectedSeason.id },
    include: {
      attendance: true,
      matches: true
    },
    orderBy: { date: 'asc' }
  })

  const players = await prisma.player.findMany({
    where: { active: true },
    orderBy: { name: 'asc' }
  })

  const totals = new Map(
    players.map((player) => [
      player.id,
      {
        playerId: player.id,
        name: player.name,
        totalPoints: 0,
        strokeWins: 0,
        matchPlayWins: 0,
        ctpWins: 0,
        lpWins: 0
      }
    ])
  )

  for (const week of weeks) {
    const attendanceMap = new Map(week.attendance.map((entry) => [entry.playerId, entry.present]))

    for (const match of week.matches) {
      if (match.matchPlayLeadBy === null) {
        continue
      }

      const points = applyStoredMatchResult({
        player1Id: match.player1Id,
        player2Id: match.player2Id,
        strokeWinnerId: match.strokeWinnerId,
        matchPlayWinnerId: match.matchPlayWinnerId,
        matchPlayLeadBy: match.matchPlayLeadBy,
        player2ScorecardOnly: match.player2ScorecardOnly,
        player1Present: attendanceMap.get(match.player1Id) ?? false,
        player2Present: attendanceMap.get(match.player2Id) ?? false
      })

      const player1 = totals.get(match.player1Id)
      const player2 = totals.get(match.player2Id)

      if (player1) {
        player1.totalPoints += points.player1.totalPoints
        player1.strokeWins += points.player1.strokeWins
        player1.matchPlayWins += points.player1.matchPlayWins
      }

      if (player2) {
        player2.totalPoints += points.player2.totalPoints
        player2.strokeWins += points.player2.strokeWins
        player2.matchPlayWins += points.player2.matchPlayWins
      }
    }

    if (week.ctpWinnerId && totals.has(week.ctpWinnerId)) {
      const player = totals.get(week.ctpWinnerId)
      if (player) {
        player.totalPoints += 1
        player.ctpWins += 1
      }
    }

    if (week.longestPuttWinnerId && totals.has(week.longestPuttWinnerId)) {
      const player = totals.get(week.longestPuttWinnerId)
      if (player) {
        player.totalPoints += 1
        player.lpWins += 1
      }
    }
  }

  return {
    seasons: seasons.map((season) => ({
      id: season.id,
      name: season.name
    })),
    selectedSeasonId: selectedSeason.id,
    selectedSeasonName: selectedSeason.name,
    standings: [...totals.values()].sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints
      }

      return a.name.localeCompare(b.name)
    })
  }
}

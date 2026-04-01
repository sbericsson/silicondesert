import { prisma } from '@/lib/db'
import { applyStoredMatchResult } from '@/lib/points'

function formatTimestamp(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date)
}

export async function getPublicStandingsData(selectedView?: string) {
  if (!process.env.DATABASE_URL) {
    return {
      tabs: [],
      selectedView: null,
      selectedLabel: null,
      standings: [],
      lastUpdatedLabel: formatTimestamp(new Date())
    }
  }

  const seasons = await prisma.season.findMany({
    include: {
      weeks: {
        include: {
          attendance: {
            select: {
              playerId: true,
              present: true
            }
          },
          matches: true
        },
        orderBy: { date: 'asc' }
      }
    },
    orderBy: { startDate: 'asc' }
  })

  const seasonsWithResults = seasons.filter((season) =>
    season.weeks.some((week) => week.matches.some((match) => match.matchPlayLeadBy !== null))
  )

  const tabs = seasonsWithResults.map((season) => ({
    id: season.id,
    label: season.name
  }))

  if (seasonsWithResults.length > 1) {
    tabs.push({
      id: 'overall',
      label: 'Overall'
    })
  }

  const selectedResolved =
    tabs.find((tab) => tab.id === selectedView)?.id ??
    seasonsWithResults.at(-1)?.id ??
    tabs[0]?.id ??
    null

  if (!selectedResolved) {
    return {
      tabs,
      selectedView: null,
      selectedLabel: null,
      standings: [],
      lastUpdatedLabel: formatTimestamp(new Date())
    }
  }

  const weeks =
    selectedResolved === 'overall'
      ? seasonsWithResults.flatMap((season) => season.weeks)
      : seasonsWithResults.find((season) => season.id === selectedResolved)?.weeks ?? []

  const players = await prisma.player.findMany({
    orderBy: { name: 'asc' }
  })

  const totals = new Map(
    players.map((player) => [
      player.id,
      {
        playerId: player.id,
        name: player.name,
        active: player.active,
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

  const standings = [...totals.values()]
    .filter(
      (row) =>
        row.active ||
        row.totalPoints > 0 ||
        row.strokeWins > 0 ||
        row.matchPlayWins > 0 ||
        row.ctpWins > 0 ||
        row.lpWins > 0
    )
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints
      }

      return a.name.localeCompare(b.name)
    })

  return {
    tabs,
    selectedView: selectedResolved,
    selectedLabel: tabs.find((tab) => tab.id === selectedResolved)?.label ?? null,
    standings,
    lastUpdatedLabel: formatTimestamp(new Date())
  }
}

import { prisma } from '@/lib/db'
import { getPlayerHandicapInlineLabel } from '@/lib/player-handicap-display'
import { comparePlayerNamesByLastName } from '@/lib/player-sort'
import { applyStoredMatchResult, getUnpairedPresentPlayerIds } from '@/lib/points'
import { resolveStrokeWinnerId } from '@/lib/stroke-result'
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

  const [weeks, players] = await Promise.all([
    prisma.week.findMany({
      where: { seasonId: selectedSeason.id },
      include: {
        attendance: true,
        handicapRecords: {
          select: {
            playerId: true,
            grossScore: true
          }
        },
        matches: true
      },
      orderBy: { date: 'asc' }
    }),
    prisma.player.findMany({
      where: { active: true },
      include: {
        handicapRecords: {
          where: { countsForHandicap: true },
          orderBy: { date: 'desc' },
          take: 20
        }
      },
      orderBy: { name: 'asc' }
    })
  ])

  const totals = new Map(
    players.map((player) => [
      player.id,
      {
        playerId: player.id,
        name: player.name,
        currentIndexDisplay: getPlayerHandicapInlineLabel(player),
        totalPoints: 0,
        strokePoints: 0,
        matchPlayPoints: 0,
        ctpWins: 0,
        lpWins: 0
      }
    ])
  )

  for (const week of weeks) {
    const attendanceMap = new Map(week.attendance.map((entry) => [entry.playerId, entry.present]))
    const adjustedScoreByPlayerId = new Map(
      week.handicapRecords.map((record) => [record.playerId, record.grossScore])
    )

    for (const match of week.matches) {
      if (match.matchPlayLeadBy === null) {
        continue
      }

      const strokeWinnerId = resolveStrokeWinnerId({
        player1Id: match.player1Id,
        player2Id: match.player2Id,
        player1Gross: adjustedScoreByPlayerId.get(match.player1Id) ?? null,
        player2Gross: adjustedScoreByPlayerId.get(match.player2Id) ?? null,
        player1PlayingHandicap: match.player1PlayingHandicap,
        player2PlayingHandicap: match.player2PlayingHandicap,
        player2ScorecardOnly: match.player2ScorecardOnly,
        storedStrokeWinnerId: match.strokeWinnerId
      })

      const points = applyStoredMatchResult({
        player1Id: match.player1Id,
        player2Id: match.player2Id,
        strokeWinnerId,
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
        player1.strokePoints += points.player1.strokePoints
        player1.matchPlayPoints += points.player1.matchPlayPoints
      }

      if (player2) {
        player2.totalPoints += points.player2.totalPoints
        player2.strokePoints += points.player2.strokePoints
        player2.matchPlayPoints += points.player2.matchPlayPoints
      }
    }

    for (const playerId of getUnpairedPresentPlayerIds(week.attendance, week.matches)) {
      const player = totals.get(playerId)
      if (player) {
        player.totalPoints += 1
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

      return comparePlayerNamesByLastName(a.name, b.name)
    })
  }
}

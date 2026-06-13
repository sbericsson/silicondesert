import { applyStoredMatchResult, getUnpairedPresentPlayerIds } from '@/lib/points'
import { resolveStrokeWinnerId } from '@/lib/stroke-result'

export type StandingTotals = {
  playerId: string
  name: string
  currentIndexDisplay: string
  totalPoints: number
  attendancePoints: number
  strokePoints: number
  matchPlayPoints: number
  ctpWins: number
  lpWins: number
}

type WeekForPoints = {
  ctpWinnerId: string | null
  longestPuttWinnerId: string | null
  attendance: Array<{ playerId: string; present: boolean }>
  handicapRecords: Array<{ playerId: string; grossScore: number | null }>
  matches: Array<{
    player1Id: string
    player2Id: string
    player1PlayingHandicap: number | null
    player2PlayingHandicap: number | null
    player2ScorecardOnly: boolean
    strokeWinnerId: string | null
    matchPlayWinnerId: string | null
    matchPlayLeadBy: number | null
  }>
}

type PlayerForPoints = {
  id: string
  name: string
  currentIndexDisplay: string
}

// Accumulates league points for the given players across the given weeks. This is the
// single source of truth for points totals, shared by the commissioner standings, the
// public standings, and positioning-round ranking. Points are computed on the fly:
// stroke (2 win / 1 tie), match play (2 win / 1 halved), +1 attendance, +1 each CTP/LP.
export function accumulatePoints(
  weeks: WeekForPoints[],
  players: PlayerForPoints[]
): Map<string, StandingTotals> {
  const totals = new Map<string, StandingTotals>(
    players.map((player) => [
      player.id,
      {
        playerId: player.id,
        name: player.name,
        currentIndexDisplay: player.currentIndexDisplay,
        totalPoints: 0,
        attendancePoints: 0,
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
        player1.attendancePoints += points.player1.attendancePoints
        player1.strokePoints += points.player1.strokePoints
        player1.matchPlayPoints += points.player1.matchPlayPoints
      }

      if (player2) {
        player2.totalPoints += points.player2.totalPoints
        player2.attendancePoints += points.player2.attendancePoints
        player2.strokePoints += points.player2.strokePoints
        player2.matchPlayPoints += points.player2.matchPlayPoints
      }
    }

    for (const playerId of getUnpairedPresentPlayerIds(week.attendance, week.matches)) {
      const player = totals.get(playerId)
      if (player) {
        player.totalPoints += 1
        player.attendancePoints += 1
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

  return totals
}

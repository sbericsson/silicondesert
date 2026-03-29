export interface MatchInput {
  player1Id: string
  player2Id: string
  player1NetScore: number | null
  player2NetScore: number | null
  matchPlayWinnerId: string | null
  matchPlayLeadBy: number | null
  player2ScorecardOnly: boolean
}

export interface MatchPoints {
  player1Points: number
  player2Points: number
  breakdown: {
    p1Stroke: number
    p2Stroke: number
    p1MatchPlay: number
    p2MatchPlay: number
    p1Attendance: number
    p2Attendance: number
  }
}

export interface WeekMatchPoints extends MatchInput {
  player1Present: boolean
  player2Present: boolean
}

export function calculateMatchPoints(
  match: MatchInput,
  player1Present: boolean,
  player2Present: boolean
): MatchPoints {
  const p1Attendance = player1Present ? 1 : 0
  const p2Attendance = player2Present && !match.player2ScorecardOnly ? 1 : 0

  let p1Stroke = 0
  let p2Stroke = 0

  if (match.player1NetScore !== null && match.player2NetScore !== null && !match.player2ScorecardOnly) {
    if (match.player1NetScore < match.player2NetScore) {
      p1Stroke = 2
    } else if (match.player2NetScore < match.player1NetScore) {
      p2Stroke = 2
    } else {
      p1Stroke = 1
      p2Stroke = 1
    }
  } else if (match.player1NetScore !== null && match.player2ScorecardOnly) {
    p1Stroke = 2
  }

  let p1MatchPlay = 0
  let p2MatchPlay = 0

  if (!match.player2ScorecardOnly && match.matchPlayLeadBy !== null) {
    if (match.matchPlayWinnerId === match.player1Id) {
      p1MatchPlay = 2
    } else if (match.matchPlayWinnerId === match.player2Id) {
      p2MatchPlay = 2
    } else {
      p1MatchPlay = 1
      p2MatchPlay = 1
    }
  } else if (match.player2ScorecardOnly) {
    if (match.matchPlayWinnerId === match.player1Id) {
      p1MatchPlay = 2
    } else if (match.matchPlayLeadBy === 0) {
      p1MatchPlay = 1
    }
  }

  return {
    player1Points: p1Attendance + p1Stroke + p1MatchPlay,
    player2Points: match.player2ScorecardOnly ? 0 : p2Attendance + p2Stroke + p2MatchPlay,
    breakdown: {
      p1Stroke,
      p2Stroke,
      p1MatchPlay,
      p2MatchPlay,
      p1Attendance,
      p2Attendance
    }
  }
}

export function calculateWeekPoints(
  matches: WeekMatchPoints[],
  ctpWinnerId: string | null,
  lpWinnerId: string | null
) {
  const totals = new Map<string, number>()

  for (const match of matches) {
    const points = calculateMatchPoints(match, match.player1Present, match.player2Present)
    totals.set(match.player1Id, (totals.get(match.player1Id) ?? 0) + points.player1Points)
    totals.set(match.player2Id, (totals.get(match.player2Id) ?? 0) + points.player2Points)
  }

  if (ctpWinnerId) {
    totals.set(ctpWinnerId, (totals.get(ctpWinnerId) ?? 0) + 1)
  }

  if (lpWinnerId) {
    totals.set(lpWinnerId, (totals.get(lpWinnerId) ?? 0) + 1)
  }

  return totals
}

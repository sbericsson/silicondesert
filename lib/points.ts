export function applyStoredMatchResult(input: {
  player1Id: string
  player2Id: string
  strokeWinnerId: string | null
  matchPlayWinnerId: string | null
  matchPlayLeadBy: number | null
  player2ScorecardOnly: boolean
  player1Present: boolean
  player2Present: boolean
}) {
  const player1 = {
    totalPoints: input.player1Present ? 1 : 0,
    attendancePoints: input.player1Present ? 1 : 0,
    strokePoints: 0,
    matchPlayPoints: 0,
    strokeWins: 0,
    matchPlayWins: 0
  }
  const player2 = {
    totalPoints: input.player2Present && !input.player2ScorecardOnly ? 1 : 0,
    attendancePoints: input.player2Present && !input.player2ScorecardOnly ? 1 : 0,
    strokePoints: 0,
    matchPlayPoints: 0,
    strokeWins: 0,
    matchPlayWins: 0
  }

  if (input.player2ScorecardOnly) {
    if (input.strokeWinnerId === input.player1Id) {
      player1.totalPoints += 2
      player1.strokePoints += 2
      player1.strokeWins += 1
    } else if (input.strokeWinnerId === null) {
      player1.totalPoints += 1
      player1.strokePoints += 1
    }
  } else if (input.strokeWinnerId === input.player1Id) {
    player1.totalPoints += 2
    player1.strokePoints += 2
    player1.strokeWins += 1
  } else if (input.strokeWinnerId === input.player2Id) {
    player2.totalPoints += 2
    player2.strokePoints += 2
    player2.strokeWins += 1
  } else {
    player1.totalPoints += 1
    player2.totalPoints += 1
    player1.strokePoints += 1
    player2.strokePoints += 1
  }

  if (input.matchPlayLeadBy !== null) {
    if (input.player2ScorecardOnly) {
      if (input.matchPlayWinnerId === input.player1Id) {
        player1.totalPoints += 2
        player1.matchPlayPoints += 2
        player1.matchPlayWins += 1
      } else if (input.matchPlayLeadBy === 0) {
        player1.totalPoints += 1
        player1.matchPlayPoints += 1
      }
    } else if (input.matchPlayWinnerId === input.player1Id) {
      player1.totalPoints += 2
      player1.matchPlayPoints += 2
      player1.matchPlayWins += 1
    } else if (input.matchPlayWinnerId === input.player2Id) {
      player2.totalPoints += 2
      player2.matchPlayPoints += 2
      player2.matchPlayWins += 1
    } else {
      player1.totalPoints += 1
      player2.totalPoints += 1
      player1.matchPlayPoints += 1
      player2.matchPlayPoints += 1
    }
  }

  return { player1, player2 }
}

export function getUnpairedPresentPlayerIds(
  attendance: Array<{ playerId: string; present: boolean }>,
  matches: Array<{ player1Id: string; player2Id: string }>
) {
  const matchedPlayerIds = new Set(matches.flatMap((match) => [match.player1Id, match.player2Id]))

  return attendance
    .filter((entry) => entry.present && !matchedPlayerIds.has(entry.playerId))
    .map((entry) => entry.playerId)
}

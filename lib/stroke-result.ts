export function resolveStrokeWinnerId(input: {
  player1Id: string
  player2Id: string
  player1Gross: number | null
  player2Gross: number | null
  player1PlayingHandicap: number | null
  player2PlayingHandicap: number | null
  player2ScorecardOnly: boolean
  storedStrokeWinnerId: string | null
}) {
  if (
    input.player1Gross === null ||
    input.player2Gross === null ||
    input.player1PlayingHandicap === null ||
    input.player2PlayingHandicap === null
  ) {
    return input.storedStrokeWinnerId
  }

  if (input.player2ScorecardOnly) {
    return input.player1Id
  }

  const matchStrokeDiff = Math.abs(input.player1PlayingHandicap - input.player2PlayingHandicap)
  const player1Net =
    input.player1Gross -
    (input.player1PlayingHandicap > input.player2PlayingHandicap ? matchStrokeDiff : 0)
  const player2Net =
    input.player2Gross -
    (input.player2PlayingHandicap > input.player1PlayingHandicap ? matchStrokeDiff : 0)

  if (player1Net < player2Net) {
    return input.player1Id
  }

  if (player2Net < player1Net) {
    return input.player2Id
  }

  return null
}

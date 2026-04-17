import { strokesReceivedOnHole } from '@/lib/handicap'
import { calculateMatchPlayResult } from '@/lib/scoring'

function sum(values: Array<number | null>) {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0)
}

export function getMatchStrokeAllocation(
  player1PlayingHandicap: number,
  player2PlayingHandicap: number,
  strokeIndex: number
) {
  const popDifference = Math.abs(player1PlayingHandicap - player2PlayingHandicap)

  if (popDifference === 0) {
    return {
      player1MatchStrokes: 0,
      player2MatchStrokes: 0
    }
  }

  if (player1PlayingHandicap > player2PlayingHandicap) {
    return {
      player1MatchStrokes: strokesReceivedOnHole(popDifference, strokeIndex),
      player2MatchStrokes: 0
    }
  }

  return {
    player1MatchStrokes: 0,
    player2MatchStrokes: strokesReceivedOnHole(popDifference, strokeIndex)
  }
}

export interface AdjustedMatchHoleInput {
  holeNumber: number
  strokeIndex: number
  player1GrossScore: number | null
  player2GrossScore: number | null
}

export function calculateMatchOutcomeFromGrossScores(input: {
  player1Id: string
  player2Id: string
  player1PlayingHandicap: number
  player2PlayingHandicap: number
  player2ScorecardOnly: boolean
  holes: AdjustedMatchHoleInput[]
}) {
  const holes = [...input.holes]
    .sort((left, right) => left.holeNumber - right.holeNumber)
    .map((hole) => {
      const { player1MatchStrokes, player2MatchStrokes } = getMatchStrokeAllocation(
        input.player1PlayingHandicap,
        input.player2PlayingHandicap,
        hole.strokeIndex
      )

      return {
        player1Net: hole.player1GrossScore === null ? null : hole.player1GrossScore - player1MatchStrokes,
        player2Net: hole.player2GrossScore === null ? null : hole.player2GrossScore - player2MatchStrokes
      }
    })

  const allScoresComplete =
    holes.length > 0 && holes.every((hole) => hole.player1Net !== null && hole.player2Net !== null)
  const player1NetTotal = allScoresComplete ? sum(holes.map((hole) => hole.player1Net)) : null
  const player2NetTotal = allScoresComplete ? sum(holes.map((hole) => hole.player2Net)) : null
  const matchPlayResult = calculateMatchPlayResult(holes, input.player1Id, input.player2Id)

  const strokeWinnerId =
    player1NetTotal === null || player2NetTotal === null
      ? null
      : input.player2ScorecardOnly
        ? input.player1Id
        : player1NetTotal < player2NetTotal
          ? input.player1Id
          : player2NetTotal < player1NetTotal
            ? input.player2Id
            : null

  return {
    player1NetTotal,
    player2NetTotal,
    strokeWinnerId,
    matchPlayLeadBy: matchPlayResult?.matchPlayLeadBy ?? null,
    matchPlayHolesRemaining: matchPlayResult?.matchPlayHolesRemaining ?? null,
    matchPlayWinnerId: matchPlayResult?.matchPlayWinnerId ?? null
  }
}

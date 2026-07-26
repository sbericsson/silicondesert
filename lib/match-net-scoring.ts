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

export interface PopHoleInput {
  holeNumber: number
  strokeIndex: number
  womenStrokeIndex: number
}

export interface PopHole {
  holeNumber: number
  strokes: number
}

/**
 * Which holes the pop recipient actually strokes on, and how many strokes each.
 *
 * Pops fall on the hardest holes first: a recipient with N pops strokes on every
 * hole whose stroke index is <= N, and picks up a second stroke on holes whose
 * index is <= N - 9. The women's stroke index is used whenever either player in
 * the match is a woman, matching how match net scores are computed.
 */
export function getPopHoles(input: {
  popDifference: number
  holes: PopHoleInput[]
  anyWoman: boolean
}): PopHole[] {
  if (input.popDifference <= 0) {
    return []
  }

  return input.holes
    .map((hole) => ({
      holeNumber: hole.holeNumber,
      strokes: strokesReceivedOnHole(
        input.popDifference,
        input.anyWoman ? hole.womenStrokeIndex : hole.strokeIndex
      )
    }))
    .filter((hole) => hole.strokes > 0)
    .sort((left, right) => left.holeNumber - right.holeNumber)
}

/**
 * Renders pop holes as a sentence fragment to follow "gets N pops".
 *
 * Even allocation reads "on holes 1, 3, 4". Once a recipient has more than nine
 * pops some holes carry two strokes, so those are called out separately rather
 * than flattened into one misleading list.
 */
export function formatPopHoles(popHoles: PopHole[]) {
  if (popHoles.length === 0) {
    return ''
  }

  const strokeLevels = Array.from(new Set(popHoles.map((hole) => hole.strokes))).sort(
    (left, right) => right - left
  )

  const holeList = (holes: PopHole[]) =>
    holes.length === 1
      ? `hole ${holes[0].holeNumber}`
      : `holes ${holes.map((hole) => hole.holeNumber).join(', ')}`

  if (strokeLevels.length === 1) {
    return `on ${holeList(popHoles)}`
  }

  return `on ${strokeLevels
    .map((strokes) => {
      const holes = popHoles.filter((hole) => hole.strokes === strokes)
      return `${holeList(holes)} (${strokes} each)`
    })
    .join(' and ')}`
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

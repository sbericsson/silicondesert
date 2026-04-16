import { describe, expect, it } from 'vitest'
import { calculateMatchOutcomeFromAdjustedScores } from '@/lib/match-net-scoring'

describe('calculateMatchOutcomeFromAdjustedScores', () => {
  it('recomputes stroke and match-play winners from stored adjusted scores', () => {
    const holes = Array.from({ length: 9 }, (_, index) => ({
      holeNumber: index + 1,
      strokeIndex: index + 1,
      player1AdjustedScore: index < 2 ? 5 : 4,
      player2AdjustedScore: 4
    }))

    expect(
      calculateMatchOutcomeFromAdjustedScores({
        player1Id: 'p1',
        player2Id: 'p2',
        player1PlayingHandicap: 8,
        player2PlayingHandicap: 8,
        player2ScorecardOnly: false,
        holes
      })
    ).toEqual({
      player1NetTotal: 38,
      player2NetTotal: 36,
      strokeWinnerId: 'p2',
      matchPlayLeadBy: 2,
      matchPlayHolesRemaining: 1,
      matchPlayWinnerId: 'p2'
    })

    expect(
      calculateMatchOutcomeFromAdjustedScores({
        player1Id: 'p1',
        player2Id: 'p2',
        player1PlayingHandicap: 10,
        player2PlayingHandicap: 8,
        player2ScorecardOnly: false,
        holes
      })
    ).toEqual({
      player1NetTotal: 36,
      player2NetTotal: 36,
      strokeWinnerId: null,
      matchPlayLeadBy: 0,
      matchPlayHolesRemaining: 0,
      matchPlayWinnerId: null
    })
  })

  it('keeps stroke play unset until both scorecards are complete', () => {
    const holes = Array.from({ length: 9 }, (_, index) => ({
      holeNumber: index + 1,
      strokeIndex: index + 1,
      player1AdjustedScore: index < 2 ? 4 : null,
      player2AdjustedScore: index < 2 ? 5 : null
    }))

    expect(
      calculateMatchOutcomeFromAdjustedScores({
        player1Id: 'p1',
        player2Id: 'p2',
        player1PlayingHandicap: 8,
        player2PlayingHandicap: 8,
        player2ScorecardOnly: false,
        holes
      })
    ).toEqual({
      player1NetTotal: null,
      player2NetTotal: null,
      strokeWinnerId: null,
      matchPlayLeadBy: 2,
      matchPlayHolesRemaining: 7,
      matchPlayWinnerId: 'p1'
    })
  })
})

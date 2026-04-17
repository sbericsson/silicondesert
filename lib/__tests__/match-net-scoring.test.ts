import { describe, expect, it } from 'vitest'
import { calculateMatchOutcomeFromGrossScores } from '@/lib/match-net-scoring'

describe('calculateMatchOutcomeFromGrossScores', () => {
  it('recomputes stroke and match-play winners from stored gross scores', () => {
    const holes = Array.from({ length: 9 }, (_, index) => ({
      holeNumber: index + 1,
      strokeIndex: index + 1,
      player1GrossScore: index < 2 ? 5 : 4,
      player2GrossScore: 4
    }))

    expect(
      calculateMatchOutcomeFromGrossScores({
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
      calculateMatchOutcomeFromGrossScores({
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
      player1GrossScore: index < 2 ? 4 : null,
      player2GrossScore: index < 2 ? 5 : null
    }))

    expect(
      calculateMatchOutcomeFromGrossScores({
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

  it('uses gross totals, not adjusted totals, to decide the stroke winner', () => {
    const holes = Array.from({ length: 9 }, (_, index) => ({
      holeNumber: index + 1,
      strokeIndex: index + 1,
      player1GrossScore: 4,
      player2GrossScore: 5
    }))

    expect(
      calculateMatchOutcomeFromGrossScores({
        player1Id: 'tom',
        player2Id: 'mike',
        player1PlayingHandicap: 4,
        player2PlayingHandicap: 10,
        player2ScorecardOnly: false,
        holes
      })
    ).toMatchObject({
      player1NetTotal: 36,
      player2NetTotal: 39,
      strokeWinnerId: 'tom'
    })
  })
})

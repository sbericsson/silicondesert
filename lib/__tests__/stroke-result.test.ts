import { describe, expect, it } from 'vitest'
import { resolveStrokeWinnerId } from '@/lib/stroke-result'

describe('resolveStrokeWinnerId', () => {
  it('derives the stroke winner from adjusted totals and playing handicaps', () => {
    expect(
      resolveStrokeWinnerId({
        player1Id: 'tom',
        player2Id: 'mike',
        player1Gross: 38,
        player2Gross: 45,
        player1PlayingHandicap: 4,
        player2PlayingHandicap: 10,
        player2ScorecardOnly: false,
        storedStrokeWinnerId: null
      })
    ).toBe('tom')
  })

  it('falls back to the stored winner when saved totals are unavailable', () => {
    expect(
      resolveStrokeWinnerId({
        player1Id: 'p1',
        player2Id: 'p2',
        player1Gross: null,
        player2Gross: 45,
        player1PlayingHandicap: 4,
        player2PlayingHandicap: 10,
        player2ScorecardOnly: false,
        storedStrokeWinnerId: 'p2'
      })
    ).toBe('p2')
  })

  it('compares net totals for scorecard-only matches', () => {
    expect(
      resolveStrokeWinnerId({
        player1Id: 'p1',
        player2Id: 'reference',
        player1Gross: 48,
        player2Gross: 40,
        player1PlayingHandicap: 12,
        player2PlayingHandicap: 4,
        player2ScorecardOnly: true,
        storedStrokeWinnerId: 'p1'
      })
    ).toBe(null)

    expect(
      resolveStrokeWinnerId({
        player1Id: 'p1',
        player2Id: 'reference',
        player1Gross: 50,
        player2Gross: 40,
        player1PlayingHandicap: 12,
        player2PlayingHandicap: 4,
        player2ScorecardOnly: true,
        storedStrokeWinnerId: 'p1'
      })
    ).toBe('reference')
  })
})

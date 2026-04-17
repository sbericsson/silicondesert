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
})

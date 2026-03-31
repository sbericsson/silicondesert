import { describe, expect, it } from 'vitest'
import { calculateMatchPlayResult, calculateMatchPoints, calculateWeekPoints } from '@/lib/scoring'

describe('calculateMatchPoints', () => {
  it('awards attendance, stroke, and match-play points', () => {
    const result = calculateMatchPoints(
      {
        player1Id: 'p1',
        player2Id: 'p2',
        player1NetScore: 35,
        player2NetScore: 37,
        matchPlayWinnerId: 'p1',
        matchPlayLeadBy: 2,
        player2ScorecardOnly: false
      },
      true,
      true
    )

    expect(result.player1Points).toBe(5)
    expect(result.player2Points).toBe(1)
  })

  it('never awards points to player2 in scorecard-only matches', () => {
    const result = calculateMatchPoints(
      {
        player1Id: 'p1',
        player2Id: 'p2',
        player1NetScore: 35,
        player2NetScore: 36,
        matchPlayWinnerId: 'p1',
        matchPlayLeadBy: 1,
        player2ScorecardOnly: true
      },
      true,
      true
    )

    expect(result.player1Points).toBe(5)
    expect(result.player2Points).toBe(0)
  })
})

describe('calculateWeekPoints', () => {
  it('aggregates match totals and bonuses', () => {
    const totals = calculateWeekPoints(
      [
        {
          player1Id: 'p1',
          player2Id: 'p2',
          player1NetScore: 35,
          player2NetScore: 37,
          matchPlayWinnerId: 'p1',
          matchPlayLeadBy: 2,
          player1Present: true,
          player2Present: true,
          player2ScorecardOnly: false
        }
      ],
      'p1',
      'p2'
    )

    expect(totals.get('p1')).toBe(6)
    expect(totals.get('p2')).toBe(2)
  })
})

describe('calculateMatchPlayResult', () => {
  it('detects an early clinch result', () => {
    const result = calculateMatchPlayResult(
      [
        { player1Net: 4, player2Net: 5 },
        { player1Net: 4, player2Net: 5 },
        { player1Net: 4, player2Net: 5 },
        { player1Net: 4, player2Net: 5 },
        { player1Net: 4, player2Net: 5 },
        { player1Net: 5, player2Net: 4 },
        { player1Net: 5, player2Net: 4 },
        { player1Net: 5, player2Net: 4 },
        { player1Net: 5, player2Net: 4 }
      ],
      'p1',
      'p2'
    )

    expect(result).toEqual({
      matchPlayWinnerId: 'p1',
      matchPlayLeadBy: 5,
      matchPlayHolesRemaining: 4,
      completeHoleCount: 5
    })
  })

  it('returns a halved match after all 9 holes', () => {
    const result = calculateMatchPlayResult(
      [
        { player1Net: 4, player2Net: 5 },
        { player1Net: 5, player2Net: 4 },
        { player1Net: 4, player2Net: 4 },
        { player1Net: 4, player2Net: 5 },
        { player1Net: 5, player2Net: 4 },
        { player1Net: 4, player2Net: 4 },
        { player1Net: 4, player2Net: 5 },
        { player1Net: 5, player2Net: 4 },
        { player1Net: 4, player2Net: 4 }
      ],
      'p1',
      'p2'
    )

    expect(result).toEqual({
      matchPlayWinnerId: null,
      matchPlayLeadBy: 0,
      matchPlayHolesRemaining: 0,
      completeHoleCount: 9
    })
  })

  it('returns the live status for an incomplete match', () => {
    const result = calculateMatchPlayResult(
      [
        { player1Net: 4, player2Net: 5 },
        { player1Net: 4, player2Net: 5 },
        { player1Net: null, player2Net: null }
      ],
      'p1',
      'p2'
    )

    expect(result).toEqual({
      matchPlayWinnerId: 'p1',
      matchPlayLeadBy: 2,
      matchPlayHolesRemaining: 7,
      completeHoleCount: 2
    })
  })
})

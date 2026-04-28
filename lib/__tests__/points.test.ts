import { describe, expect, it } from 'vitest'
import { applyStoredMatchResult, getUnpairedPresentPlayerIds } from '@/lib/points'

describe('applyStoredMatchResult', () => {
  it('tracks actual stroke and match-play points, including ties', () => {
    const halved = applyStoredMatchResult({
      player1Id: 'p1',
      player2Id: 'p2',
      strokeWinnerId: null,
      matchPlayWinnerId: null,
      matchPlayLeadBy: 0,
      player2ScorecardOnly: false,
      player1Present: true,
      player2Present: true
    })

    expect(halved.player1).toMatchObject({
      totalPoints: 3,
      attendancePoints: 1,
      strokePoints: 1,
      matchPlayPoints: 1
    })
    expect(halved.player2).toMatchObject({
      totalPoints: 3,
      attendancePoints: 1,
      strokePoints: 1,
      matchPlayPoints: 1
    })
  })

  it('tracks two category points for a match winner', () => {
    const winner = applyStoredMatchResult({
      player1Id: 'p1',
      player2Id: 'p2',
      strokeWinnerId: 'p1',
      matchPlayWinnerId: 'p1',
      matchPlayLeadBy: 3,
      player2ScorecardOnly: false,
      player1Present: true,
      player2Present: true
    })

    expect(winner.player1).toMatchObject({
      totalPoints: 5,
      attendancePoints: 1,
      strokePoints: 2,
      matchPlayPoints: 2
    })
    expect(winner.player2).toMatchObject({
      totalPoints: 1,
      attendancePoints: 1,
      strokePoints: 0,
      matchPlayPoints: 0
    })
  })

  it('identifies checked-in players who are not in any match', () => {
    expect(
      getUnpairedPresentPlayerIds(
        [
          { playerId: 'p1', present: true },
          { playerId: 'p2', present: true },
          { playerId: 'p3', present: true },
          { playerId: 'p4', present: false }
        ],
        [{ player1Id: 'p1', player2Id: 'p2' }]
      )
    ).toEqual(['p3'])
  })
})

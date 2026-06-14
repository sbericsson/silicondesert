import { describe, expect, it } from 'vitest'
import { accumulatePoints, mergeSeasonTotals } from '@/lib/standings-engine'

const players = [
  { id: 'p1', name: 'Alice Adams', currentIndexDisplay: '10' },
  { id: 'p2', name: 'Bob Brown', currentIndexDisplay: '12' },
  { id: 'p3', name: 'Cara Cole', currentIndexDisplay: '8' }
]

function week(overrides: Partial<Parameters<typeof accumulatePoints>[0][number]> = {}) {
  return {
    ctpWinnerId: null,
    longestPuttWinnerId: null,
    attendance: [],
    handicapRecords: [],
    matches: [],
    ...overrides
  }
}

describe('accumulatePoints', () => {
  it('returns zeroed totals for every player when there are no weeks', () => {
    const totals = accumulatePoints([], players)
    expect(totals.size).toBe(3)
    expect(totals.get('p1')).toMatchObject({ totalPoints: 0, attendancePoints: 0, ctpWins: 0, lpWins: 0 })
  })

  it('awards stroke + match-play to the winner and attendance to both', () => {
    const totals = accumulatePoints(
      [
        week({
          attendance: [
            { playerId: 'p1', present: true },
            { playerId: 'p2', present: true }
          ],
          matches: [
            {
              player1Id: 'p1',
              player2Id: 'p2',
              player1PlayingHandicap: null,
              player2PlayingHandicap: null,
              player2ScorecardOnly: false,
              strokeWinnerId: 'p1',
              matchPlayWinnerId: 'p1',
              matchPlayLeadBy: 3
            }
          ]
        })
      ],
      players
    )

    expect(totals.get('p1')).toMatchObject({
      totalPoints: 5,
      attendancePoints: 1,
      strokePoints: 2,
      matchPlayPoints: 2
    })
    expect(totals.get('p2')).toMatchObject({ totalPoints: 1, attendancePoints: 1 })
  })

  it('skips matches that have no recorded result (matchPlayLeadBy null)', () => {
    const totals = accumulatePoints(
      [
        week({
          attendance: [
            { playerId: 'p1', present: true },
            { playerId: 'p2', present: true }
          ],
          matches: [
            {
              player1Id: 'p1',
              player2Id: 'p2',
              player1PlayingHandicap: null,
              player2PlayingHandicap: null,
              player2ScorecardOnly: false,
              strokeWinnerId: null,
              matchPlayWinnerId: null,
              matchPlayLeadBy: null
            }
          ]
        })
      ],
      players
    )

    // No result recorded yet, so the matched players earn nothing from the match itself,
    // but they are not "unpaired" so they get no attendance point here either.
    expect(totals.get('p1')?.totalPoints).toBe(0)
    expect(totals.get('p2')?.totalPoints).toBe(0)
  })

  it('gives an attendance point to checked-in players who were never paired', () => {
    const totals = accumulatePoints(
      [
        week({
          attendance: [
            { playerId: 'p1', present: true },
            { playerId: 'p2', present: true },
            { playerId: 'p3', present: true }
          ],
          matches: [
            {
              player1Id: 'p1',
              player2Id: 'p2',
              player1PlayingHandicap: null,
              player2PlayingHandicap: null,
              player2ScorecardOnly: false,
              strokeWinnerId: null,
              matchPlayWinnerId: null,
              matchPlayLeadBy: 0
            }
          ]
        })
      ],
      players
    )

    expect(totals.get('p3')).toMatchObject({ totalPoints: 1, attendancePoints: 1 })
  })

  it('adds CTP and LP wins and sums across multiple weeks', () => {
    const totals = accumulatePoints(
      [
        week({ ctpWinnerId: 'p1', longestPuttWinnerId: 'p2' }),
        week({ ctpWinnerId: 'p1' })
      ],
      players
    )

    expect(totals.get('p1')).toMatchObject({ totalPoints: 2, ctpWins: 2, lpWins: 0 })
    expect(totals.get('p2')).toMatchObject({ totalPoints: 1, ctpWins: 0, lpWins: 1 })
  })
})

describe('mergeSeasonTotals', () => {
  it('adds point buckets from two season total maps', () => {
    const spring = accumulatePoints(
      [
        week({
          attendance: [{ playerId: 'p1', present: true }],
          ctpWinnerId: 'p1'
        })
      ],
      players
    )
    const summer = accumulatePoints(
      [
        week({
          attendance: [{ playerId: 'p1', present: true }],
          longestPuttWinnerId: 'p1'
        })
      ],
      players
    )

    expect(mergeSeasonTotals(spring, summer).get('p1')).toMatchObject({
      totalPoints: 4,
      attendancePoints: 2,
      ctpWins: 1,
      lpWins: 1
    })
  })
})

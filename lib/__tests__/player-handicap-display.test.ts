import { describe, expect, it } from 'vitest'
import { getPlayerHandicapDisplay, getPlayerHandicapInlineLabel } from '@/lib/player-handicap-display'

const records = (differentials: number[]) =>
  differentials.map((courseDifferential) => ({ courseDifferential }))

describe('player handicap display helpers', () => {
  it('displays record-based handicap indexes as whole numbers', () => {
    expect(
      getPlayerHandicapDisplay({
        seedHandicap: null,
        handicapRecords: records([
          5.814563106796117,
          6.210687022900766,
          6.911650485436894,
          7.050826446280989,
          8,
          9,
          10,
          11,
          12,
          13,
          14,
          15,
          16
        ])
      })
    ).toEqual({ kind: 'HCP', value: '6' })

    expect(
      getPlayerHandicapInlineLabel({
        seedHandicap: null,
        handicapRecords: records([
          15.93114754098361,
          16.327542372881354,
          16.89175257731959,
          16.89175257731959,
          18,
          19,
          20,
          21,
          22,
          23,
          24,
          25,
          26
        ])
      })
    ).toBe('17')
  })

  it('displays seeded and new players without tenths', () => {
    expect(getPlayerHandicapDisplay({ seedHandicap: 16.5, handicapRecords: [] })).toEqual({
      kind: 'EST',
      value: '17'
    })
    expect(getPlayerHandicapInlineLabel({ seedHandicap: null, handicapRecords: [] })).toBe('NEW')
  })
})

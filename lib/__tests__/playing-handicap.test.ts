import { describe, expect, it } from 'vitest'
import { getHandicapModeLabel, getPlayingHandicap, getPlayerHandicapIndexValue } from '@/lib/playing-handicap'

describe('playing handicap helpers', () => {
  it('uses rounded index when the week basis is index', () => {
    expect(
      getPlayingHandicap('index', 8.4, {
        nineHoleSlope: 128,
        nineHoleRating: 35.2,
        nineHolePar: 36
      })
    ).toBe(8)
  })

  it('uses course handicap when the week basis is course handicap', () => {
    expect(
      getPlayingHandicap('course', 8.4, {
        nineHoleSlope: 128,
        nineHoleRating: 35.2,
        nineHolePar: 36
      })
    ).toBe(9)
  })

  it('falls back to rounded index when no tee data is available', () => {
    expect(getPlayingHandicap('course', 8.4, null)).toBe(8)
  })

  it('builds a current handicap index from handicap records or seed values', () => {
    expect(
      getPlayerHandicapIndexValue({
        seedHandicap: 11.2,
        handicapRecords: [{ courseDifferential: 9.8 }, { courseDifferential: 11.4 }, { courseDifferential: 10.6 }]
      })
    ).toBeCloseTo(7.8, 1)

    expect(
      getPlayerHandicapIndexValue({
        seedHandicap: 11.2,
        handicapRecords: []
      })
    ).toBe(11.2)
  })

  it('uses exact record-based index values before whole-number playing handicap rounding', () => {
    const troyIndex = getPlayerHandicapIndexValue({
      seedHandicap: null,
      handicapRecords: [
        { courseDifferential: 5.814563106796117 },
        { courseDifferential: 6.210687022900766 },
        { courseDifferential: 6.911650485436894 },
        { courseDifferential: 7.050826446280989 },
        { courseDifferential: 8 },
        { courseDifferential: 9 },
        { courseDifferential: 10 },
        { courseDifferential: 11 },
        { courseDifferential: 12 },
        { courseDifferential: 13 },
        { courseDifferential: 14 },
        { courseDifferential: 15 },
        { courseDifferential: 16 }
      ]
    })
    const geraldineIndex = getPlayerHandicapIndexValue({
      seedHandicap: null,
      handicapRecords: [
        { courseDifferential: 5.0960784313725505 },
        { courseDifferential: 6.203921568627453 },
        { courseDifferential: 11.067010309278352 },
        { courseDifferential: 12 },
        { courseDifferential: 13 },
        { courseDifferential: 14 },
        { courseDifferential: 15 },
        { courseDifferential: 16 },
        { courseDifferential: 17 },
        { courseDifferential: 18 }
      ]
    })
    const judyIndex = getPlayerHandicapIndexValue({
      seedHandicap: null,
      handicapRecords: [
        { courseDifferential: 15.93114754098361 },
        { courseDifferential: 16.327542372881354 },
        { courseDifferential: 16.89175257731959 },
        { courseDifferential: 16.89175257731959 },
        { courseDifferential: 18 },
        { courseDifferential: 19 },
        { courseDifferential: 20 },
        { courseDifferential: 21 },
        { courseDifferential: 22 },
        { courseDifferential: 23 },
        { courseDifferential: 24 },
        { courseDifferential: 25 },
        { courseDifferential: 26 }
      ]
    })

    expect(troyIndex).toBeCloseTo(6.4969, 4)
    expect(geraldineIndex).toBeCloseTo(7.4557, 4)
    expect(judyIndex).toBeCloseTo(16.5105, 4)
    expect(getPlayingHandicap('index', troyIndex, null)).toBe(6)
    expect(getPlayingHandicap('index', geraldineIndex, null)).toBe(7)
    expect(getPlayingHandicap('index', judyIndex, null)).toBe(17)
  })

  it('returns friendly labels for the commissioner UI', () => {
    expect(getHandicapModeLabel('index')).toBe('Index')
    expect(getHandicapModeLabel('course')).toBe('Course Handicap')
  })
})

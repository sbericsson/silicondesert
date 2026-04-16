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
    ).toBe(7.8)

    expect(
      getPlayerHandicapIndexValue({
        seedHandicap: 11.2,
        handicapRecords: []
      })
    ).toBe(11.2)
  })

  it('returns friendly labels for the commissioner UI', () => {
    expect(getHandicapModeLabel('index')).toBe('Index')
    expect(getHandicapModeLabel('course')).toBe('Course Handicap')
  })
})

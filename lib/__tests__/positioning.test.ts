import { describe, expect, it } from 'vitest'
import { getPositioningBasis } from '@/lib/positioning'

const weeks = [1, 2, 3, 4, 5, 6]

describe('getPositioningBasis', () => {
  it('marks the last spring week as a spring positioning round', () => {
    expect(
      getPositioningBasis({ seasonType: 'spring', weekNumber: 6, seasonWeekNumbers: weeks })
    ).toBe('spring')
  })

  it('does not mark earlier spring weeks', () => {
    expect(
      getPositioningBasis({ seasonType: 'spring', weekNumber: 5, seasonWeekNumbers: weeks })
    ).toBeNull()
  })

  it('marks the 2nd-to-last summer week as a summer positioning round', () => {
    expect(
      getPositioningBasis({ seasonType: 'summer', weekNumber: 5, seasonWeekNumbers: weeks })
    ).toBe('summer')
  })

  it('marks the last summer week as an overall positioning round', () => {
    expect(
      getPositioningBasis({ seasonType: 'summer', weekNumber: 6, seasonWeekNumbers: weeks })
    ).toBe('overall')
  })

  it('does not mark earlier summer weeks', () => {
    expect(
      getPositioningBasis({ seasonType: 'summer', weekNumber: 4, seasonWeekNumbers: weeks })
    ).toBeNull()
  })

  it('handles non-contiguous week numbers by using max/second-max', () => {
    expect(
      getPositioningBasis({ seasonType: 'summer', weekNumber: 12, seasonWeekNumbers: [3, 7, 12] })
    ).toBe('overall')
    expect(
      getPositioningBasis({ seasonType: 'summer', weekNumber: 7, seasonWeekNumbers: [3, 7, 12] })
    ).toBe('summer')
  })

  it('returns null when the season has no weeks', () => {
    expect(
      getPositioningBasis({ seasonType: 'spring', weekNumber: 1, seasonWeekNumbers: [] })
    ).toBeNull()
  })
})

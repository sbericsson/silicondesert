import { describe, expect, it } from 'vitest'
import { computeWeekAdjacency } from '@/lib/public-week'

const weeks = [
  { id: 'w1', weekNumber: 1, publicPath: '/public/weeks/2026-07-17' },
  { id: 'w2', weekNumber: 2, publicPath: '/public/weeks/2026-07-24' },
  { id: 'w3', weekNumber: 3, publicPath: '/public/weeks/2026-07-31' }
]

describe('computeWeekAdjacency', () => {
  it('returns correct adjacency for the first week', () => {
    expect(computeWeekAdjacency(weeks, 'w1')).toEqual({
      prevWeekPath: null,
      nextWeekPath: '/public/weeks/2026-07-24',
      isLatest: false,
      position: 1,
      totalPublished: 3
    })
  })

  it('returns correct adjacency for a middle week', () => {
    expect(computeWeekAdjacency(weeks, 'w2')).toEqual({
      prevWeekPath: '/public/weeks/2026-07-17',
      nextWeekPath: '/public/weeks/2026-07-31',
      isLatest: false,
      position: 2,
      totalPublished: 3
    })
  })

  it('returns correct adjacency for the last week (isLatest)', () => {
    expect(computeWeekAdjacency(weeks, 'w3')).toEqual({
      prevWeekPath: '/public/weeks/2026-07-24',
      nextWeekPath: null,
      isLatest: true,
      position: 3,
      totalPublished: 3
    })
  })

  it('returns null adjacency when weekId is not found', () => {
    expect(computeWeekAdjacency(weeks, 'w99')).toEqual({
      prevWeekPath: null,
      nextWeekPath: null,
      isLatest: false,
      position: 0,
      totalPublished: 3
    })
  })

  it('handles a single-week list', () => {
    expect(
      computeWeekAdjacency(
        [{ id: 'w1', weekNumber: 1, publicPath: '/public/weeks/2026-07-31' }],
        'w1'
      )
    ).toEqual({
      prevWeekPath: null,
      nextWeekPath: null,
      isLatest: true,
      position: 1,
      totalPublished: 1
    })
  })
})

import { describe, expect, it } from 'vitest'
import { computeWeekAdjacency } from '@/lib/public-week'

const weeks = [
  { id: 'w1', weekNumber: 1 },
  { id: 'w2', weekNumber: 2 },
  { id: 'w3', weekNumber: 3 }
]

describe('computeWeekAdjacency', () => {
  it('returns correct adjacency for the first week', () => {
    expect(computeWeekAdjacency(weeks, 'w1')).toEqual({
      prevWeekId: null,
      nextWeekId: 'w2',
      isLatest: false,
      position: 1,
      totalPublished: 3
    })
  })

  it('returns correct adjacency for a middle week', () => {
    expect(computeWeekAdjacency(weeks, 'w2')).toEqual({
      prevWeekId: 'w1',
      nextWeekId: 'w3',
      isLatest: false,
      position: 2,
      totalPublished: 3
    })
  })

  it('returns correct adjacency for the last week (isLatest)', () => {
    expect(computeWeekAdjacency(weeks, 'w3')).toEqual({
      prevWeekId: 'w2',
      nextWeekId: null,
      isLatest: true,
      position: 3,
      totalPublished: 3
    })
  })

  it('returns null adjacency when weekId is not found', () => {
    expect(computeWeekAdjacency(weeks, 'w99')).toEqual({
      prevWeekId: null,
      nextWeekId: null,
      isLatest: false,
      position: 0,
      totalPublished: 3
    })
  })

  it('handles a single-week list', () => {
    expect(computeWeekAdjacency([{ id: 'w1', weekNumber: 1 }], 'w1')).toEqual({
      prevWeekId: null,
      nextWeekId: null,
      isLatest: true,
      position: 1,
      totalPublished: 1
    })
  })
})

import { describe, expect, it } from 'vitest'
import {
  getComparisonSortKey,
  getComparisonValueClass,
  type ComparisonSortKey
} from '@/lib/public-standings'

const columns: ComparisonSortKey[] = ['overallPoints', 'summerPoints', 'springPoints']

describe('comparison standings sort emphasis', () => {
  it.each(columns)('only emphasizes the active comparison column when sorting by %s', (sortKey) => {
    for (const columnKey of columns) {
      expect(getComparisonValueClass(columnKey, sortKey)).toBe(
        columnKey === sortKey ? 'font-semibold' : ''
      )
    }
  })

  it('uses the overall column for single-season and unmatched seasons', () => {
    expect(
      getComparisonSortKey({
        targetSeasonId: 'season-1',
        springSeasonId: 'spring-1',
        summerSeasonId: 'summer-1',
        multiSeason: false
      })
    ).toBe('overallPoints')

    expect(
      getComparisonSortKey({
        targetSeasonId: 'season-1',
        springSeasonId: 'spring-1',
        summerSeasonId: 'summer-1',
        multiSeason: true
      })
    ).toBe('overallPoints')
  })

  it('maps multi-season spring and summer weeks to their season columns', () => {
    expect(
      getComparisonSortKey({
        targetSeasonId: 'spring-1',
        springSeasonId: 'spring-1',
        summerSeasonId: 'summer-1',
        multiSeason: true
      })
    ).toBe('springPoints')

    expect(
      getComparisonSortKey({
        targetSeasonId: 'summer-1',
        springSeasonId: 'spring-1',
        summerSeasonId: 'summer-1',
        multiSeason: true
      })
    ).toBe('summerPoints')
  })
})

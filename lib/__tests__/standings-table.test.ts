import { describe, expect, it } from 'vitest'
import { getStandingValueClass } from '@/components/standings-table'

const numericKeys = [
  'springPoints',
  'summerPoints',
  'overallPoints',
  'attendancePoints',
  'strokePoints',
  'matchPlayPoints',
  'ctpWins',
  'lpWins'
] as const

describe('getStandingValueClass', () => {
  it.each(numericKeys)('only emphasizes the active sort column when sorting by %s', (sortKey) => {
    for (const columnKey of numericKeys) {
      expect(getStandingValueClass(columnKey, sortKey)).toBe(
        columnKey === sortKey ? 'font-semibold text-text-primary' : 'text-text-primary'
      )
    }
  })
})

import { describe, expect, it } from 'vitest'
import { sortUniqueWeekDates } from '@/lib/seasons'

describe('season helpers', () => {
  it('sorts and deduplicates week dates', () => {
    const result = sortUniqueWeekDates(['2026-04-18', '2026-04-04', '2026-04-18'])

    expect(result.map((date) => date.toISOString().slice(0, 10))).toEqual([
      '2026-04-04',
      '2026-04-18'
    ])
  })
})

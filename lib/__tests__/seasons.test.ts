import { describe, expect, it } from 'vitest'
import { findPrecedingSpringSeason, resolveSeasonPair, sortUniqueWeekDates } from '@/lib/seasons'

const season = (
  id: string,
  type: 'spring' | 'summer',
  startDate: string,
  archivedAt: string | null = null
) => ({
  id,
  type,
  startDate: new Date(`${startDate}T00:00:00-07:00`),
  archivedAt: archivedAt ? new Date(`${archivedAt}T00:00:00-07:00`) : null
})

describe('season helpers', () => {
  it('sorts and deduplicates week dates', () => {
    const result = sortUniqueWeekDates(['2026-04-18', '2026-04-04', '2026-04-18'])

    expect(result.map((date) => date.toISOString().slice(0, 10))).toEqual([
      '2026-04-04',
      '2026-04-18'
    ])
  })

  it('resolves the most recent non-archived spring and summer seasons', () => {
    const { spring, summer } = resolveSeasonPair([
      season('spring-2025', 'spring', '2025-03-01', '2025-09-01'),
      season('spring-2026', 'spring', '2026-03-01'),
      season('summer-2026', 'summer', '2026-06-01')
    ])

    expect(spring?.id).toBe('spring-2026')
    expect(summer?.id).toBe('summer-2026')
  })

  it('returns no summer when only spring is active', () => {
    const { spring, summer } = resolveSeasonPair([season('spring-2026', 'spring', '2026-03-01')])
    expect(spring?.id).toBe('spring-2026')
    expect(summer).toBeNull()
  })

  it('finds the spring season immediately preceding a summer season', () => {
    const seasons = [
      season('spring-2025', 'spring', '2025-03-01'),
      season('spring-2026', 'spring', '2026-03-01'),
      season('summer-2026', 'summer', '2026-06-01')
    ]

    expect(findPrecedingSpringSeason(seasons, new Date('2026-06-01T00:00:00-07:00'))?.id).toBe(
      'spring-2026'
    )
  })
})

import { describe, expect, it } from 'vitest'
import {
  buildPublicWeekMatchPath,
  buildPublicWeekPath,
  buildPublicWeekPrintPath,
  getPublicWeekDateRange,
  getPublicWeekDateSlug
} from '@/lib/public-week-url'

describe('public week URLs', () => {
  it('uses the Phoenix calendar date as the public slug', () => {
    const lateFridayInPhoenix = new Date('2026-08-01T06:30:00.000Z')

    expect(getPublicWeekDateSlug(lateFridayInPhoenix)).toBe('2026-07-31')
    expect(buildPublicWeekPath(lateFridayInPhoenix)).toBe('/public/weeks/2026-07-31')
    expect(buildPublicWeekPrintPath(lateFridayInPhoenix)).toBe('/public/weeks/2026-07-31/print')
    expect(buildPublicWeekMatchPath(lateFridayInPhoenix, 'match/one')).toBe(
      '/public/weeks/2026-07-31/matches/match%2Fone'
    )
  })

  it('parses a valid date slug into Phoenix day boundaries', () => {
    const range = getPublicWeekDateRange('2026-07-31')

    expect(range?.start.toISOString()).toBe('2026-07-31T07:00:00.000Z')
    expect(range?.end.toISOString()).toBe('2026-08-01T07:00:00.000Z')
  })

  it.each(['2026-7-31', '07-31-2026', '2026-02-30', '2026-13-01', 'week-123'])(
    'rejects noncanonical or invalid date slug %s',
    (value) => {
      expect(getPublicWeekDateRange(value)).toBeNull()
    }
  )
})

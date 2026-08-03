import { getPhoenixDateParts } from '@/lib/phoenix-time'

const PUBLIC_WEEK_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const PHOENIX_UTC_OFFSET = '-07:00'

export function getPublicWeekDateSlug(date: Date) {
  return getPhoenixDateParts(date).isoDate
}

export function getPublicWeekDateRange(value: string) {
  if (!PUBLIC_WEEK_DATE_PATTERN.test(value)) {
    return null
  }

  const start = new Date(`${value}T00:00:00${PHOENIX_UTC_OFFSET}`)
  if (Number.isNaN(start.getTime()) || getPublicWeekDateSlug(start) !== value) {
    return null
  }

  return {
    start,
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000)
  }
}

export function buildPublicWeekPath(date: Date) {
  return `/public/weeks/${getPublicWeekDateSlug(date)}`
}

export function buildPublicWeekPrintPath(date: Date) {
  return `${buildPublicWeekPath(date)}/print`
}

export function buildPublicWeekMatchPath(date: Date, matchId: string) {
  return `${buildPublicWeekPath(date)}/matches/${encodeURIComponent(matchId)}`
}

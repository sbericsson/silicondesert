export function parsePhoenixDate(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const date = new Date(`${value}T00:00:00-07:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

export function sortUniqueWeekDates(values: unknown[]) {
  const parsedDates = values
    .map((value) => parsePhoenixDate(value))
    .filter((value): value is Date => Boolean(value))

  return [...new Map(parsedDates.map((date) => [date.toISOString().slice(0, 10), date])).values()].sort(
    (a, b) => a.getTime() - b.getTime()
  )
}

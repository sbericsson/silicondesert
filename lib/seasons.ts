import type { SeasonType } from '@prisma/client'

type SeasonLike = {
  type: SeasonType
  startDate: Date
  archivedAt: Date | null
}

// Resolves the current Spring/Summer pair from a list of seasons: the most recent
// non-archived season of each type. When both are present the standings switch to the
// Spring/Summer/Overall column layout.
export function resolveSeasonPair<T extends SeasonLike>(seasons: T[]): {
  spring: T | null
  summer: T | null
} {
  const byStartDesc = seasons
    .filter((season) => season.archivedAt === null)
    .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())

  return {
    spring: byStartDesc.find((season) => season.type === 'spring') ?? null,
    summer: byStartDesc.find((season) => season.type === 'summer') ?? null
  }
}

// The most recent non-archived Spring season that started before the given Summer
// season — used to compute the combined "overall" ranking for the final Summer round.
export function findPrecedingSpringSeason<T extends SeasonLike>(
  seasons: T[],
  summerStartDate: Date
): T | null {
  return (
    seasons
      .filter(
        (season) =>
          season.archivedAt === null &&
          season.type === 'spring' &&
          season.startDate.getTime() < summerStartDate.getTime()
      )
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())[0] ?? null
  )
}

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

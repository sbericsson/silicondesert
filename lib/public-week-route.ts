import { prisma } from '@/lib/db'
import {
  buildPublicWeekPath,
  getPublicWeekDateRange,
  getPublicWeekDateSlug
} from '@/lib/public-week-url'

export type PublicWeekRouteRef = {
  id: string
  date: Date
  dateSlug: string
  publicPath: string
}

function toPublicWeekRouteRef(week: { id: string; date: Date }): PublicWeekRouteRef {
  return {
    id: week.id,
    date: week.date,
    dateSlug: getPublicWeekDateSlug(week.date),
    publicPath: buildPublicWeekPath(week.date)
  }
}

export async function resolvePublicWeekRouteParam(value: string): Promise<PublicWeekRouteRef | null> {
  if (!process.env.DATABASE_URL) {
    return null
  }

  const dateRange = getPublicWeekDateRange(value)

  if (dateRange) {
    const weeks = await prisma.week.findMany({
      where: {
        date: {
          gte: dateRange.start,
          lt: dateRange.end
        }
      },
      orderBy: { id: 'asc' },
      take: 2,
      select: {
        id: true,
        date: true
      }
    })

    return weeks.length === 1 ? toPublicWeekRouteRef(weeks[0]) : null
  }

  const week = await prisma.week.findUnique({
    where: { id: value },
    select: {
      id: true,
      date: true
    }
  })

  return week ? toPublicWeekRouteRef(week) : null
}

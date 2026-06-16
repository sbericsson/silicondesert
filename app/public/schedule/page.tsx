import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getPhoenixDateParts } from '@/lib/phoenix-time'
import { formatDate, getCurrentWeekRecord, pickActiveSeason } from '@/lib/week'
import { getLatestPublishedWeekId } from '@/lib/public-week'
import { STATUS_CHIP_CLASSES, getScheduleWeekStatusTone } from '@/lib/week-status'
import { PublicPageHeader } from '@/components/public-page-header'

export const revalidate = 60
export const dynamic = 'force-dynamic'

function getScheduleWeekStatus(
  week: { matches: Array<{ matchPlayLeadBy: number | null }>; locked: boolean; date: Date },
  isToday: boolean,
  isoDate: string
): { label: string; tone: ReturnType<typeof getScheduleWeekStatusTone> } {
  const weekIsoDate = week.date.toISOString().slice(0, 10)
  const completed = week.matches.length > 0 && week.matches.every((m) => m.matchPlayLeadBy !== null)
  const inProgress = week.locked && !completed

  const label = completed
    ? 'Final'
    : inProgress
      ? 'In progress'
      : isToday
        ? 'Today'
        : weekIsoDate > isoDate
          ? 'Upcoming'
          : week.locked
            ? 'Locked'
            : 'Open'

  return { label, tone: getScheduleWeekStatusTone(label) }
}

export default async function PublicSchedulePage() {
  if (!process.env.DATABASE_URL) {
    return (
      <section className="space-y-4">
        <div className="rounded-2xl border border-surface-border bg-surface-elevated p-5 text-sm text-text-secondary shadow-sm">
          Season schedule coming soon.
        </div>
      </section>
    )
  }

  const { isoDate } = getPhoenixDateParts()

  const [currentWeek, seasons, latestPublishedWeekId] = await Promise.all([
    getCurrentWeekRecord(),
    prisma.season.findMany({
      where: { archivedAt: null },
      include: {
        weeks: {
          include: {
            course: true,
            matches: true
          },
          orderBy: { date: 'asc' }
        }
      },
      orderBy: { startDate: 'asc' }
    }),
    getLatestPublishedWeekId()
  ])

  const season = pickActiveSeason(seasons, currentWeek?.seasonId)

  if (!season) {
    return (
      <section className="space-y-4">
        <div className="rounded-2xl border border-surface-border bg-surface-elevated p-5 text-sm text-text-secondary shadow-sm">
          Season schedule coming soon.
        </div>
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <PublicPageHeader
        eyebrow="Schedule"
        title={season.name}
        subtitle={`${formatDate(season.startDate)} – ${formatDate(season.endDate)}`}
      >
        <div className="mt-4 rounded-2xl border border-surface-border bg-surface-base px-4 py-3 text-sm text-text-secondary">
          Completed weeks link to their public results page as soon as pairings are locked.
        </div>
      </PublicPageHeader>

      <div className="space-y-2.5">
        {season.weeks.map((week) => {
          const weekIsoDate = week.date.toISOString().slice(0, 10)
          const isToday = weekIsoDate === isoDate
          const isLatestPublished = week.id === latestPublishedWeekId
          const { label: statusLabel, tone } = getScheduleWeekStatus(week, isToday, isoDate)

          const cardClass = isToday
            ? 'border-accent bg-accent-dim'
            : 'border-surface-border bg-surface-elevated hover:border-accent/40'

          const content = (
            <div className={`rounded-2xl border p-4 shadow-sm ${cardClass}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
                    Week {week.weekNumber}
                  </p>
                  <h3 className="font-condensed mt-1 text-xl font-bold uppercase tracking-wide text-text-primary">
                    {formatDate(week.date)}
                  </h3>
                  <p className="mt-0.5 text-sm text-text-secondary">
                    {week.course?.name ?? 'Course not selected'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className={`font-condensed rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${STATUS_CHIP_CLASSES[tone]}`}>
                    {statusLabel}
                  </span>
                  {isLatestPublished ? (
                    <span className="font-condensed rounded-full bg-accent-dim px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-widest text-accent-text">
                      Latest
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          )

          return week.locked ? (
            <Link key={week.id} href={`/public/weeks/${week.id}`} className="block">
              {content}
            </Link>
          ) : (
            <div key={week.id}>{content}</div>
          )
        })}
      </div>
    </section>
  )
}

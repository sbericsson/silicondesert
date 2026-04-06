import Link from 'next/link'
import { prisma } from '@/lib/db'
import { getPhoenixDateParts } from '@/lib/phoenix-time'
import { getCurrentWeekRecord, pickActiveSeason } from '@/lib/week'

export const revalidate = 60

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date)
}

function getStatusStyles(status: string) {
  if (status === 'Completed') {
    return 'bg-accent-dim text-accent-text'
  }

  if (status === 'Scores in progress' || status === 'Today') {
    return 'bg-warning-dim text-warning-text'
  }

  return 'bg-surface-base text-text-secondary'
}

export default async function PublicSchedulePage() {
  if (!process.env.DATABASE_URL) {
    return (
      <section className="space-y-4">
        <div className="rounded-2xl border border-surface-border bg-surface-elevated p-6 text-sm text-text-secondary shadow-sm">
          Season schedule coming soon.
        </div>
      </section>
    )
  }

  const [currentWeek, seasons] = await Promise.all([
    getCurrentWeekRecord(),
    prisma.season.findMany({
      where: {
        archivedAt: null
      },
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
    })
  ])

  const season = pickActiveSeason(seasons, currentWeek?.seasonId)

  if (!season) {
    return (
      <section className="space-y-4">
        <div className="rounded-2xl border border-surface-border bg-surface-elevated p-6 text-sm text-text-secondary shadow-sm">
          Season schedule coming soon.
        </div>
      </section>
    )
  }

  const { isoDate } = getPhoenixDateParts()

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-surface-border bg-surface-elevated p-6 shadow-sm">
        <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
          Schedule
        </p>
        <h2 className="font-condensed mt-2 text-2xl font-bold uppercase tracking-wide text-text-primary">{season.name}</h2>
        <p className="mt-2 text-sm text-text-secondary">
          {formatDate(season.startDate)} - {formatDate(season.endDate)}
        </p>
        <div className="mt-4 rounded-2xl border border-surface-border bg-surface-base px-4 py-3 text-sm text-text-secondary">
          Completed weeks link to their public results page as soon as pairings are locked.
        </div>
      </div>

      <div className="space-y-3">
        {season.weeks.map((week) => {
          const weekIsoDate = week.date.toISOString().slice(0, 10)
          const completed = week.matches.length > 0 && week.matches.every((match) => match.matchPlayLeadBy !== null)
          const inProgress = week.locked && !completed
          const isToday = weekIsoDate === isoDate
          const status = completed
            ? 'Completed'
            : inProgress
              ? 'Scores in progress'
              : isToday
                ? 'Today'
                : weekIsoDate > isoDate
                  ? 'Upcoming'
                  : week.locked
                    ? 'Locked'
                    : 'Open'

          const cardClass = isToday
            ? 'border-accent bg-accent-dim'
            : 'border-surface-border bg-surface-elevated hover:border-accent/40'

          const content = (
            <div className={`rounded-2xl border p-5 shadow-sm ${cardClass}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
                    Week {week.weekNumber}
                  </p>
                  <h3 className="font-condensed mt-1 text-xl font-bold uppercase tracking-wide text-text-primary">{formatDate(week.date)}</h3>
                  <p className="mt-1 text-sm text-text-secondary">
                    {week.course?.name ?? 'Course not selected'}
                  </p>
                </div>
                <span className={`font-condensed rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-widest ${getStatusStyles(status)}`}>
                  {status}
                </span>
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

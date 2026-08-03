import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, permanentRedirect } from 'next/navigation'
import { getPublicWeekData, getPublicWeekNav } from '@/lib/public-week'
import { resolvePublicWeekRouteParam } from '@/lib/public-week-route'
import { getWeekStatusChip, STATUS_CHIP_CLASSES, STATUS_DOT_CLASSES } from '@/lib/week-status'
import { WeekStepper } from '@/components/week-stepper'

export const revalidate = 60
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params
}: {
  params: { id: string }
}): Promise<Metadata> {
  const weekRef = await resolvePublicWeekRouteParam(params.id)
  const data = weekRef ? await getPublicWeekData(weekRef.id) : null

  if (!data) {
    return {
      title: 'Week Results - Silicon Desert Golf League'
    }
  }

  return {
    title: `Week ${data.weekNumber} Results - Silicon Desert Golf`,
    description: `${data.courseName} - ${data.dateLabel}`,
    openGraph: {
      title: `Week ${data.weekNumber} Results - Silicon Desert Golf`,
      description:
        data.allScoresComplete && data.ctpWinnerName
          ? `${data.matchCount} matches played at ${data.courseName} - CTP: ${data.ctpWinnerName}`
          : `${data.courseName} - ${data.dateLabel}`,
      type: 'website'
    }
  }
}

function PublicMatchCard({
  weekPath,
  match,
  resultsVisible,
  pairingsVisible
}: {
  weekPath: string
  match: NonNullable<Awaited<ReturnType<typeof getPublicWeekData>>>['matches'][number]
  resultsVisible: boolean
  pairingsVisible: boolean
}) {
  const winnerId: 'p1' | 'p2' | null =
    match.player1Points !== null && match.player2Points !== null
      ? match.player1Points > match.player2Points
        ? 'p1'
        : match.player2Points > match.player1Points
          ? 'p2'
          : null
      : null

  const cardClassName =
    'block rounded-2xl border border-surface-border bg-surface-elevated p-4 shadow-sm transition hover:border-accent hover:bg-surface-base'

  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
          {match.label}
        </p>
        <div className="flex items-center gap-2">
          {match.isThreesome ? (
            <span className="rounded-full bg-surface-sunken px-2 py-0.5 font-condensed text-[11px] font-semibold uppercase tracking-widest text-text-secondary">
              Threesome
            </span>
          ) : null}
          {resultsVisible ? (
            <span className="font-condensed text-[11px] font-semibold uppercase tracking-widest text-accent-text">
              Hole-by-hole ›
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="flex items-center gap-2">
          {resultsVisible ? (
            <span className={`shrink-0 text-sm font-bold text-accent-text ${winnerId === 'p1' ? 'visible' : 'invisible'}`}>
              ✓
            </span>
          ) : null}
          <p className={`flex-1 font-condensed text-[15px] font-semibold uppercase ${
            resultsVisible
              ? winnerId === 'p1'
                ? 'text-text-primary'
                : 'text-text-secondary'
              : 'text-text-primary'
          }`}>
            {match.player1Name}
          </p>
          {resultsVisible ? (
            <p className={`font-condensed text-[15px] font-bold tabular-nums ${
              winnerId === 'p1' ? 'text-accent-text' : 'text-text-secondary'
            }`}>
              {match.player1Points} pts
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {resultsVisible ? (
            <span className={`shrink-0 text-sm font-bold text-accent-text ${winnerId === 'p2' ? 'visible' : 'invisible'}`}>
              ✓
            </span>
          ) : null}
          <p className={`flex-1 font-condensed text-[15px] font-semibold uppercase ${
            resultsVisible
              ? winnerId === 'p2'
                ? 'text-text-primary'
                : 'text-text-secondary'
              : 'text-text-primary'
          }`}>
            {match.player2Name}
          </p>
          {resultsVisible ? (
            <p className={`font-condensed text-[15px] font-bold tabular-nums ${
              winnerId === 'p2' ? 'text-accent-text' : 'text-text-secondary'
            }`}>
              {match.player2Points} pts
            </p>
          ) : null}
        </div>
      </div>

      {resultsVisible ? (
        <div className="mt-3 border-t border-surface-border pt-2.5">
          <p className="text-xs text-text-secondary">
            Stroke: {match.strokeSummary} · Match: {match.matchPlaySummary}
          </p>
        </div>
      ) : pairingsVisible ? (
        <p className="mt-3 text-sm text-text-secondary">
          Pairings are locked. Scores will appear here after all matches are submitted.
        </p>
      ) : (
        <p className="mt-3 text-sm text-text-secondary">
          Pairings are not public yet.
        </p>
      )}
    </>
  )

  if (resultsVisible) {
    return (
      <Link href={`${weekPath}/matches/${match.id}`} className={cardClassName}>
        {content}
      </Link>
    )
  }

  return <article className={cardClassName}>{content}</article>
}

export default async function PublicWeekDetailPage({
  params
}: {
  params: { id: string }
}) {
  const weekRef = await resolvePublicWeekRouteParam(params.id)

  if (!weekRef) {
    notFound()
  }

  if (params.id !== weekRef.dateSlug) {
    permanentRedirect(weekRef.publicPath)
  }

  const [data, nav] = await Promise.all([
    getPublicWeekData(weekRef.id),
    getPublicWeekNav(weekRef.id)
  ])

  if (!data) {
    notFound()
  }

  const status = getWeekStatusChip({ locked: data.locked, allScoresComplete: data.allScoresComplete })

  return (
    <section className="space-y-3">
      {/* Week identity card */}
      <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-elevated p-5 shadow-sm">
        <WeekStepper
          prevWeekPath={nav?.prevWeekPath ?? null}
          nextWeekPath={nav?.nextWeekPath ?? null}
        >
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className={`font-condensed rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-widest ${
              nav?.isLatest
                ? 'bg-accent-dim text-accent-text'
                : 'bg-surface-sunken text-text-secondary'
            }`}>
              {nav?.isLatest ? 'Latest' : 'Past week'}
            </span>
            <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-condensed text-[11px] font-semibold uppercase tracking-widest ${STATUS_CHIP_CLASSES[status.tone]}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLASSES[status.tone]}`} />
              {status.label}
            </span>
          </div>
        </WeekStepper>

        <h2 className="font-condensed mt-4 text-3xl font-bold uppercase tracking-wide text-text-primary">
          Week {data.weekNumber}
        </h2>
        <p className="mt-1 text-[15px] font-semibold text-accent-text">{data.dateLabelLong}</p>
        <p className="mt-0.5 text-sm text-text-secondary">
          {data.courseName} · {data.seasonName}
        </p>

        <div
          className="mt-4"
          role="progressbar"
          aria-valuenow={data.scoredMatchCount}
          aria-valuemin={0}
          aria-valuemax={data.matchCount}
          aria-label={`${data.scoredMatchCount} of ${data.matchCount} matches scored`}
        >
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: data.matchCount > 0 ? `${(data.scoredMatchCount / data.matchCount) * 100}%` : '0%' }}
            />
          </div>
          <p className="mt-1.5 text-xs text-text-secondary">
            {data.scoredMatchCount} of {data.matchCount} matches scored
          </p>
        </div>

        {nav && !nav.isLatest ? (
          <Link
            href="/public/week"
            className="mt-3 inline-flex font-condensed text-xs font-semibold uppercase tracking-widest text-accent-text hover:underline"
          >
            Jump to latest →
          </Link>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-text-secondary">
            Handicap basis: {data.handicapModeLabel}
          </p>
          {data.resultsVisible ? (
            <Link
              href={`${data.publicPath}/print`}
              className="font-condensed shrink-0 rounded-full border border-surface-border bg-surface-base px-4 py-2 text-xs font-semibold uppercase tracking-wide text-text-secondary shadow-sm hover:border-accent hover:text-accent-text"
            >
              Print
            </Link>
          ) : null}
        </div>
      </div>

      {data.resultsVisible && (data.ctpWinnerName || data.longestPuttWinnerName) ? (
        <section className="rounded-2xl border border-accent bg-accent-dim p-4">
          <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-accent-text">
            Side Games
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-surface-border bg-surface-base p-4">
              <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
                Closest To Pin
              </p>
              <p className="mt-2 text-sm font-medium text-text-primary">
                {data.ctpWinnerName
                  ? `${data.ctpWinnerName}${data.ctpHoleNumber ? ` · Hole ${data.ctpHoleNumber}` : ''}`
                  : 'Not recorded'}
              </p>
            </div>
            <div className="rounded-xl border border-surface-border bg-surface-base p-4">
              <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
                Longest Putt
              </p>
              <p className="mt-2 text-sm font-medium text-text-primary">
                {data.longestPuttWinnerName
                  ? `${data.longestPuttWinnerName}${data.longestPuttHoleNumber ? ` · Hole ${data.longestPuttHoleNumber}` : ''}`
                  : 'Not recorded'}
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="space-y-2.5">
        {data.matches.map((match) => (
          <PublicMatchCard
            key={match.id}
            weekPath={data.publicPath}
            match={match}
            resultsVisible={data.resultsVisible}
            pairingsVisible={data.pairingsVisible}
          />
        ))}
      </section>
    </section>
  )
}

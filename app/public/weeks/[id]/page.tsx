import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPublicWeekData } from '@/lib/public-week'

export const revalidate = 60
export const dynamic = 'force-dynamic'

function getStatusBanner(data: NonNullable<Awaited<ReturnType<typeof getPublicWeekData>>>) {
  if (!data.locked) {
    return {
      className: 'border-surface-border bg-surface-elevated text-text-secondary',
      text: `Pairings for Week ${data.weekNumber} will be available after check-in.`
    }
  }

  if (!data.allScoresComplete) {
    return {
      className: 'border-warning bg-warning-dim text-warning-text',
      text: `Scores in progress - ${data.scoredMatchCount} of ${data.matchCount} matches complete.`
    }
  }

  return {
    className: 'border-accent bg-accent-dim text-accent-text',
    text: `All ${data.matchCount} matches scored.`
  }
}

export async function generateMetadata({
  params
}: {
  params: { id: string }
}): Promise<Metadata> {
  const data = await getPublicWeekData(params.id)

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

export default async function PublicWeekDetailPage({
  params
}: {
  params: { id: string }
}) {
  const data = await getPublicWeekData(params.id)

  if (!data) {
    notFound()
  }

  const statusBanner = getStatusBanner(data)

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className={`flex-1 rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm ${statusBanner.className}`}>
          {statusBanner.text}
        </div>
        {data.resultsVisible ? (
          <Link
            href={`/public/weeks/${data.id}/print`}
            className="font-condensed shrink-0 rounded-full border border-surface-border bg-surface-elevated px-4 py-2 text-sm font-semibold uppercase tracking-wide text-text-secondary shadow-sm hover:border-accent hover:text-accent-text"
          >
            Print Results
          </Link>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-3xl border border-surface-border bg-surface-elevated p-6 shadow-sm">
        <p className="font-condensed text-xs font-bold uppercase tracking-widest text-accent-text">
          Week {data.weekNumber}
        </p>
        <h2 className="font-condensed mt-2 text-2xl font-bold uppercase tracking-wide text-text-primary">{data.seasonName}</h2>
        <p className="mt-2 text-sm text-text-secondary">
          {data.courseName} · {data.dateLabel}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-surface-border bg-surface-base p-4">
            <p className="font-condensed text-[11px] font-bold uppercase tracking-widest text-text-muted">
              Matches
            </p>
            <p className="font-condensed mt-2 text-2xl font-bold tabular-nums text-text-primary">{data.matchCount}</p>
          </div>
          <div className="rounded-2xl border border-surface-border bg-surface-base p-4">
            <p className="font-condensed text-[11px] font-bold uppercase tracking-widest text-text-muted">
              Scores In
            </p>
            <p className="font-condensed mt-2 text-2xl font-bold tabular-nums text-text-primary">{data.scoredMatchCount}</p>
          </div>
          <div className="rounded-2xl border border-surface-border bg-surface-base p-4">
            <p className="font-condensed text-[11px] font-bold uppercase tracking-widest text-text-muted">
              Status
            </p>
            <p className="mt-2 text-sm font-semibold text-text-primary">
              {data.allScoresComplete ? 'Final' : data.locked ? 'In Progress' : 'Not Public'}
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs text-text-secondary">
          Handicap basis: {data.handicapModeLabel}
        </p>
      </div>

      {data.resultsVisible && (data.ctpWinnerName || data.longestPuttWinnerName) ? (
        <section className="rounded-2xl border border-accent bg-accent-dim p-5">
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

      <section className="space-y-3">
        {data.matches.map((match) => (
          <article
            key={match.id}
            className="rounded-3xl border border-surface-border bg-surface-elevated p-5 shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
                {match.label}
              </p>
              {match.isThreesome ? (
                <span className="rounded-full bg-surface-sunken px-2 py-1 font-condensed text-[11px] font-semibold uppercase tracking-widest text-text-secondary">
                  Threesome
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-surface-border bg-surface-base px-4 py-3">
                <div>
                  <p className="font-condensed text-[15px] font-semibold uppercase text-text-primary">{match.player1Name}</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    Handicap {match.player1PlayingHandicap}
                  </p>
                </div>
                {data.resultsVisible ? (
                  <p className="text-[15px] font-bold text-text-primary">{match.player1Points} pts</p>
                ) : null}
              </div>
              <p className="font-condensed text-center text-xs font-bold uppercase tracking-widest text-text-muted">
                vs
              </p>
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-surface-border bg-surface-base px-4 py-3">
                <div>
                  <p className="font-condensed text-[15px] font-semibold uppercase text-text-primary">{match.player2Name}</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    Handicap {match.player2PlayingHandicap}
                  </p>
                </div>
                {data.resultsVisible ? (
                  <p className="text-[15px] font-bold text-text-primary">{match.player2Points} pts</p>
                ) : null}
              </div>
            </div>

            {data.resultsVisible ? (
              <div className="mt-4 rounded-2xl border border-surface-border bg-surface-base px-4 py-3 text-sm text-text-secondary">
                <p>Stroke: {match.strokeSummary}</p>
                <p className="mt-1">Match: {match.matchPlaySummary}</p>
              </div>
            ) : data.pairingsVisible ? (
              <p className="mt-4 text-sm text-text-secondary">
                Pairings are locked. Scores will appear here after all matches are submitted.
              </p>
            ) : (
              <p className="mt-4 text-sm text-text-secondary">
                Pairings are not public yet.
              </p>
            )}
          </article>
        ))}
      </section>
    </section>
  )
}

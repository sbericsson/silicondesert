import Link from 'next/link'
import { getHistoryPageData } from '@/lib/history'

export const dynamic = 'force-dynamic'

export default async function HistoryPage() {
  const data = await getHistoryPageData()

  return (
    <section className="space-y-4 px-4 py-6">
      <div className="rounded-xl border border-surface-border bg-surface-elevated p-4">
        <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
          History
        </p>
        <h2 className="font-condensed mt-2 text-2xl font-bold uppercase tracking-wide text-text-primary">Season Schedule</h2>
        <p className="mt-2 text-sm text-text-secondary">
          All scheduled weeks, match summaries, and results for the season.
        </p>
      </div>

      {data.weeks.length > 0 ? (
        data.weeks.map((week) => (
          <details
            key={week.id}
            className="overflow-hidden rounded-xl border border-surface-border bg-surface-elevated"
          >
            <summary className="cursor-pointer list-none bg-surface-sunken px-4 py-3 [&::-webkit-details-marker]:hidden">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
                    {week.seasonName}
                  </p>
                  <h3 className="font-condensed mt-1 text-xl font-bold uppercase tracking-wide text-text-primary">
                    Week {week.weekNumber} · {week.dateLabel}
                  </h3>
                  <p className="mt-1 text-sm text-text-secondary">
                    {week.courseName} · {week.matchCount} matches · {week.locked ? 'Locked' : 'Open'}
                  </p>
                </div>
                <span className="font-condensed shrink-0 text-xs font-semibold uppercase tracking-widest text-accent-text">
                  Expand / Collapse
                </span>
              </div>
            </summary>

            <div className="border-t border-surface-border">
              {week.publicResultsUrl || week.comparisonUrl ? (
                <div className="flex flex-wrap gap-x-4 gap-y-2 px-4 py-3">
                  {week.publicResultsUrl ? (
                    <a
                      className="text-sm font-semibold text-accent-text"
                      href={week.publicResultsUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View Public Results
                    </a>
                  ) : null}
                  {week.comparisonUrl ? (
                    <Link
                      className="text-sm font-semibold text-accent-text"
                      href={week.comparisonUrl}
                    >
                      Spreadsheet Comparison
                    </Link>
                  ) : null}
                </div>
              ) : null}

              <div className="px-4 py-3">
                <p className="text-xs text-text-secondary">
                  CTP {week.ctpHoleNumber ?? '—'}{week.ctpWinnerName ? ` · ${week.ctpWinnerName}` : ''} · LP {week.longestPuttHoleNumber ?? '—'}{week.longestPuttWinnerName ? ` · ${week.longestPuttWinnerName}` : ''}
                </p>
              </div>

              <div className="divide-y divide-surface-border">
                {week.matches.map((match, index) => (
                  <div key={match.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-condensed text-xs font-bold uppercase tracking-widest text-text-muted">
                          Match {index + 1}
                        </p>
                        <p className="mt-1 text-sm text-text-primary">
                          {match.player1Name} vs {match.player2Name}
                          {match.player2ScorecardOnly ? ' · Reference scorecard' : ''}
                        </p>
                        <p className="mt-1 text-xs text-text-secondary">
                          Stroke:{' '}
                          {match.strokeWinnerId === match.player1Id
                            ? match.player1Name
                            : match.strokeWinnerId === match.player2Id
                              ? match.player2Name
                              : match.matchPlayLeadBy !== null
                                ? 'Tie'
                                : 'Pending'}
                          {' · '}
                          Match play:{' '}
                          {match.matchPlaySummary}
                        </p>
                      </div>

                      {!week.seasonArchived && week.locked ? (
                        <Link
                          className="shrink-0 text-sm font-semibold text-accent-text"
                          href={`/week/matches/${match.id}?returnTo=%2Fhistory`}
                        >
                          Edit Scores
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </details>
        ))
      ) : (
        <div className="rounded-xl border border-surface-border bg-surface-elevated p-4 text-sm text-text-secondary">
          No weeks scheduled yet. Create a season with Friday dates to populate this screen.
        </div>
      )}
    </section>
  )
}

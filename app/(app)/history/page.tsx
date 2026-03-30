import { getHistoryPageData } from '@/lib/history'

export default async function HistoryPage() {
  const data = await getHistoryPageData()

  return (
    <section className="space-y-4 px-4 py-6">
      <div className="rounded-xl border border-surface-border bg-surface-elevated p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
          History
        </p>
        <h2 className="mt-2 text-xl font-bold text-text-primary">Season Schedule</h2>
        <p className="mt-2 text-sm text-text-secondary">
          All scheduled weeks, match summaries, and results for the season.
        </p>
      </div>

      {data.weeks.length > 0 ? (
        data.weeks.map((week) => (
          <section
            key={week.id}
            className="overflow-hidden rounded-xl border border-surface-border bg-surface-elevated"
          >
            <div className="border-b border-surface-border bg-surface-sunken px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
                {week.seasonName}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-text-primary">
                Week {week.weekNumber} · {week.dateLabel}
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                {week.courseName} · {week.matchCount} matches · {week.locked ? 'Locked' : 'Open'}
              </p>
            </div>

            <div className="px-4 py-3">
              <p className="text-xs text-text-secondary">
                CTP {week.ctpHoleNumber ?? '—'}{week.ctpWinnerName ? ` · ${week.ctpWinnerName}` : ''} · LP {week.longestPuttHoleNumber ?? '—'}{week.longestPuttWinnerName ? ` · ${week.longestPuttWinnerName}` : ''}
              </p>
            </div>

            <div className="divide-y divide-surface-border">
              {week.matches.map((match, index) => (
                <div key={match.id} className="px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
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
                    {match.matchPlayLeadBy === null
                      ? 'Pending'
                      : match.matchPlayWinnerId === match.player1Id
                        ? `${match.player1Name} ${match.matchPlayLeadBy} up`
                        : match.matchPlayWinnerId === match.player2Id
                          ? `${match.player2Name} ${match.matchPlayLeadBy} up`
                          : match.matchPlayLeadBy === 0
                            ? 'All square'
                            : 'Halved'}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="rounded-xl border border-surface-border bg-surface-elevated p-4 text-sm text-text-secondary">
          No weeks scheduled yet. Create a season with Friday dates to populate this screen.
        </div>
      )}
    </section>
  )
}

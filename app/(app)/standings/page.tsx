import { getStandingsPageData } from '@/lib/standings'

export default async function StandingsPage() {
  const data = await getStandingsPageData()

  return (
    <section className="space-y-4 px-4 py-6">
      <div className="rounded-xl border border-surface-border bg-surface-elevated p-4">
        <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
          Standings
        </p>
        <h2 className="font-condensed mt-2 text-2xl font-bold uppercase tracking-wide text-text-primary">
          {data.selectedSeasonName ?? 'Season Tables'}
        </h2>
        <p className="mt-2 text-sm text-text-secondary">
          {data.selectedSeasonName
            ? 'Current season points, stroke points, and match-play points update from submitted scorecards.'
            : 'Create a season and submit match scores to populate standings.'}
        </p>
      </div>

      {data.standings.length > 0 ? (
        <div className="overflow-x-auto">
          <div className="min-w-[500px] overflow-hidden rounded-xl border border-surface-border bg-surface-elevated">
          <div className="grid grid-cols-[52px_1fr_72px_72px_72px_60px_60px] border-b border-surface-border bg-surface-sunken px-4 py-3 font-condensed text-[11px] font-bold uppercase tracking-widest text-text-muted">
            <span>#</span>
            <span>Player</span>
            <span>Pts</span>
            <span>Stroke</span>
            <span>Match</span>
            <span>CTP</span>
            <span>LP</span>
          </div>
          <div className="divide-y divide-surface-border">
            {data.standings.map((row, index) => (
              <div
                key={row.playerId}
                className="grid grid-cols-[52px_1fr_72px_72px_72px_60px_60px] px-4 py-3 text-sm text-text-primary"
              >
                <span>{index + 1}</span>
                <span>
                  {row.name}
                  <span className="text-text-secondary"> - {row.currentIndexDisplay}</span>
                </span>
                <span>{row.totalPoints}</span>
                <span>{row.strokePoints}</span>
                <span>{row.matchPlayPoints}</span>
                <span>{row.ctpWins}</span>
                <span>{row.lpWins}</span>
              </div>
            ))}
          </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-surface-border bg-surface-elevated p-4 text-sm text-text-secondary">
          No matches played this season yet.
        </div>
      )}
    </section>
  )
}

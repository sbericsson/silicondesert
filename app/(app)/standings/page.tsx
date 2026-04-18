import { getStandingsPageData } from '@/lib/standings'

export default async function StandingsPage() {
  const data = await getStandingsPageData()

  return (
    <section className="space-y-4 px-4 py-6 xl:px-6">
      <div className="rounded-xl border border-surface-border bg-surface-elevated p-4 xl:flex xl:items-center xl:justify-between xl:px-6 xl:py-4">
        <div>
          <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
            Standings
          </p>
          <h2 className="font-condensed mt-1 text-xl font-bold uppercase tracking-wide text-text-primary">
            {data.selectedSeasonName ?? 'Season Tables'}
          </h2>
        </div>
        <p className="mt-2 text-sm text-text-secondary xl:mt-0 xl:text-right xl:text-xs">
          {data.selectedSeasonName
            ? 'Points update from submitted scorecards.'
            : 'Create a season and submit match scores to populate standings.'}
        </p>
      </div>

      {data.standings.length > 0 ? (
        <div className="overflow-x-auto">
          <div className="min-w-[500px] overflow-hidden rounded-xl border border-surface-border bg-surface-elevated">
            {/* mobile table header */}
            <div className="xl:hidden grid grid-cols-[52px_1fr_72px_72px_72px_60px_60px] border-b border-surface-border bg-surface-sunken px-4 py-3 font-condensed text-[11px] font-bold uppercase tracking-widest text-text-muted">
              <span>#</span>
              <span>Player</span>
              <span>Pts</span>
              <span>Stroke</span>
              <span>Match</span>
              <span>CTP</span>
              <span>LP</span>
            </div>
            {/* desktop table header — HCP gets its own column */}
            <div className="hidden xl:grid grid-cols-[44px_1fr_68px_68px_68px_68px_52px_52px] border-b border-surface-border bg-surface-sunken px-6 py-2 font-condensed text-[11px] font-bold uppercase tracking-widest text-text-muted">
              <span>#</span>
              <span>Player</span>
              <span>HCP</span>
              <span>Pts</span>
              <span>Stroke</span>
              <span>Match</span>
              <span>CTP</span>
              <span>LP</span>
            </div>
            <div className="divide-y divide-surface-border">
              {data.standings.map((row, index) => (
                <div key={row.playerId}>
                  {/* mobile row */}
                  <div className="xl:hidden grid grid-cols-[52px_1fr_72px_72px_72px_60px_60px] px-4 py-3 text-sm text-text-primary">
                    <span className="text-text-secondary">{index + 1}</span>
                    <span>
                      {row.name}
                      <span className="text-text-secondary"> – {row.currentIndexDisplay}</span>
                    </span>
                    <span>{row.totalPoints}</span>
                    <span>{row.strokePoints}</span>
                    <span>{row.matchPlayPoints}</span>
                    <span>{row.ctpWins}</span>
                    <span>{row.lpWins}</span>
                  </div>
                  {/* desktop row — compact, HCP in own column */}
                  <div className="hidden xl:grid grid-cols-[44px_1fr_68px_68px_68px_68px_52px_52px] items-center px-6 py-2 text-sm text-text-primary hover:bg-surface-sunken/50">
                    <span className="font-condensed text-xs font-semibold text-text-muted">{index + 1}</span>
                    <span className="font-medium">{row.name}</span>
                    <span className="text-text-secondary">{row.currentIndexDisplay}</span>
                    <span className="font-bold text-accent-text">{row.totalPoints}</span>
                    <span>{row.strokePoints}</span>
                    <span>{row.matchPlayPoints}</span>
                    <span className="text-text-secondary">{row.ctpWins}</span>
                    <span className="text-text-secondary">{row.lpWins}</span>
                  </div>
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

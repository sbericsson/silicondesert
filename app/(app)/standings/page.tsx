import { StandingsTable } from '@/components/standings-table'
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
            {data.seasonLabel ?? 'Season Tables'}
          </h2>
        </div>
        <p className="mt-2 text-sm text-text-secondary xl:mt-0 xl:text-right xl:text-xs">
          {data.seasonLabel
            ? data.multiSeason
              ? 'Spring, Summer, and combined Overall points. Tap any column to sort.'
              : 'Points update from submitted scorecards. Tap any column to sort.'
            : 'Create a season and submit match scores to populate standings.'}
        </p>
      </div>

      {data.standings.length > 0 ? (
        <StandingsTable rows={data.standings} multiSeason={data.multiSeason} />
      ) : (
        <div className="rounded-xl border border-surface-border bg-surface-elevated p-4 text-sm text-text-secondary">
          No matches played this season yet.
        </div>
      )}
    </section>
  )
}

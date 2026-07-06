import { StandingsTable } from '@/components/standings-table'
import { PublicPageHeader } from '@/components/public-page-header'
import { getPublicStandingsData } from '@/lib/public-standings'

export const revalidate = 60
export const dynamic = 'force-dynamic'

export default async function PublicStandingsPage() {
  const data = await getPublicStandingsData()
  const currentSeasonLeader = data.standings
    .filter((row) => row.currentSeasonPoints > 0)
    .sort((a, b) => b.currentSeasonPoints - a.currentSeasonPoints)[0]
  const overallLeader = data.standings[0]

  return (
    <section className="space-y-4">
      <PublicPageHeader
        eyebrow="Standings"
        title={data.seasonLabel ?? 'Season Standings'}
        subtitle={
          data.multiSeason
            ? 'Spring, Summer, and combined Overall points from completed league weeks.'
            : 'Live points, stroke points, and match-play points from completed league weeks.'
        }
      >
        {currentSeasonLeader ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-accent/20 bg-accent-dim px-4 py-3">
              <p className="font-condensed text-[11px] font-semibold uppercase tracking-widest text-accent-text">
                Current Season Leader
              </p>
              <p className="mt-1 text-sm font-medium text-text-primary">
                {currentSeasonLeader.name} · {currentSeasonLeader.currentSeasonPoints} pts
              </p>
            </div>
            {data.multiSeason && overallLeader ? (
              <div className="rounded-2xl border border-surface-border bg-surface-base px-4 py-3">
                <p className="font-condensed text-[11px] font-semibold uppercase tracking-widest text-text-muted">
                  Overall Leader
                </p>
                <p className="mt-1 text-sm font-medium text-text-primary">
                  {overallLeader.name} · {overallLeader.overallPoints} pts
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
      </PublicPageHeader>

      {data.standings.length > 0 ? (
        <>
          <StandingsTable rows={data.standings} multiSeason={data.multiSeason} />
          <p className="text-sm text-text-secondary">Last updated {data.lastUpdatedLabel}</p>
        </>
      ) : (
        <div className="rounded-2xl border border-surface-border bg-surface-elevated p-5 text-sm text-text-secondary shadow-sm">
          No matches played yet this season. Standings will appear after Week 1.
        </div>
      )}
    </section>
  )
}

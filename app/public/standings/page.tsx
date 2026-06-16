import { StandingsTable } from '@/components/standings-table'
import { PublicPageHeader } from '@/components/public-page-header'
import { getPublicStandingsData } from '@/lib/public-standings'

export const revalidate = 60
export const dynamic = 'force-dynamic'

export default async function PublicStandingsPage() {
  const data = await getPublicStandingsData()

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
        {data.standings[0] ? (
          <div className="mt-4 rounded-2xl border border-accent/20 bg-accent-dim px-4 py-3">
            <p className="font-condensed text-[11px] font-semibold uppercase tracking-widest text-accent-text">
              Current Leader
            </p>
            <p className="mt-1 text-sm font-medium text-text-primary">
              {data.standings[0].name} · {data.standings[0].overallPoints} pts
            </p>
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

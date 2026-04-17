import { getMatchScorePageDataByMatchId } from '@/lib/match-score'
import { MatchScoreClient } from '@/app/(app)/week/matches/[matchId]/score-client'

interface MatchPageProps {
  params: {
    matchId: string
  }
  searchParams?: {
    returnTo?: string
  }
}

export default async function MatchPage({ params, searchParams }: MatchPageProps) {
  const data = await getMatchScorePageDataByMatchId(params.matchId)

  if (!data) {
    return (
      <section className="px-4 py-6">
        <div className="rounded-xl border border-danger bg-danger-dim p-4">
          <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-danger-text">
            Score Entry
          </p>
          <h2 className="font-condensed mt-2 text-2xl font-bold uppercase tracking-wide text-text-primary">Match unavailable</h2>
          <p className="mt-2 text-sm text-danger-text">
            This match could not be loaded. Check the database setup and lock state first.
          </p>
        </div>
      </section>
    )
  }

  const requestedReturnHref = searchParams?.returnTo
  const returnHref =
    requestedReturnHref && requestedReturnHref.startsWith('/')
      ? requestedReturnHref
      : data.match.weekCompleted
        ? '/history'
        : '/week'

  return <MatchScoreClient initialData={data} returnHref={returnHref} />
}

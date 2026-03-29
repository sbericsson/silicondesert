import { getMatchScorePageDataByMatchId } from '@/lib/match-score'
import { MatchScoreClient } from '@/app/(app)/week/matches/[matchId]/score-client'

interface MatchPageProps {
  params: {
    matchId: string
  }
}

export default async function MatchPage({ params }: MatchPageProps) {
  const data = await getMatchScorePageDataByMatchId(params.matchId)

  if (!data) {
    return (
      <section className="px-4 py-6">
        <div className="rounded-xl border border-danger bg-danger-dim p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-danger-text">
            Score Entry
          </p>
          <h2 className="mt-2 text-xl font-bold text-text-primary">Match unavailable</h2>
          <p className="mt-2 text-sm text-danger-text">
            This match could not be loaded. Check the database setup and lock state first.
          </p>
        </div>
      </section>
    )
  }

  return <MatchScoreClient initialData={data} />
}

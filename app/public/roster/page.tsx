import type { Metadata } from 'next'
import { getPublicRosterData } from '@/lib/public-roster'

export const revalidate = 60

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
}

export default async function PublicRosterPage() {
  const data = await getPublicRosterData()

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-surface-border bg-surface-elevated p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
          Roster
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-text-primary">League Players</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Active player names and current handicap display.
        </p>
        {data.enabled ? (
          <div className="mt-4 rounded-2xl border border-surface-border bg-surface-base px-4 py-3 text-sm text-text-secondary">
            {data.players.length} active player{data.players.length === 1 ? '' : 's'}
          </div>
        ) : null}
      </div>

      {data.enabled ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.players.map((player) => (
            <div
              key={player.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-surface-border bg-surface-elevated p-4 shadow-sm"
            >
              <p className="text-sm font-medium text-text-primary">{player.name}</p>
              <p className="rounded-full bg-surface-sunken px-3 py-1 text-sm text-text-secondary">
                {player.handicap.kind === 'HCP' ? player.handicap.value : player.handicap.kind}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-surface-border bg-surface-elevated p-6 text-sm text-text-secondary shadow-sm">
          The league roster is not publicly available. Contact the commissioner for details.
        </div>
      )}
    </section>
  )
}

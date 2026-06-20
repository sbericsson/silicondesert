import type { Metadata } from 'next'
import Link from 'next/link'
import { getPublicRosterData } from '@/lib/public-roster'
import { PublicPageHeader } from '@/components/public-page-header'

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
      <PublicPageHeader
        eyebrow="Roster"
        title="League Players"
        subtitle="Active player names and current handicap display."
      >
        {data.enabled ? (
          <div className="mt-4 rounded-2xl border border-surface-border bg-surface-base px-4 py-3 text-sm text-text-secondary">
            {data.players.length} active player{data.players.length === 1 ? '' : 's'}
          </div>
        ) : null}
      </PublicPageHeader>

      {data.enabled ? (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {data.players.map((player) => (
            <Link
              key={player.id}
              href={`/public/roster/${player.id}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-surface-border bg-surface-elevated p-4 shadow-sm transition hover:border-accent hover:text-accent-text"
            >
              <p className="text-sm font-medium text-text-primary">{player.name}</p>
              <p className="rounded-full bg-surface-sunken px-3 py-1 text-sm text-text-secondary">
                {player.handicap.kind === 'HCP' ? player.handicap.value : player.handicap.kind}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-surface-border bg-surface-elevated p-5 text-sm text-text-secondary shadow-sm">
          The league roster is not publicly available. Contact the commissioner for details.
        </div>
      )}
    </section>
  )
}

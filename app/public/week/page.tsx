import { redirect } from 'next/navigation'
import { getLatestPublishedWeek } from '@/lib/public-week'

export const revalidate = 60
export const dynamic = 'force-dynamic'

export default async function PublicCurrentWeekPage() {
  const latestWeek = await getLatestPublishedWeek()

  if (latestWeek) {
    redirect(latestWeek.publicPath)
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-surface-border bg-surface-elevated p-6 shadow-sm">
        <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
          This Week
        </p>
        <h2 className="font-condensed mt-2 text-2xl font-bold uppercase tracking-wide text-text-primary">Pairings not yet available</h2>
        <p className="mt-2 text-sm text-text-secondary">
          The next league week has not been locked yet. Check back after Friday check-in.
        </p>
      </div>
    </section>
  )
}

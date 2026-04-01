import Link from 'next/link'

export default function PublicNotFound() {
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-surface-border bg-surface-elevated p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
          Public Pages
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-text-primary">Page not found</h2>
        <p className="mt-2 text-sm text-text-secondary">
          That league page does not exist or is no longer available.
        </p>
        <Link
          href="/public/week"
          className="mt-4 inline-flex rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white"
        >
          Go to This Week
        </Link>
      </div>
    </section>
  )
}

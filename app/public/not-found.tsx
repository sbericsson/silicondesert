import Link from 'next/link'

export default function PublicNotFound() {
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-surface-border bg-surface-elevated p-6 shadow-sm">
        <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
          Public Pages
        </p>
        <h2 className="font-condensed mt-2 text-2xl font-bold uppercase tracking-wide text-text-primary">Page not found</h2>
        <p className="mt-2 text-sm text-text-secondary">
          That league page does not exist or is no longer available.
        </p>
        <Link
          href="/public/week"
          className="font-condensed mt-4 inline-flex rounded-lg bg-accent px-4 py-3 text-sm font-bold uppercase tracking-wide text-white"
        >
          Go to This Week
        </Link>
      </div>
    </section>
  )
}

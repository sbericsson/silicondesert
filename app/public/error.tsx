'use client'

export default function PublicError({
  reset
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-surface-border bg-surface-elevated p-6 shadow-sm">
        <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
          Public Pages
        </p>
        <h2 className="font-condensed mt-2 text-2xl font-bold uppercase tracking-wide text-text-primary">Something went wrong</h2>
        <p className="mt-2 text-sm text-text-secondary">Try refreshing this page in a moment.</p>
        <button
          type="button"
          className="font-condensed mt-4 rounded-lg bg-accent px-4 py-3 text-sm font-bold uppercase tracking-wide text-white"
          onClick={reset}
        >
          Try Again
        </button>
      </div>
    </section>
  )
}

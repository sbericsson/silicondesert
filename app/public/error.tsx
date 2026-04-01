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
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
          Public Pages
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-text-primary">Something went wrong</h2>
        <p className="mt-2 text-sm text-text-secondary">Try refreshing this page in a moment.</p>
        <button
          type="button"
          className="mt-4 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white"
          onClick={reset}
        >
          Try Again
        </button>
      </div>
    </section>
  )
}

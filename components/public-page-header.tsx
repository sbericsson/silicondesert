export function PublicPageHeader({
  eyebrow,
  title,
  subtitle,
  children
}: {
  eyebrow: string
  title: string
  subtitle?: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-surface-border bg-surface-elevated p-5 shadow-sm">
      <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
        {eyebrow}
      </p>
      <h2 className="font-condensed mt-1.5 text-2xl font-bold uppercase tracking-wide text-text-primary">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-1.5 text-sm text-text-secondary">{subtitle}</p>
      ) : null}
      {children}
    </div>
  )
}

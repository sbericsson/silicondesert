import Link from 'next/link'

const BTN_BASE = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-surface-border bg-surface-base font-condensed text-lg font-bold text-text-secondary transition'
const BTN_ACTIVE = 'hover:border-accent hover:text-accent-text'
const BTN_DISABLED = 'opacity-30 pointer-events-none'

export function WeekStepper({
  prevWeekPath,
  nextWeekPath,
  children
}: {
  prevWeekPath: string | null
  nextWeekPath: string | null
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3">
      {prevWeekPath ? (
        <Link
          href={prevWeekPath}
          className={`${BTN_BASE} ${BTN_ACTIVE}`}
          aria-label="Previous week"
        >
          ‹
        </Link>
      ) : (
        <span className={`${BTN_BASE} ${BTN_DISABLED}`} aria-disabled="true" aria-label="No previous week">
          ‹
        </span>
      )}
      <div className="flex min-w-0 flex-1 items-center justify-center">{children}</div>
      {nextWeekPath ? (
        <Link
          href={nextWeekPath}
          className={`${BTN_BASE} ${BTN_ACTIVE}`}
          aria-label="Next week"
        >
          ›
        </Link>
      ) : (
        <span className={`${BTN_BASE} ${BTN_DISABLED}`} aria-disabled="true" aria-label="No next week">
          ›
        </span>
      )}
    </div>
  )
}

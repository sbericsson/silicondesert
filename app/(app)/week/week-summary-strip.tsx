'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'

interface WeekSummaryStripProps {
  courseName: string | null
  handicapModeLabel: string
  ctpHoleNumber: number | null
  longestPuttHoleNumber: number | null
  setupIncomplete: boolean
  children: ReactNode
}

export function WeekSummaryStrip({
  courseName,
  handicapModeLabel,
  ctpHoleNumber,
  longestPuttHoleNumber,
  setupIncomplete,
  children
}: WeekSummaryStripProps) {
  const panelId = useId()
  const [open, setOpen] = useState(setupIncomplete)

  useEffect(() => {
    if (setupIncomplete) {
      setOpen(true)
    }
  }, [setupIncomplete])

  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-surface-border bg-surface-elevated xl:hidden">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
        >
          <div className="min-w-0 flex-1">
            <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
              Week Setup
            </p>
            <p className="mt-1 truncate text-sm text-text-primary">
              {courseName ?? 'Course not selected'} · {handicapModeLabel}
            </p>
            <p className="mt-0.5 truncate text-xs text-text-secondary">
              CTP: {ctpHoleNumber !== null ? `Hole ${ctpHoleNumber}` : '—'} · LPM:{' '}
              {longestPuttHoleNumber !== null ? `Hole ${longestPuttHoleNumber}` : '—'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {setupIncomplete ? (
              <span className="rounded bg-warning-dim px-2 py-1 font-condensed text-[10px] font-semibold uppercase tracking-wide text-warning-text">
                Setup incomplete
              </span>
            ) : null}
            <span
              aria-hidden="true"
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-surface-sunken text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div>
        </button>
        <div
          id={panelId}
          hidden={!open}
          className="border-t border-surface-border px-3 py-3"
        >
          {children}
        </div>
      </div>
      <div className="hidden xl:block">{children}</div>
    </section>
  )
}

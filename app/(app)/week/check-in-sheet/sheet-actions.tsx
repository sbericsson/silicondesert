'use client'

import Link from 'next/link'

export function SheetActions() {
  return (
    <div className="cis-screen-only flex items-center gap-4 px-4 pt-4 xl:px-6">
      <button
        type="button"
        onClick={() => window.print()}
        className="font-condensed rounded-full bg-accent px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white shadow-sm hover:bg-accent-hover"
      >
        Print / Save PDF
      </button>
      <Link
        href="/week"
        className="text-sm font-medium text-text-secondary hover:text-text-primary"
      >
        &larr; Back to Week
      </Link>
    </div>
  )
}

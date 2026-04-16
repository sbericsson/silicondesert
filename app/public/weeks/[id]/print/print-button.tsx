'use client'

export function PrintButton() {
  return (
    <div className="flex items-center gap-4 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="font-condensed rounded-full bg-accent px-5 py-2 text-sm font-semibold uppercase tracking-wide text-white shadow-sm hover:bg-accent-hover"
      >
        Print / Save PDF
      </button>
      <button
        type="button"
        onClick={() => window.history.back()}
        className="text-sm font-medium text-text-secondary hover:text-text-primary"
      >
        &larr; Back to Results
      </button>
    </div>
  )
}

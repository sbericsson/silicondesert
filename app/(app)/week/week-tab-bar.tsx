'use client'

export type WeekTab = 'checkin' | 'pairings'

interface WeekTabBarProps {
  activeTab: WeekTab
  onTabChange: (tab: WeekTab) => void
  presentCount: number
  matchCount: number
  unmatchedCount: number
  locked: boolean
}

export function WeekTabBar({
  activeTab,
  onTabChange,
  presentCount,
  matchCount,
  unmatchedCount,
  locked
}: WeekTabBarProps) {
  return (
    <div
      className="fixed bottom-[var(--app-nav-h)] left-0 right-0 z-20 border-t border-surface-border bg-surface-elevated/95 backdrop-blur xl:hidden"
      role="tablist"
    >
      <div className="mx-auto grid max-w-5xl grid-cols-2">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'checkin'}
          className={`font-condensed flex min-h-[48px] items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-widest ${
            activeTab === 'checkin'
              ? 'border-b-2 border-accent text-accent-text'
              : 'border-b-2 border-transparent text-text-secondary'
          }`}
          onClick={() => onTabChange('checkin')}
        >
          Check-in
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">
            {presentCount}
          </span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'pairings'}
          className={`font-condensed flex min-h-[48px] items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-widest ${
            activeTab === 'pairings'
              ? 'border-b-2 border-accent text-accent-text'
              : 'border-b-2 border-transparent text-text-secondary'
          }`}
          onClick={() => onTabChange('pairings')}
        >
          Pairings
          <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white">
            {matchCount}/{unmatchedCount}
          </span>
          {locked ? (
            <span className="text-[10px] text-text-muted">Locked</span>
          ) : null}
        </button>
      </div>
    </div>
  )
}

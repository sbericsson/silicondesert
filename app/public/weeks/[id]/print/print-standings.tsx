'use client'

import { useMemo, useState } from 'react'
import { comparePlayerNamesByLastName } from '@/lib/player-sort'
import { getSeasonSortValueClass, type SeasonSortKey } from '@/lib/standings-sort'

export type PrintStandingRow = {
  playerId: string
  name: string
  currentIndexDisplay: string
  springPoints: number
  summerPoints: number
  overallPoints: number
  attendancePoints: number
  strokePoints: number
  matchPlayPoints: number
  ctpWins: number
  lpWins: number
}

export type PrintStandingsSortKey = SeasonSortKey

const SORT_OPTIONS: { key: PrintStandingsSortKey; label: string }[] = [
  { key: 'overallPoints', label: 'Overall' },
  { key: 'summerPoints', label: 'Summer' },
  { key: 'springPoints', label: 'Spring' }
]

export const getPrintStandingsValueClass = getSeasonSortValueClass

export function getPrintStandingsSortLabel(sortKey: PrintStandingsSortKey) {
  return SORT_OPTIONS.find((option) => option.key === sortKey)?.label ?? 'Overall'
}

// Single-season tables only have one points column, so there is nothing to choose
// between: the season keys are pinned back to Overall no matter what state holds.
export function resolveActiveSortKey(
  multiSeason: boolean,
  sortKey: PrintStandingsSortKey
): PrintStandingsSortKey {
  return multiSeason ? sortKey : 'overallPoints'
}

export function sortPrintStandings<Row extends PrintStandingRow>(
  rows: Row[],
  sortKey: PrintStandingsSortKey
) {
  return [...rows].sort(
    (left, right) =>
      right[sortKey] - left[sortKey] || comparePlayerNamesByLastName(left.name, right.name)
  )
}

export function PrintStandings({
  rows,
  multiSeason,
  heading
}: {
  rows: PrintStandingRow[]
  multiSeason: boolean
  heading: string
}) {
  const [sortKey, setSortKey] = useState<PrintStandingsSortKey>('overallPoints')
  const activeSortKey = resolveActiveSortKey(multiSeason, sortKey)
  const sortedRows = useMemo(() => sortPrintStandings(rows, activeSortKey), [rows, activeSortKey])

  return (
    <section>
      {/* break-after-avoid keeps the heading attached to the start of the table so it
          cannot be stranded alone at the foot of a printed page; break-inside-avoid
          keeps the heading and its "Sorted by" caption together. */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3 break-inside-avoid break-after-avoid">
        <div>
          <h2 className="font-condensed text-sm font-bold uppercase tracking-widest text-text-muted print:text-black">
            {heading}
          </h2>
          {multiSeason ? (
            <p className="mt-1 text-xs text-text-secondary print:text-black">
              Sorted by {getPrintStandingsSortLabel(activeSortKey)} points
            </p>
          ) : null}
        </div>

        {multiSeason ? (
          <div className="print:hidden" role="group" aria-label="Sort standings by">
            <span className="font-condensed mr-2 text-[11px] font-bold uppercase tracking-widest text-text-muted">
              Sort by
            </span>
            {/* Buttons carry their own end radii rather than being clipped by an
                overflow-hidden wrapper, so the browser focus ring stays visible. */}
            <span className="inline-flex rounded-full border border-surface-border">
              {SORT_OPTIONS.map((option) => {
                const isActive = option.key === activeSortKey
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setSortKey(option.key)}
                    aria-pressed={isActive}
                    className={`font-condensed inline-flex min-h-11 items-center px-4 text-xs font-semibold uppercase tracking-wide first:rounded-l-full last:rounded-r-full ${
                      isActive
                        ? 'bg-accent text-white'
                        : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {option.label}
                  </button>
                )
              })}
            </span>
          </div>
        ) : null}
      </div>

      {/* The column budget below is sized for the printed page. On a screen narrower
          than that budget, table-fixed would widen the table past its container and
          spill, so scroll it instead — the same treatment the commissioner comparison
          sheet uses. In print the constraint lifts and the table fits the page box. */}
      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[720px] table-fixed border-collapse text-sm print:min-w-0">
          {/* Width budget. Player is the only auto column, so it absorbs whatever the
              fixed columns leave; when they sum to the full table width it collapses to
              zero and names wrap into ragged row heights. The printed page box is
              7.5in = 720px (letter minus the 0.5in @page margins, with the container's
              max-width and padding stripped by globals.css). These fixed widths total
              516px, leaving Player 204px — close to the 240px the comparison sheet
              gives it, and well past the longest real name. */}
          <colgroup>
            <col className="w-[32px]" />
            <col />
            <col className="w-[48px]" />
            <col className="w-[68px]" />
            {multiSeason ? <col className="w-[60px]" /> : null}
            {multiSeason ? <col className="w-[60px]" /> : null}
            <col className="w-[44px]" />
            <col className="w-[60px]" />
            <col className="w-[56px]" />
            <col className="w-[44px]" />
            <col className="w-[44px]" />
          </colgroup>
          <thead>
            <tr className="whitespace-nowrap border-b-2 border-surface-border text-left font-condensed text-xs font-bold uppercase tracking-widest text-text-muted print:border-black print:text-black">
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">Player</th>
              <th className="py-2 pr-3 text-right">HCP</th>
              <th className="py-2 pr-3 text-right">{multiSeason ? 'Overall' : 'Pts'}</th>
              {multiSeason ? (
                <>
                  <th className="py-2 pr-3 text-right">Summer</th>
                  <th className="py-2 pr-3 text-right">Spring</th>
                </>
              ) : null}
              <th className="py-2 pr-3 text-right">Att</th>
              <th className="py-2 pr-3 text-right">Stroke</th>
              <th className="py-2 pr-3 text-right">Match</th>
              <th className="py-2 pr-3 text-right">CTP</th>
              <th className="py-2 text-right">LP</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, i) => (
              <tr
                key={row.playerId}
                className="break-inside-avoid border-b border-surface-border print:border-gray-300"
              >
                <td className="py-2 pr-3 tabular-nums text-text-secondary">{i + 1}</td>
                {/* nowrap holds every row to one line, so row height no longer
                    varies with name length */}
                <td className="whitespace-nowrap py-2 pr-3 font-medium">{row.name}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-text-secondary">
                  {row.currentIndexDisplay}
                </td>
                <td
                  className={`py-2 pr-3 text-right tabular-nums ${getPrintStandingsValueClass(
                    'overallPoints',
                    activeSortKey
                  )}`}
                >
                  {row.overallPoints}
                </td>
                {multiSeason ? (
                  <>
                    <td
                      className={`py-2 pr-3 text-right tabular-nums ${getPrintStandingsValueClass(
                        'summerPoints',
                        activeSortKey
                      )}`}
                    >
                      {row.summerPoints}
                    </td>
                    <td
                      className={`py-2 pr-3 text-right tabular-nums ${getPrintStandingsValueClass(
                        'springPoints',
                        activeSortKey
                      )}`}
                    >
                      {row.springPoints}
                    </td>
                  </>
                ) : null}
                <td className="py-2 pr-3 text-right tabular-nums">{row.attendancePoints}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{row.strokePoints}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{row.matchPlayPoints}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{row.ctpWins}</td>
                <td className="py-2 text-right tabular-nums">{row.lpWins}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

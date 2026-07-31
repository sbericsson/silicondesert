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
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
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

      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-12" />
          <col />
          <col className="w-16" />
          {multiSeason ? <col className="w-16" /> : null}
          {multiSeason ? <col className="w-16" /> : null}
          <col className="w-16" />
          <col className="w-16" />
          <col className="w-20" />
          <col className="w-20" />
          <col className="w-14" />
          <col className="w-14" />
        </colgroup>
        <thead>
          <tr className="border-b-2 border-surface-border text-left font-condensed text-xs font-bold uppercase tracking-widest text-text-muted print:border-black print:text-black">
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
              className="border-b border-surface-border print:border-gray-300"
            >
              <td className="py-2 pr-3 tabular-nums text-text-secondary">{i + 1}</td>
              <td className="py-2 pr-3 font-medium">{row.name}</td>
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
    </section>
  )
}

'use client'

import { useMemo, useState } from 'react'
import { comparePlayerNamesByLastName } from '@/lib/player-sort'

export type StandingRow = {
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

type NumericKey =
  | 'springPoints'
  | 'summerPoints'
  | 'overallPoints'
  | 'attendancePoints'
  | 'strokePoints'
  | 'matchPlayPoints'
  | 'ctpWins'
  | 'lpWins'

type NumericColumn = {
  key: NumericKey
  label: string
  width: string
  emphasize?: boolean
}

export function StandingsTable({
  rows,
  multiSeason
}: {
  rows: StandingRow[]
  multiSeason: boolean
}) {
  const pointColumns: NumericColumn[] = multiSeason
    ? [
        { key: 'springPoints', label: 'Spring', width: 'w-[72px]' },
        { key: 'summerPoints', label: 'Summer', width: 'w-[72px]' },
        { key: 'overallPoints', label: 'Overall', width: 'w-[76px]', emphasize: true }
      ]
    : [{ key: 'overallPoints', label: 'Pts', width: 'w-[72px]', emphasize: true }]

  const numericColumns: NumericColumn[] = [
    ...pointColumns,
    { key: 'attendancePoints', label: 'Att', width: 'w-[56px]' },
    { key: 'strokePoints', label: 'Stroke', width: 'w-[68px]' },
    { key: 'matchPlayPoints', label: 'Match', width: 'w-[68px]' },
    { key: 'ctpWins', label: 'CTP', width: 'w-[52px]' },
    { key: 'lpWins', label: 'LP', width: 'w-[48px]' }
  ]

  const [sortKey, setSortKey] = useState<NumericKey>('overallPoints')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const sortedRows = useMemo(() => {
    const next = [...rows]

    next.sort((left, right) => {
      const leftValue = left[sortKey]
      const rightValue = right[sortKey]

      if (rightValue !== leftValue) {
        return sortDirection === 'asc' ? leftValue - rightValue : rightValue - leftValue
      }

      return comparePlayerNamesByLastName(left.name, right.name)
    })

    return next
  }, [rows, sortDirection, sortKey])

  function updateSort(nextKey: NumericKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortKey(nextKey)
    setSortDirection('desc')
  }

  const ariaSortFor = (key: NumericKey) =>
    sortKey === key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'

  // Sticky identity column (rank + name + HCP) stays pinned during horizontal scroll.
  // table-fixed makes the colgroup widths authoritative (the sticky column can't be
  // squeezed), and border-separate is required for position:sticky to work on iOS Safari.
  const minWidth = multiSeason ? 'min-w-[700px]' : 'min-w-[560px]'

  return (
    <div className="overflow-x-auto rounded-2xl border border-surface-border bg-surface-elevated shadow-sm">
      <table className={`w-full ${minWidth} table-fixed border-separate border-spacing-0`}>
        <colgroup>
          <col className="w-[188px]" />
          {numericColumns.map((column) => (
            <col key={column.key} className={column.width} />
          ))}
          <col />
        </colgroup>
        <thead>
          <tr className="font-condensed text-[11px] font-bold uppercase tracking-widest text-text-muted">
            <th className="sticky left-0 z-20 border-b border-r border-surface-border bg-surface-sunken px-3 py-3 text-left">
              <div className="flex items-baseline justify-between gap-4">
                <span>Player</span>
                <span className="text-text-muted/80">HCP</span>
              </div>
            </th>
            {numericColumns.map((column) => (
              <th
                key={column.key}
                className="whitespace-nowrap border-b border-surface-border bg-surface-sunken px-3 py-3 text-right"
                aria-sort={ariaSortFor(column.key)}
              >
                <button
                  type="button"
                  className={`inline-flex min-h-9 items-center justify-end gap-1 ${
                    sortKey === column.key ? 'text-text-primary' : ''
                  }`}
                  onClick={() => updateSort(column.key)}
                  aria-label={`Sort by ${column.label}`}
                >
                  <span>{column.label}</span>
                  {sortKey === column.key ? (
                    <span aria-hidden="true">{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  ) : null}
                </button>
              </th>
            ))}
            <th className="border-b border-surface-border bg-surface-sunken" aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, index) => {
            const zebra = index % 2 === 0 ? 'bg-surface-base' : 'bg-surface-elevated'
            return (
              <tr key={row.playerId}>
                <td className={`sticky left-0 z-10 border-r border-surface-border px-3 py-3 ${zebra}`}>
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="flex min-w-0 items-baseline gap-2">
                      <span className="w-4 shrink-0 text-sm tabular-nums text-text-secondary">{index + 1}</span>
                      <span className="truncate text-sm font-medium text-text-primary">{row.name}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-text-secondary">
                      {row.currentIndexDisplay}
                    </span>
                  </div>
                </td>
                {numericColumns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-3 py-3 text-right text-sm tabular-nums ${
                      column.emphasize ? 'font-semibold text-text-primary' : 'text-text-primary'
                    } ${zebra}`}
                  >
                    {row[column.key]}
                  </td>
                ))}
                <td className={`${zebra}`} aria-hidden="true" />
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

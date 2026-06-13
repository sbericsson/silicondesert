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

type SortKey = NumericKey

type NumericColumn = {
  key: NumericKey
  label: string
  width: string
  emphasize?: boolean
}

function parseHcp(display: string) {
  const value = Number.parseFloat(display)
  // Non-numeric labels (EST, PRO, NEW) sort to the bottom on ascending.
  return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value
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
        { key: 'springPoints', label: 'Spring', width: 'w-16' },
        { key: 'summerPoints', label: 'Summer', width: 'w-16' },
        { key: 'overallPoints', label: 'Overall', width: 'w-16', emphasize: true }
      ]
    : [{ key: 'overallPoints', label: 'Pts', width: 'w-16', emphasize: true }]

  const numericColumns: NumericColumn[] = [
    ...pointColumns,
    { key: 'attendancePoints', label: 'Att', width: 'w-14' },
    { key: 'strokePoints', label: 'Stroke', width: 'w-16' },
    { key: 'matchPlayPoints', label: 'Match', width: 'w-16' },
    { key: 'ctpWins', label: 'CTP', width: 'w-12' },
    { key: 'lpWins', label: 'LP', width: 'w-12' }
  ]

  const [sortKey, setSortKey] = useState<SortKey>('overallPoints')
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

  function updateSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }

    setSortKey(nextKey)
    setSortDirection('desc')
  }

  const ariaSortFor = (key: SortKey) =>
    sortKey === key ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'

  const sortButton = (key: SortKey, label: string, align: 'left' | 'right') => (
    <button
      type="button"
      className={`inline-flex min-h-9 items-center gap-1 ${align === 'right' ? 'justify-end' : ''} ${
        sortKey === key ? 'text-text-primary' : ''
      }`}
      onClick={() => updateSort(key)}
      aria-label={`Sort by ${label}`}
    >
      <span>{label}</span>
      {sortKey === key ? <span aria-hidden="true">{sortDirection === 'asc' ? '↑' : '↓'}</span> : null}
    </button>
  )

  const minWidth = multiSeason ? 'min-w-[760px]' : 'min-w-[620px]'

  return (
    <div className="overflow-x-auto rounded-2xl border border-surface-border bg-surface-elevated shadow-sm">
      <table className={`w-full ${minWidth} table-fixed border-collapse`}>
        <colgroup>
          <col className="w-10" />
          <col className="w-44" />
          <col className="w-14" />
          {numericColumns.map((column) => (
            <col key={column.key} className={column.width} />
          ))}
          <col />
        </colgroup>
        <thead>
          <tr className="border-b border-surface-border bg-surface-sunken font-condensed text-[11px] font-bold uppercase tracking-widest text-text-muted">
            <th className="px-2 py-3 text-left">#</th>
            <th className="border-r border-surface-border pl-2 pr-4 py-3 text-left">Player</th>
            <th className="pl-3 pr-2 py-3 text-right">HCP</th>
            {numericColumns.map((column) => (
              <th key={column.key} className="px-2 py-3 text-right" aria-sort={ariaSortFor(column.key)}>
                {sortButton(column.key, column.label, 'right')}
              </th>
            ))}
            <th className="px-2 py-3" aria-hidden="true" />
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, index) => {
            const zebra = index % 2 === 0 ? 'bg-surface-base' : 'bg-surface-elevated'
            return (
              <tr key={row.playerId} className={zebra}>
                <td className="px-2 py-3 text-sm font-medium text-text-secondary">{index + 1}</td>
                <td className={`sticky left-0 z-10 border-r border-surface-border pl-2 pr-4 py-3 text-sm font-medium text-text-primary ${zebra}`}>
                  {row.name}
                </td>
                <td className="px-2 py-3 text-right text-sm tabular-nums text-text-secondary">
                  {row.currentIndexDisplay}
                </td>
                {numericColumns.map((column) => (
                  <td
                    key={column.key}
                    className={`px-2 py-3 text-right text-sm tabular-nums ${
                      column.emphasize ? 'font-semibold text-text-primary' : 'text-text-primary'
                    }`}
                  >
                    {row[column.key]}
                  </td>
                ))}
                <td className="px-2 py-3" aria-hidden="true" />
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

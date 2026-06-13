'use client'

import { useMemo, useState } from 'react'
import { comparePlayerNamesByLastName } from '@/lib/player-sort'

type StandingRow = {
  playerId: string
  name: string
  currentIndexDisplay: string
  totalPoints: number
  attendancePoints: number
  strokePoints: number
  matchPlayPoints: number
  ctpWins: number
  lpWins: number
}

type SortKey = keyof Pick<
  StandingRow,
  'name' | 'totalPoints' | 'attendancePoints' | 'strokePoints' | 'matchPlayPoints' | 'ctpWins' | 'lpWins'
>

const columns: Array<{
  key: SortKey
  label: string
  align?: 'left' | 'right'
}> = [
  { key: 'name', label: 'Player' },
  { key: 'totalPoints', label: 'Pts', align: 'right' },
  { key: 'attendancePoints', label: 'Att', align: 'right' },
  { key: 'strokePoints', label: 'Stroke', align: 'right' },
  { key: 'matchPlayPoints', label: 'Match', align: 'right' },
  { key: 'ctpWins', label: 'CTP', align: 'right' },
  { key: 'lpWins', label: 'LP', align: 'right' }
]

export function PublicStandingsTable({
  rows
}: {
  rows: StandingRow[]
}) {
  const [sortKey, setSortKey] = useState<SortKey>('totalPoints')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const sortedRows = useMemo(() => {
    const next = [...rows]

    next.sort((left, right) => {
      const leftValue = left[sortKey]
      const rightValue = right[sortKey]

      if (sortKey === 'name') {
        return sortDirection === 'asc'
          ? comparePlayerNamesByLastName(left.name, right.name)
          : comparePlayerNamesByLastName(right.name, left.name)
      }

      if (rightValue !== leftValue) {
        return sortDirection === 'asc'
          ? Number(leftValue) - Number(rightValue)
          : Number(rightValue) - Number(leftValue)
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
    setSortDirection(nextKey === 'name' ? 'asc' : 'desc')
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-surface-border bg-surface-elevated shadow-sm">
      <table className="w-full min-w-[640px] table-fixed border-collapse">
        <colgroup>
          <col className="w-10" />
          <col />
          <col className="w-14" />
          <col className="w-14" />
          <col className="w-14" />
          <col className="w-16" />
          <col className="w-16" />
          <col className="w-12" />
          <col className="w-12" />
        </colgroup>
        <thead>
          <tr className="border-b border-surface-border bg-surface-sunken font-condensed text-[11px] font-bold uppercase tracking-widest text-text-muted">
            <th className="px-2 py-3 text-left">#</th>
            {columns.filter((column) => column.key === 'name').map((column) => (
              <th
                key={column.key}
                className={`px-2 py-3 ${column.align === 'right' ? 'text-right' : 'text-left'}`}
                aria-sort={
                  sortKey === column.key
                    ? sortDirection === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                <button
                  type="button"
                  className={`inline-flex min-h-9 items-center gap-1 ${
                    column.align === 'right' ? 'justify-end' : ''
                  } ${
                    sortKey === column.key ? 'text-text-primary' : ''
                  }`}
                  onClick={() => updateSort(column.key)}
                  aria-label={`Sort by ${column.label}`}
                >
                  <span>{column.label}</span>
                  {sortKey === column.key ? <span>{sortDirection === 'asc' ? '↑' : '↓'}</span> : null}
                </button>
              </th>
            ))}
            <th className="px-2 py-3 text-right">HCP</th>
            {columns.filter((column) => column.key !== 'name').map((column) => (
              <th
                key={column.key}
                className={`px-2 py-3 ${column.align === 'right' ? 'text-right' : 'text-left'}`}
                aria-sort={
                  sortKey === column.key
                    ? sortDirection === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : 'none'
                }
              >
                <button
                  type="button"
                  className={`inline-flex min-h-9 items-center gap-1 ${
                    column.align === 'right' ? 'justify-end' : ''
                  } ${
                    sortKey === column.key ? 'text-text-primary' : ''
                  }`}
                  onClick={() => updateSort(column.key)}
                  aria-label={`Sort by ${column.label}`}
                >
                  <span>{column.label}</span>
                  {sortKey === column.key ? <span>{sortDirection === 'asc' ? '↑' : '↓'}</span> : null}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, index) => (
            <tr key={row.playerId} className={index % 2 === 0 ? 'bg-surface-base' : 'bg-surface-elevated'}>
              <td className="px-2 py-3 text-sm font-medium text-text-secondary">{index + 1}</td>
              <td
                className={`sticky left-0 z-10 px-2 py-3 text-sm font-medium text-text-primary ${
                  index % 2 === 0 ? 'bg-surface-base' : 'bg-surface-elevated'
                }`}
              >
                {row.name}
              </td>
              <td className="px-2 py-3 text-right text-sm tabular-nums text-text-secondary">{row.currentIndexDisplay}</td>
              <td className="px-2 py-3 text-right text-sm font-semibold tabular-nums text-text-primary">{row.totalPoints}</td>
              <td className="px-2 py-3 text-right text-sm tabular-nums text-text-primary">{row.attendancePoints}</td>
              <td className="px-2 py-3 text-right text-sm tabular-nums text-text-primary">{row.strokePoints}</td>
              <td className="px-2 py-3 text-right text-sm tabular-nums text-text-primary">{row.matchPlayPoints}</td>
              <td className="px-2 py-3 text-right text-sm tabular-nums text-text-primary">{row.ctpWins}</td>
              <td className="px-2 py-3 text-right text-sm tabular-nums text-text-primary">{row.lpWins}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

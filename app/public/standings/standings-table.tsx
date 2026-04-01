'use client'

import { useMemo, useState } from 'react'

type StandingRow = {
  playerId: string
  name: string
  totalPoints: number
  strokeWins: number
  matchPlayWins: number
  ctpWins: number
  lpWins: number
}

type SortKey = keyof Pick<
  StandingRow,
  'name' | 'totalPoints' | 'strokeWins' | 'matchPlayWins' | 'ctpWins' | 'lpWins'
>

const columns: Array<{
  key: SortKey
  label: string
}> = [
  { key: 'name', label: 'Player' },
  { key: 'totalPoints', label: 'Pts' },
  { key: 'strokeWins', label: 'Stroke' },
  { key: 'matchPlayWins', label: 'Match' },
  { key: 'ctpWins', label: 'CTP' },
  { key: 'lpWins', label: 'LP' }
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
          ? left.name.localeCompare(right.name)
          : right.name.localeCompare(left.name)
      }

      if (rightValue !== leftValue) {
        return sortDirection === 'asc'
          ? Number(leftValue) - Number(rightValue)
          : Number(rightValue) - Number(leftValue)
      }

      return left.name.localeCompare(right.name)
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
      <table className="min-w-[680px] table-auto border-collapse">
        <thead>
          <tr className="border-b border-surface-border bg-surface-sunken font-condensed text-[11px] font-bold uppercase tracking-widest text-text-muted">
            <th className="px-4 py-3 text-left">#</th>
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-4 py-3 text-left"
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
                  className={`inline-flex min-h-11 items-center gap-1 ${
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
              <td className="px-4 py-3 text-sm font-medium text-text-secondary">{index + 1}</td>
              <td
                className={`sticky left-0 z-10 px-4 py-3 text-sm font-medium text-text-primary ${
                  index % 2 === 0 ? 'bg-surface-base' : 'bg-surface-elevated'
                }`}
              >
                {row.name}
              </td>
              <td className="px-4 py-3 text-sm text-text-primary">{row.totalPoints}</td>
              <td className="px-4 py-3 text-sm text-text-primary">{row.strokeWins}</td>
              <td className="px-4 py-3 text-sm text-text-primary">{row.matchPlayWins}</td>
              <td className="px-4 py-3 text-sm text-text-primary">{row.ctpWins}</td>
              <td className="px-4 py-3 text-sm text-text-primary">{row.lpWins}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

import { describe, expect, it } from 'vitest'
import {
  getPrintStandingsSortLabel,
  getPrintStandingsValueClass,
  resolveActiveSortKey,
  sortPrintStandings,
  type PrintStandingRow,
  type PrintStandingsSortKey
} from '@/app/public/weeks/[id]/print/print-standings'

const columns: PrintStandingsSortKey[] = ['overallPoints', 'summerPoints', 'springPoints']

function row(
  name: string,
  points: { overallPoints: number; summerPoints: number; springPoints: number }
): PrintStandingRow {
  return {
    playerId: name,
    name,
    currentIndexDisplay: '10.0',
    attendancePoints: 0,
    strokePoints: 0,
    matchPlayPoints: 0,
    ctpWins: 0,
    lpWins: 0,
    ...points
  }
}

const rows: PrintStandingRow[] = [
  row('Amy Adams', { overallPoints: 30, summerPoints: 5, springPoints: 25 }),
  row('Bob Baker', { overallPoints: 20, summerPoints: 18, springPoints: 2 }),
  row('Cal Carter', { overallPoints: 20, summerPoints: 12, springPoints: 8 })
]

describe('print standings sorting', () => {
  it.each(columns)('sorts descending by %s', (sortKey) => {
    const sorted = sortPrintStandings(rows, sortKey)

    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i - 1][sortKey]).toBeGreaterThanOrEqual(sorted[i][sortKey])
    }
  })

  it('orders each season column independently', () => {
    expect(sortPrintStandings(rows, 'overallPoints').map((r) => r.name)).toEqual([
      'Amy Adams',
      'Bob Baker',
      'Cal Carter'
    ])
    expect(sortPrintStandings(rows, 'summerPoints').map((r) => r.name)).toEqual([
      'Bob Baker',
      'Cal Carter',
      'Amy Adams'
    ])
    expect(sortPrintStandings(rows, 'springPoints').map((r) => r.name)).toEqual([
      'Amy Adams',
      'Cal Carter',
      'Bob Baker'
    ])
  })

  it('breaks ties by surname', () => {
    const tied = [
      row('Zed Alpha', { overallPoints: 10, summerPoints: 0, springPoints: 0 }),
      row('Amy Zulu', { overallPoints: 10, summerPoints: 0, springPoints: 0 })
    ]

    expect(sortPrintStandings(tied, 'overallPoints').map((r) => r.name)).toEqual([
      'Zed Alpha',
      'Amy Zulu'
    ])
  })

  it('does not mutate the source rows', () => {
    const original = [...rows]
    sortPrintStandings(rows, 'summerPoints')
    expect(rows).toEqual(original)
  })

  it.each(columns)('returns an empty list for %s when there are no players', (sortKey) => {
    expect(sortPrintStandings([], sortKey)).toEqual([])
  })

  it('keeps every player when all points are tied', () => {
    const tied = ['Amy Adams', 'Bob Baker', 'Cal Carter'].map((name) =>
      row(name, { overallPoints: 0, summerPoints: 0, springPoints: 0 })
    )

    expect(sortPrintStandings(tied, 'springPoints').map((r) => r.name)).toEqual([
      'Amy Adams',
      'Bob Baker',
      'Cal Carter'
    ])
  })
})

describe('print standings sort emphasis', () => {
  it.each(columns)('only emphasizes the active column when sorting by %s', (sortKey) => {
    for (const columnKey of columns) {
      expect(getPrintStandingsValueClass(columnKey, sortKey)).toBe(
        columnKey === sortKey ? 'font-semibold' : ''
      )
    }
  })

  it('labels each sort key', () => {
    expect(getPrintStandingsSortLabel('overallPoints')).toBe('Overall')
    expect(getPrintStandingsSortLabel('summerPoints')).toBe('Summer')
    expect(getPrintStandingsSortLabel('springPoints')).toBe('Spring')
  })
})

describe('resolveActiveSortKey', () => {
  it.each(columns)('honors the chosen %s column in multi-season leagues', (sortKey) => {
    expect(resolveActiveSortKey(true, sortKey)).toBe(sortKey)
  })

  it.each(columns)('pins single-season leagues to Overall even when state holds %s', (sortKey) => {
    expect(resolveActiveSortKey(false, sortKey)).toBe('overallPoints')
  })

  it('keeps single-season emphasis on the only points column', () => {
    const active = resolveActiveSortKey(false, 'springPoints')
    expect(getPrintStandingsValueClass('overallPoints', active)).toBe('font-semibold')
  })
})

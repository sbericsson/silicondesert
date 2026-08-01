import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPublicMatchHoleData } from '@/lib/public-week'
import { getPlayerSurname } from '@/lib/player-sort'

export const revalidate = 60
export const dynamic = 'force-dynamic'

type PublicMatchHoleData = NonNullable<Awaited<ReturnType<typeof getPublicMatchHoleData>>>

function formatScore(value: number | null) {
  return value === null ? '-' : String(value)
}

function formatCompactName(name: string) {
  return getPlayerSurname(name)
}

function formatMatchState(lead: number, player1Name: string, player2Name: string) {
  if (lead === 0) {
    return 'AS'
  }

  return lead > 0
    ? `${formatCompactName(player1Name)} ${lead} up`
    : `${formatCompactName(player2Name)} ${Math.abs(lead)} up`
}

function formatClinchedMatchState(lead: number, holesRemaining: number, player1Name: string, player2Name: string) {
  const winnerName = lead > 0 ? formatCompactName(player1Name) : formatCompactName(player2Name)

  return holesRemaining === 0
    ? `${winnerName} ${Math.abs(lead)} up`
    : `${winnerName} ${Math.abs(lead)}&${holesRemaining}`
}

function getHoleRows(data: PublicMatchHoleData) {
  let lead = 0
  let matchClosed = false

  return data.rows.map((row, index) => {
    let holeResult = 'Pending'
    let matchState = '-'

    if (row.player1Net !== null && row.player2Net !== null) {
      if (row.player1Net < row.player2Net) {
        lead += 1
        holeResult = formatCompactName(data.match.player1.name)
      } else if (row.player2Net < row.player1Net) {
        lead -= 1
        holeResult = formatCompactName(data.match.player2.name)
      } else {
        holeResult = 'Halved'
      }

      if (!matchClosed) {
        const holesRemaining = data.rows.length - index - 1
        const clinched = Math.abs(lead) > holesRemaining

        matchState = clinched
          ? formatClinchedMatchState(lead, holesRemaining, data.match.player1.name, data.match.player2.name)
          : formatMatchState(lead, data.match.player1.name, data.match.player2.name)
        matchClosed = clinched
      } else {
        holeResult = ''
        matchState = ''
      }
    }

    return {
      ...row,
      holeResult,
      matchState
    }
  })
}

function getTotals(data: PublicMatchHoleData) {
  return data.rows.reduce(
    (totals, row) => ({
      player1Gross: totals.player1Gross + (row.player1Gross ?? 0),
      player1Adj: totals.player1Adj + (row.player1Adj ?? 0),
      player1Net: totals.player1Net + (row.player1Net ?? 0),
      player2Gross: totals.player2Gross + (row.player2Gross ?? 0),
      player2Adj: totals.player2Adj + (row.player2Adj ?? 0),
      player2Net: totals.player2Net + (row.player2Net ?? 0)
    }),
    {
      player1Gross: 0,
      player1Adj: 0,
      player1Net: 0,
      player2Gross: 0,
      player2Adj: 0,
      player2Net: 0
    }
  )
}

export async function generateMetadata({
  params
}: {
  params: { id: string; matchId: string }
}): Promise<Metadata> {
  const data = await getPublicMatchHoleData(params.id, params.matchId)

  if (!data) {
    return {
      title: 'Match Results - Silicon Desert Golf League'
    }
  }

  return {
    title: `${data.match.label}: ${data.match.player1.name} vs ${data.match.player2.name} - Week ${data.week.weekNumber}`,
    description: `${data.week.courseName} - ${data.week.dateLabel}`
  }
}

export default async function PublicMatchDetailPage({
  params
}: {
  params: { id: string; matchId: string }
}) {
  const data = await getPublicMatchHoleData(params.id, params.matchId)

  if (!data) {
    notFound()
  }

  const rows = getHoleRows(data)
  const totals = getTotals(data)

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/public/weeks/${data.week.id}`}
          className="font-condensed text-xs font-semibold uppercase tracking-widest text-accent-text"
        >
          ← Week {data.week.weekNumber}
        </Link>
        <p className="text-right text-xs text-text-secondary">
          {data.week.dateLabel} · {data.week.courseName}
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-surface-border bg-surface-elevated p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-condensed text-xs font-bold uppercase tracking-widest text-accent-text">
              {data.match.label}
            </p>
            <h2 className="font-condensed mt-1.5 text-2xl font-bold uppercase tracking-wide text-text-primary">
              {data.match.player1.name} vs {data.match.player2.name}
            </h2>
          </div>
          {data.match.isThreesome ? (
            <span className="rounded-full bg-surface-sunken px-3 py-1 font-condensed text-[11px] font-semibold uppercase tracking-widest text-text-secondary">
              Reference Scorecard
            </span>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-surface-border bg-surface-base p-4">
            <p className="font-condensed text-[11px] font-bold uppercase tracking-widest text-text-muted">
              Stroke
            </p>
            <p className="mt-2 text-sm font-semibold text-text-primary">{data.match.strokeSummary}</p>
          </div>
          <div className="rounded-2xl border border-surface-border bg-surface-base p-4">
            <p className="font-condensed text-[11px] font-bold uppercase tracking-widest text-text-muted">
              Match Play
            </p>
            <p className="mt-2 text-sm font-semibold text-text-primary">{data.match.matchPlaySummary}</p>
          </div>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-surface-border bg-surface-elevated shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] table-fixed border-collapse text-sm">
            <colgroup>
              <col className="w-10" />
              <col className="w-10" />
              <col className="w-10" />
              <col className="w-20" />
              <col className="w-14" />
              <col className="w-14" />
              <col className="w-20" />
              <col className="w-14" />
              <col className="w-14" />
              <col className="w-24" />
              <col className="w-24" />
            </colgroup>
            <thead>
              <tr className="border-b border-surface-border bg-surface-sunken text-left font-condensed text-[11px] font-bold uppercase tracking-widest text-text-muted">
                <th className="px-2 py-3">Hole</th>
                <th className="px-2 py-3 text-right">Par</th>
                <th className="px-2 py-3 text-right">SI</th>
                <th className="px-2 py-3 text-right">{formatCompactName(data.match.player1.name)}</th>
                <th className="px-2 py-3 text-right">Pops</th>
                <th className="px-2 py-3 text-right">Net</th>
                <th className="px-2 py-3 text-right">{formatCompactName(data.match.player2.name)}</th>
                <th className="px-2 py-3 text-right">Pops</th>
                <th className="px-2 py-3 text-right">Net</th>
                <th className="px-2 py-3">Hole</th>
                <th className="px-2 py-3">Match</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.holeNumber} className="border-b border-surface-border last:border-0">
                  <td className="px-2 py-3 font-semibold text-text-primary">{row.holeNumber}</td>
                  <td className="px-2 py-3 text-right tabular-nums text-text-secondary">{row.par}</td>
                  <td className="px-2 py-3 text-right tabular-nums text-text-secondary">{row.strokeIndex}</td>
                  <td className="px-2 py-3 text-right tabular-nums font-semibold text-text-primary">
                    {formatScore(row.player1Gross)}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums text-accent-text">
                    {row.player1StrokesReceived || '-'}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums text-text-secondary">
                    {formatScore(row.player1Net)}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums font-semibold text-text-primary">
                    {formatScore(row.player2Gross)}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums text-accent-text">
                    {row.player2StrokesReceived || '-'}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums text-text-secondary">
                    {formatScore(row.player2Net)}
                  </td>
                  <td className="px-2 py-3 font-medium text-text-primary">{row.holeResult}</td>
                  <td className="px-2 py-3 text-text-secondary">{row.matchState}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-surface-border bg-surface-sunken font-semibold">
                <td className="px-2 py-3 text-text-primary">Total</td>
                <td className="px-2 py-3" />
                <td className="px-2 py-3" />
                <td className="px-2 py-3 text-right tabular-nums text-text-primary">{totals.player1Gross}</td>
                <td className="px-2 py-3" />
                <td className="px-2 py-3 text-right tabular-nums text-text-primary">{totals.player1Net}</td>
                <td className="px-2 py-3 text-right tabular-nums text-text-primary">{totals.player2Gross}</td>
                <td className="px-2 py-3" />
                <td className="px-2 py-3 text-right tabular-nums text-text-primary">{totals.player2Net}</td>
                <td className="px-2 py-3" />
                <td className="px-2 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-surface-border bg-surface-elevated p-4">
          <p className="font-condensed text-[11px] font-bold uppercase tracking-widest text-text-muted">
            {data.match.player1.name}
          </p>
          <p className="mt-2 text-sm text-text-secondary">
            Gross {totals.player1Gross} · Adj {totals.player1Adj} · Net {totals.player1Net}
          </p>
          <p className="mt-1 text-sm font-semibold text-text-primary">
            {data.match.player1Points} pts · Handicap {data.match.player1.playingHandicap}
          </p>
        </div>
        <div className="rounded-2xl border border-surface-border bg-surface-elevated p-4">
          <p className="font-condensed text-[11px] font-bold uppercase tracking-widest text-text-muted">
            {data.match.player2.name}
          </p>
          <p className="mt-2 text-sm text-text-secondary">
            Gross {totals.player2Gross} · Adj {totals.player2Adj} · Net {totals.player2Net}
          </p>
          <p className="mt-1 text-sm font-semibold text-text-primary">
            {data.match.player2Points} pts · Handicap {data.match.player2.playingHandicap}
          </p>
        </div>
      </section>

      <p className="text-xs text-text-secondary">
        Handicap basis: {data.week.handicapModeLabel}. Adjusted gross is shown for posting; match results use gross scores with pops.
      </p>
    </section>
  )
}

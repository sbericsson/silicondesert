'use client'

import type { TeeColor } from '@prisma/client'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { applyESC } from '@/lib/handicap'
import { calculateMatchPlayResult, calculateMatchPoints } from '@/lib/scoring'

type MatchScorePageData = {
  match: {
    id: string
    weekId: string
    weekLabel: string
    courseName: string
    handicapMode: 'index' | 'course'
    handicapModeLabel: string
    ctpHoleNumber: number | null
    locked: boolean
    seasonArchived: boolean
    weekCompleted: boolean
    player2ScorecardOnly: boolean
    matchPlayLeadBy: number | null
    matchPlayHolesRemaining: number | null
    matchPlayWinnerId: string | null
    player1: {
      id: string
      name: string
      teeColor: TeeColor
      handicapIndex: number
      playingHandicap: number
      courseHandicap: number
      present: boolean
    }
    player2: {
      id: string
      name: string
      teeColor: TeeColor
      handicapIndex: number
      playingHandicap: number
      courseHandicap: number
      present: boolean
    }
    player1NetTotal: number | null
    player2NetTotal: number | null
    nextPendingMatchId: string | null
  }
  rows: Array<{
    holeNumber: number
    par: number
    strokeIndex: number
    player1StrokesReceived: number
    player2StrokesReceived: number
    player1Gross: number | null
    player1Adj: number | null
    player1Net: number | null
    player2Gross: number | null
    player2Adj: number | null
    player2Net: number | null
  }>
}

interface MatchScoreClientProps {
  initialData: MatchScorePageData
  returnHref: string
}

function formatMatchPlayLabel(
  result: {
    matchPlayWinnerId: string | null
    matchPlayLeadBy: number
    matchPlayHolesRemaining: number
    completeHoleCount: number
  } | null,
  player1: { id: string; name: string },
  player2: { id: string; name: string }
) {
  if (!result) {
    return 'Enter scores to calculate match play.'
  }

  if (result.completeHoleCount < 9 && result.matchPlayLeadBy === 0) {
    return `All square through ${result.completeHoleCount}.`
  }

  const winnerName =
    result.matchPlayWinnerId === player1.id
      ? player1.name
      : result.matchPlayWinnerId === player2.id
        ? player2.name
        : null

  if (result.matchPlayWinnerId === null) {
    return result.matchPlayHolesRemaining === 0
      ? 'Match halved.'
      : `All square through ${result.completeHoleCount}.`
  }

  if (result.matchPlayHolesRemaining === 0) {
    return `${winnerName} ${result.matchPlayLeadBy} up.`
  }

  if (result.matchPlayLeadBy > result.matchPlayHolesRemaining) {
    return `${winnerName} ${result.matchPlayLeadBy} & ${result.matchPlayHolesRemaining}.`
  }

  return `${winnerName} ${result.matchPlayLeadBy} up.`
}

function formatHoleList(holes: number[]) {
  if (holes.length === 0) {
    return ''
  }

  if (holes.length === 1) {
    return `Hole ${holes[0]}`
  }

  return `Holes ${holes.join(', ')}`
}

export function MatchScoreClient({ initialData, returnHref }: MatchScoreClientProps) {
  const router = useRouter()
  const backLabel = returnHref === '/history' ? 'Back to History' : 'Back to Week'
  const [player1Scores, setPlayer1Scores] = useState<Record<number, string>>(
    Object.fromEntries(initialData.rows.map((row) => [row.holeNumber, row.player1Gross?.toString() ?? '']))
  )
  const [player2Scores, setPlayer2Scores] = useState<Record<number, string>>(
    Object.fromEntries(initialData.rows.map((row) => [row.holeNumber, row.player2Gross?.toString() ?? '']))
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const computedRows = useMemo(() => {
    return initialData.rows.map((row) => {
      const p1Gross = player1Scores[row.holeNumber] === '' ? null : Number(player1Scores[row.holeNumber])
      const p2Gross = player2Scores[row.holeNumber] === '' ? null : Number(player2Scores[row.holeNumber])
      const p1Adj = p1Gross === null ? null : applyESC(p1Gross, row.par, row.player1StrokesReceived)
      const p2Adj = p2Gross === null ? null : applyESC(p2Gross, row.par, row.player2StrokesReceived)

      return {
        ...row,
        player1Gross: p1Gross,
        player1Adj: p1Adj,
        player1Net: p1Gross === null ? null : p1Gross - row.player1StrokesReceived,
        player2Gross: p2Gross,
        player2Adj: p2Adj,
        player2Net: p2Gross === null ? null : p2Gross - row.player2StrokesReceived
      }
    })
  }, [initialData.rows, player1Scores, player2Scores])

  const completeHoleCount = computedRows.filter(
    (row) => row.player1Gross !== null && row.player2Gross !== null
  ).length
  const isComplete = completeHoleCount === 9

  const totals = {
    player1Gross: computedRows.reduce((sum, row) => sum + (row.player1Gross ?? 0), 0),
    player1Adj: computedRows.reduce((sum, row) => sum + (row.player1Adj ?? 0), 0),
    player1Net: computedRows.reduce((sum, row) => sum + (row.player1Net ?? 0), 0),
    player2Gross: computedRows.reduce((sum, row) => sum + (row.player2Gross ?? 0), 0),
    player2Adj: computedRows.reduce((sum, row) => sum + (row.player2Adj ?? 0), 0),
    player2Net: computedRows.reduce((sum, row) => sum + (row.player2Net ?? 0), 0)
  }

  const player1PopHoles = computedRows.filter((row) => row.player1StrokesReceived > 0)
  const player2PopHoles = computedRows.filter((row) => row.player2StrokesReceived > 0)

  const matchPlayResult = calculateMatchPlayResult(
    computedRows.map((row) => ({
      player1Net: row.player1Net,
      player2Net: row.player2Net
    })),
    initialData.match.player1.id,
    initialData.match.player2.id
  )

  const pointsPreview = isComplete && matchPlayResult
    ? calculateMatchPoints(
        {
          player1Id: initialData.match.player1.id,
          player2Id: initialData.match.player2.id,
          player1NetScore: totals.player1Net,
          player2NetScore: totals.player2Net,
          matchPlayWinnerId: matchPlayResult.matchPlayWinnerId,
          matchPlayLeadBy: matchPlayResult.matchPlayLeadBy,
          player2ScorecardOnly: initialData.match.player2ScorecardOnly
        },
        initialData.match.player1.present,
        initialData.match.player2.present
      )
    : null

  async function handleSubmit() {
    if (!isComplete || !matchPlayResult) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    const response = await fetch(
      `/api/weeks/${initialData.match.weekId}/matches/${initialData.match.id}/scores`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          player1Scores: computedRows.map((row) => ({
            holeNumber: row.holeNumber,
            grossScore: row.player1Gross
          })),
          player2Scores: computedRows.map((row) => ({
            holeNumber: row.holeNumber,
            grossScore: row.player2Gross
          }))
        })
      }
    )

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? 'Unable to submit scores')
      setIsSubmitting(false)
      return
    }

    const payload = await response.json().catch(() => null)

    router.push(
      initialData.match.weekCompleted
        ? returnHref
        : payload?.nextPendingMatchId
          ? `/week/matches/${payload.nextPendingMatchId}`
          : returnHref
    )
    router.refresh()
  }

  function setScore(
    player: 'player1' | 'player2',
    holeNumber: number,
    value: string
  ) {
    const sanitized = value.replace(/[^0-9]/g, '')
    const setter = player === 'player1' ? setPlayer1Scores : setPlayer2Scores

    setter((current) => ({
      ...current,
      [holeNumber]: sanitized
    }))
  }

  return (
    <section className="space-y-4 px-4 py-6">
      <div className="rounded-xl border border-surface-border bg-surface-elevated p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
              Score Entry
            </p>
            <h2 className="font-condensed mt-2 text-2xl font-bold uppercase tracking-wide text-text-primary">{initialData.match.weekLabel}</h2>
            <p className="mt-2 text-sm text-text-secondary">
              {initialData.match.courseName} · {initialData.match.player1.teeColor.toUpperCase()} / {initialData.match.player2.teeColor.toUpperCase()}
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              Competition basis: {initialData.match.handicapModeLabel}. Adjusted gross is for handicap posting only; match net and points use gross scores with pops.
            </p>
            {player1PopHoles.length > 0 || player2PopHoles.length > 0 ? (
              <div className="mt-2 space-y-1 text-xs text-text-secondary">
                {player1PopHoles.length > 0 ? (
                  <p>
                    {initialData.match.player1.name} gets{' '}
                    {player1PopHoles[0]?.player1StrokesReceived}{' '}
                    pop{player1PopHoles[0]?.player1StrokesReceived === 1 ? '' : 's'} on{' '}
                    {formatHoleList(player1PopHoles.map((row) => row.holeNumber))}.
                  </p>
                ) : null}
                {player2PopHoles.length > 0 ? (
                  <p>
                    {initialData.match.player2.name} gets{' '}
                    {player2PopHoles[0]?.player2StrokesReceived}{' '}
                    pop{player2PopHoles[0]?.player2StrokesReceived === 1 ? '' : 's'} on{' '}
                    {formatHoleList(player2PopHoles.map((row) => row.holeNumber))}.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          <Link className="text-sm text-accent-text" href={returnHref}>
            {backLabel}
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-danger bg-danger-dim px-4 py-3 text-sm text-danger-text">
          {error}
        </div>
      ) : null}

      {initialData.match.seasonArchived ? (
        <div className="rounded-md border border-warning bg-warning/10 px-4 py-3 text-sm text-warning-text">
          This season is archived. Scores remain visible, but edits are disabled.
        </div>
      ) : initialData.match.weekCompleted ? (
        <div className="rounded-md border border-warning bg-warning/10 px-4 py-3 text-sm text-warning-text">
          This week has been closed. You can still correct saved scores here, and the history and public results pages will update after you save.
        </div>
      ) : null}

      <div className="rounded-md border-l-[3px] border-accent bg-accent-dim px-4 py-3 text-sm text-accent-text">
        {completeHoleCount} of 9 holes entered
      </div>

      <section className="overflow-hidden rounded-xl border border-surface-border bg-surface-elevated">
        <div className="grid grid-cols-[60px_60px_60px_1fr_1fr] gap-2 border-b border-surface-border bg-surface-sunken px-3 py-2 font-condensed text-[11px] font-bold uppercase tracking-widest text-text-muted">
          <span>Hole</span>
          <span>Par</span>
          <span>SI</span>
          <span>{initialData.match.player1.name}</span>
          <span>{initialData.match.player2.name}</span>
        </div>
        <div className="divide-y divide-surface-border">
          {computedRows.map((row) => (
            <div
              key={row.holeNumber}
              className={`grid grid-cols-[60px_60px_60px_1fr_1fr] gap-2 px-3 py-3 ${
                initialData.match.ctpHoleNumber === row.holeNumber ? 'bg-accent-dim/60' : ''
              }`}
            >
              <span className="text-sm font-semibold text-text-primary">{row.holeNumber}</span>
              <span className="text-sm text-text-secondary">{row.par}</span>
              <span className="text-sm text-text-secondary">{row.strokeIndex}</span>
              <div className="space-y-2">
                <input
                  className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2 text-center text-lg font-bold text-text-primary"
                  inputMode="numeric"
                  value={player1Scores[row.holeNumber]}
                  onChange={(event) => setScore('player1', row.holeNumber, event.target.value)}
                  disabled={initialData.match.seasonArchived}
                />
                <p
                  className={`text-xs font-semibold ${
                    row.player1StrokesReceived > 0 ? 'text-accent-text' : 'text-transparent'
                  }`}
                >
                  {row.player1StrokesReceived > 0
                    ? `${row.player1StrokesReceived} pop${row.player1StrokesReceived === 1 ? '' : 's'}`
                    : 'No pop'}
                </p>
                <p className={`text-xs ${row.player1Gross !== row.player1Adj ? 'text-warning-text' : 'text-text-secondary'}`}>
                  Adj {row.player1Adj ?? '—'} · Match Net {row.player1Net ?? '—'}
                </p>
              </div>
              <div className="space-y-2">
                <input
                  className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2 text-center text-lg font-bold text-text-primary"
                  inputMode="numeric"
                  value={player2Scores[row.holeNumber]}
                  onChange={(event) => setScore('player2', row.holeNumber, event.target.value)}
                  disabled={initialData.match.seasonArchived}
                />
                <p
                  className={`text-xs font-semibold ${
                    row.player2StrokesReceived > 0 ? 'text-accent-text' : 'text-transparent'
                  }`}
                >
                  {row.player2StrokesReceived > 0
                    ? `${row.player2StrokesReceived} pop${row.player2StrokesReceived === 1 ? '' : 's'}`
                    : 'No pop'}
                </p>
                <p className={`text-xs ${row.player2Gross !== row.player2Adj ? 'text-warning-text' : 'text-text-secondary'}`}>
                  Adj {row.player2Adj ?? '—'} · Match Net {row.player2Net ?? '—'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-surface-border bg-surface-elevated p-4">
          <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
            Totals
          </p>
          <div className="mt-3 space-y-2 text-sm text-text-secondary">
            <p>
              {initialData.match.player1.name}: Gross {totals.player1Gross} · Adj {totals.player1Adj} · Match Net {totals.player1Net}
            </p>
            <p>
              {initialData.match.player2.name}: Gross {totals.player2Gross} · Adj {totals.player2Adj} · Match Net {totals.player2Net}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-elevated p-4">
          <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
            Match Play
          </p>
          <p className="mt-3 text-base font-semibold text-text-primary">
            {formatMatchPlayLabel(
              matchPlayResult,
              initialData.match.player1,
              initialData.match.player2
            )}
          </p>
          <p className="mt-2 text-xs text-text-secondary">
            Match play updates automatically from each hole&apos;s match net result.
          </p>
        </div>
      </section>

      {pointsPreview ? (
        <section className="rounded-xl border border-surface-border bg-accent-dim p-4">
          <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
            Points Preview
          </p>
          <div className="mt-3 space-y-2 text-sm text-accent-text">
            <p>
              {initialData.match.player1.name}: {pointsPreview.player1Points} pts
            </p>
            <p>
              {initialData.match.player2.name}: {pointsPreview.player2Points} pts
            </p>
          </div>
        </section>
      ) : null}

      <button
        type="button"
        className="font-condensed w-full rounded-lg bg-accent px-4 py-4 text-base font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-disabled"
        disabled={!isComplete || isSubmitting || initialData.match.seasonArchived}
        onClick={handleSubmit}
      >
        {initialData.match.seasonArchived
          ? 'Season Archived'
          : !isComplete
            ? `Submit Scores (${9 - completeHoleCount} holes remaining)`
            : isSubmitting
              ? 'Saving...'
              : initialData.match.weekCompleted
                ? 'Save Corrected Scores'
                : initialData.match.nextPendingMatchId
                  ? 'Save Scores & Next Match'
                  : 'Submit Scores'}
      </button>
    </section>
  )
}

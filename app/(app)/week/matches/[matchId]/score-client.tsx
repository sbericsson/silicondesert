'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { applyESC, strokesReceivedOnHole } from '@/lib/handicap'
import { calculateMatchPoints } from '@/lib/scoring'

type MatchScorePageData = {
  match: {
    id: string
    weekId: string
    weekLabel: string
    courseName: string
    ctpHoleNumber: number | null
    locked: boolean
    player2ScorecardOnly: boolean
    matchPlayLeadBy: number | null
    matchPlayHolesRemaining: number | null
    matchPlayWinnerId: string | null
    player1: {
      id: string
      name: string
      handicapIndex: number
      courseHandicap: number
      present: boolean
    }
    player2: {
      id: string
      name: string
      handicapIndex: number
      courseHandicap: number
      present: boolean
    }
    player1NetTotal: number | null
    player2NetTotal: number | null
  }
  rows: Array<{
    holeNumber: number
    par: number
    strokeIndex: number
    player1StrokesReceived: 0 | 1 | 2
    player2StrokesReceived: 0 | 1 | 2
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
}

const matchPlayOptions = [
  { label: 'Select result...', leadBy: null, holesRemaining: null, winner: null },
  { label: 'All square', leadBy: 0, holesRemaining: 0, winner: null },
  { label: '1 up', leadBy: 1, holesRemaining: 0, winner: 'dynamic' as const },
  { label: '2 & 1', leadBy: 2, holesRemaining: 1, winner: 'dynamic' as const },
  { label: '3 & 2', leadBy: 3, holesRemaining: 2, winner: 'dynamic' as const },
  { label: '4 & 3', leadBy: 4, holesRemaining: 3, winner: 'dynamic' as const },
  { label: '5 & 4', leadBy: 5, holesRemaining: 4, winner: 'dynamic' as const },
  { label: '6 & 5', leadBy: 6, holesRemaining: 5, winner: 'dynamic' as const },
  { label: '7 & 6', leadBy: 7, holesRemaining: 6, winner: 'dynamic' as const },
  { label: '8 & 7', leadBy: 8, holesRemaining: 7, winner: 'dynamic' as const }
]

function buildMatchPlayValue(leadBy: number | null, holesRemaining: number | null, winnerId: string | null) {
  if (leadBy === null || holesRemaining === null && leadBy !== 1 && leadBy !== 0) {
    return ''
  }

  return `${winnerId ?? 'tie'}:${leadBy}:${holesRemaining ?? 0}`
}

export function MatchScoreClient({ initialData }: MatchScoreClientProps) {
  const router = useRouter()
  const [player1Scores, setPlayer1Scores] = useState<Record<number, string>>(
    Object.fromEntries(initialData.rows.map((row) => [row.holeNumber, row.player1Gross?.toString() ?? '']))
  )
  const [player2Scores, setPlayer2Scores] = useState<Record<number, string>>(
    Object.fromEntries(initialData.rows.map((row) => [row.holeNumber, row.player2Gross?.toString() ?? '']))
  )
  const [matchPlayValue, setMatchPlayValue] = useState(
    initialData.match.matchPlayLeadBy === null
      ? ''
      : buildMatchPlayValue(
          initialData.match.matchPlayLeadBy,
          initialData.match.matchPlayHolesRemaining,
          initialData.match.matchPlayWinnerId
        )
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
        player1Net: p1Adj === null ? null : p1Adj - row.player1StrokesReceived,
        player2Gross: p2Gross,
        player2Adj: p2Adj,
        player2Net: p2Adj === null ? null : p2Adj - row.player2StrokesReceived
      }
    })
  }, [initialData.rows, player1Scores, player2Scores])

  const completeHoleCount = computedRows.filter(
    (row) => row.player1Gross !== null && row.player2Gross !== null
  ).length
  const isComplete = completeHoleCount === 9 && matchPlayValue !== ''

  const totals = {
    player1Gross: computedRows.reduce((sum, row) => sum + (row.player1Gross ?? 0), 0),
    player1Adj: computedRows.reduce((sum, row) => sum + (row.player1Adj ?? 0), 0),
    player1Net: computedRows.reduce((sum, row) => sum + (row.player1Net ?? 0), 0),
    player2Gross: computedRows.reduce((sum, row) => sum + (row.player2Gross ?? 0), 0),
    player2Adj: computedRows.reduce((sum, row) => sum + (row.player2Adj ?? 0), 0),
    player2Net: computedRows.reduce((sum, row) => sum + (row.player2Net ?? 0), 0)
  }

  const parsedMatchPlay = (() => {
    if (!matchPlayValue) {
      return null
    }

    const [winnerId, leadBy, holesRemaining] = matchPlayValue.split(':')
    return {
      matchPlayWinnerId: winnerId === 'tie' ? null : winnerId,
      matchPlayLeadBy: Number(leadBy),
      matchPlayHolesRemaining: Number(holesRemaining)
    }
  })()

  const pointsPreview = isComplete && parsedMatchPlay
    ? calculateMatchPoints(
        {
          player1Id: initialData.match.player1.id,
          player2Id: initialData.match.player2.id,
          player1NetScore: totals.player1Net,
          player2NetScore: totals.player2Net,
          matchPlayWinnerId: parsedMatchPlay.matchPlayWinnerId,
          matchPlayLeadBy: parsedMatchPlay.matchPlayLeadBy,
          player2ScorecardOnly: initialData.match.player2ScorecardOnly
        },
        initialData.match.player1.present,
        initialData.match.player2.present
      )
    : null

  async function handleSubmit() {
    if (!isComplete || !parsedMatchPlay) {
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
          })),
          ...parsedMatchPlay
        })
      }
    )

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? 'Unable to submit scores')
      setIsSubmitting(false)
      return
    }

    router.push('/week')
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
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
              Score Entry
            </p>
            <h2 className="mt-2 text-xl font-bold text-text-primary">{initialData.match.weekLabel}</h2>
            <p className="mt-2 text-sm text-text-secondary">{initialData.match.courseName}</p>
          </div>
          <Link className="text-sm text-accent-text" href="/week">
            Back to Week
          </Link>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-danger bg-danger-dim px-4 py-3 text-sm text-danger-text">
          {error}
        </div>
      ) : null}

      <div className="rounded-md border-l-[3px] border-accent bg-accent-dim px-4 py-3 text-sm text-accent-text">
        {completeHoleCount} of 9 holes entered
      </div>

      <section className="overflow-hidden rounded-xl border border-surface-border bg-surface-elevated">
        <div className="grid grid-cols-[60px_60px_60px_1fr_1fr] gap-2 border-b border-surface-border bg-surface-sunken px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted">
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
                />
                <p className={`text-xs ${row.player1Gross !== row.player1Adj ? 'text-warning-text' : 'text-text-secondary'}`}>
                  Adj {row.player1Adj ?? '—'} · Net {row.player1Net ?? '—'}
                </p>
              </div>
              <div className="space-y-2">
                <input
                  className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2 text-center text-lg font-bold text-text-primary"
                  inputMode="numeric"
                  value={player2Scores[row.holeNumber]}
                  onChange={(event) => setScore('player2', row.holeNumber, event.target.value)}
                />
                <p className={`text-xs ${row.player2Gross !== row.player2Adj ? 'text-warning-text' : 'text-text-secondary'}`}>
                  Adj {row.player2Adj ?? '—'} · Net {row.player2Net ?? '—'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-surface-border bg-surface-elevated p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
            Totals
          </p>
          <div className="mt-3 space-y-2 text-sm text-text-secondary">
            <p>
              {initialData.match.player1.name}: Gross {totals.player1Gross} · Adj {totals.player1Adj} · Net {totals.player1Net}
            </p>
            <p>
              {initialData.match.player2.name}: Gross {totals.player2Gross} · Adj {totals.player2Adj} · Net {totals.player2Net}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-surface-border bg-surface-elevated p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
            Match Play Result
          </p>
          <select
            className="mt-3 w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
            value={matchPlayValue}
            onChange={(event) => setMatchPlayValue(event.target.value)}
          >
            {matchPlayOptions.flatMap((option) => {
              if (option.winner !== 'dynamic') {
                return (
                  <option
                    key={option.label}
                    value={
                      option.leadBy === null
                        ? ''
                        : `${option.winner ?? 'tie'}:${option.leadBy}:${option.holesRemaining ?? 0}`
                    }
                  >
                    {option.label}
                  </option>
                )
              }

              return [
                <option
                  key={`${option.label}-${initialData.match.player1.id}`}
                  value={`${initialData.match.player1.id}:${option.leadBy}:${option.holesRemaining}`}
                >
                  {initialData.match.player1.name} {option.label}
                </option>,
                <option
                  key={`${option.label}-${initialData.match.player2.id}`}
                  value={`${initialData.match.player2.id}:${option.leadBy}:${option.holesRemaining}`}
                >
                  {initialData.match.player2.name} {option.label}
                </option>
              ]
            })}
          </select>
        </div>
      </section>

      {pointsPreview ? (
        <section className="rounded-xl border border-surface-border bg-accent-dim p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
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
        className="w-full rounded-lg bg-accent px-4 py-4 text-base font-semibold text-white disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-disabled"
        disabled={!isComplete || isSubmitting}
        onClick={handleSubmit}
      >
        {!isComplete
          ? `Submit Scores (${9 - completeHoleCount} holes remaining)`
          : isSubmitting
            ? 'Saving...'
            : 'Submit Scores'}
      </button>
    </section>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { applyESC } from '@/lib/handicap'
import { calculateMatchPlayResult, calculateMatchPoints } from '@/lib/scoring'

type MatchTab = {
  id: string
  player1Name: string
  player2Name: string
  scoreComplete: boolean
  player2ScorecardOnly: boolean
  weekId: string
}

type MatchScoreData = {
  match: {
    id: string
    weekId: string
    ctpHoleNumber: number | null
    locked: boolean
    seasonArchived: boolean
    weekCompleted: boolean
    player2ScorecardOnly: boolean
    player1: { id: string; name: string; playingHandicap: number; present: boolean }
    player2: { id: string; name: string; playingHandicap: number; present: boolean }
    player1NetTotal: number | null
    player2NetTotal: number | null
  }
  rows: Array<{
    holeNumber: number
    par: number
    strokeIndex: number
    player1StrokesReceived: number
    player1AdjustedStrokesReceived: number
    player2StrokesReceived: number
    player2AdjustedStrokesReceived: number
    player1Gross: number | null
    player1Adj: number | null
    player1Net: number | null
    player2Gross: number | null
    player2Adj: number | null
    player2Net: number | null
  }>
}

function formatMatchPlay(
  result: { matchPlayWinnerId: string | null; matchPlayLeadBy: number; matchPlayHolesRemaining: number; completeHoleCount: number } | null,
  p1: { id: string; name: string },
  p2: { id: string; name: string }
) {
  if (!result) return 'Enter scores to calculate match play.'
  if (result.completeHoleCount === 0) return 'Enter scores to calculate match play.'
  if (result.matchPlayLeadBy === 0) {
    return result.completeHoleCount === 9 ? 'Match halved.' : `All square through ${result.completeHoleCount}.`
  }
  const winner = result.matchPlayWinnerId === p1.id ? p1.name : p2.name
  if (result.matchPlayHolesRemaining === 0) return `${winner} ${result.matchPlayLeadBy} up.`
  if (result.matchPlayLeadBy > result.matchPlayHolesRemaining) {
    return `${winner} ${result.matchPlayLeadBy} & ${result.matchPlayHolesRemaining}.`
  }
  return `${winner} ${result.matchPlayLeadBy} up.`
}

interface DesktopScoreEntryProps {
  matches: MatchTab[]
}

export function DesktopScoreEntry({ matches }: DesktopScoreEntryProps) {
  const router = useRouter()
  const [selectedMatchId, setSelectedMatchId] = useState<string>(
    matches.find((m) => !m.scoreComplete)?.id ?? matches[0]?.id ?? ''
  )
  const [matchDataCache, setMatchDataCache] = useState<Record<string, MatchScoreData>>({})
  const [loading, setLoading] = useState(false)
  const [player1Scores, setPlayer1Scores] = useState<Record<string, Record<number, string>>>({})
  const [player2Scores, setPlayer2Scores] = useState<Record<string, Record<number, string>>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedMatches, setSavedMatches] = useState<Set<string>>(new Set())

  // 2D refs for keyboard navigation: inputRefs[playerIndex][holeIndex]
  const inputRefs = useRef<(HTMLInputElement | null)[][]>([
    Array(9).fill(null),
    Array(9).fill(null)
  ])

  const selectedMatch = matches.find((m) => m.id === selectedMatchId)
  const matchData = selectedMatchId ? matchDataCache[selectedMatchId] : undefined

  useEffect(() => {
    if (!selectedMatchId) return

    const cached = matchDataCache[selectedMatchId]
    if (cached) {
      // Initialize scores from cached data if not already in state
      setPlayer1Scores((prev) => {
        if (prev[selectedMatchId]) return prev
        return {
          ...prev,
          [selectedMatchId]: Object.fromEntries(
            cached.rows.map((row) => [row.holeNumber, row.player1Gross?.toString() ?? ''])
          )
        }
      })
      setPlayer2Scores((prev) => {
        if (prev[selectedMatchId]) return prev
        return {
          ...prev,
          [selectedMatchId]: Object.fromEntries(
            cached.rows.map((row) => [row.holeNumber, row.player2Gross?.toString() ?? ''])
          )
        }
      })
      return
    }

    async function fetchMatchData() {
      setLoading(true)
      setError(null)
      try {
        const match = matches.find((m) => m.id === selectedMatchId)
        if (!match) return
        const res = await fetch(`/api/weeks/${match.weekId}/matches/${selectedMatchId}/scores`)
        if (!res.ok) throw new Error('Failed to load match data')
        const data: MatchScoreData = await res.json()
        setMatchDataCache((prev) => ({ ...prev, [selectedMatchId]: data }))
        setPlayer1Scores((prev) => ({
          ...prev,
          [selectedMatchId]: Object.fromEntries(
            data.rows.map((row) => [row.holeNumber, row.player1Gross?.toString() ?? ''])
          )
        }))
        setPlayer2Scores((prev) => ({
          ...prev,
          [selectedMatchId]: Object.fromEntries(
            data.rows.map((row) => [row.holeNumber, row.player2Gross?.toString() ?? ''])
          )
        }))
      } catch {
        setError('Could not load match data. Refresh and try again.')
      } finally {
        setLoading(false)
      }
    }

    fetchMatchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMatchId])

  const p1Scores = player1Scores[selectedMatchId] ?? {}
  const p2Scores = player2Scores[selectedMatchId] ?? {}

  const computedRows = useMemo(() => {
    if (!matchData) return []
    return matchData.rows.map((row) => {
      const p1Gross = p1Scores[row.holeNumber] === '' || p1Scores[row.holeNumber] === undefined
        ? null
        : Number(p1Scores[row.holeNumber])
      const p2Gross = p2Scores[row.holeNumber] === '' || p2Scores[row.holeNumber] === undefined
        ? null
        : Number(p2Scores[row.holeNumber])
      const p1Adj = p1Gross === null ? null : applyESC(p1Gross, row.par, row.player1AdjustedStrokesReceived)
      const p2Adj = p2Gross === null ? null : applyESC(p2Gross, row.par, row.player2AdjustedStrokesReceived)
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
  }, [matchData, p1Scores, p2Scores])

  const completeHoleCount = computedRows.filter(
    (row) => row.player1Gross !== null && row.player2Gross !== null
  ).length
  const isComplete = completeHoleCount === 9

  const totals = {
    p1Net: computedRows.reduce((s, r) => s + (r.player1Net ?? 0), 0),
    p2Net: computedRows.reduce((s, r) => s + (r.player2Net ?? 0), 0),
    p1Gross: computedRows.reduce((s, r) => s + (r.player1Gross ?? 0), 0),
    p2Gross: computedRows.reduce((s, r) => s + (r.player2Gross ?? 0), 0)
  }

  const matchPlayResult = matchData
    ? calculateMatchPlayResult(
        computedRows.map((r) => ({ player1Net: r.player1Net, player2Net: r.player2Net })),
        matchData.match.player1.id,
        matchData.match.player2.id
      )
    : null

  const pointsPreview = isComplete && matchPlayResult && matchData
    ? calculateMatchPoints(
        {
          player1Id: matchData.match.player1.id,
          player2Id: matchData.match.player2.id,
          player1NetScore: totals.p1Net,
          player2NetScore: totals.p2Net,
          matchPlayWinnerId: matchPlayResult.matchPlayWinnerId,
          matchPlayLeadBy: matchPlayResult.matchPlayLeadBy,
          player2ScorecardOnly: matchData.match.player2ScorecardOnly
        },
        matchData.match.player1.present ?? true,
        matchData.match.player2.present ?? true
      )
    : null

  function setScore(player: 'player1' | 'player2', holeNumber: number, value: string) {
    const sanitized = value.replace(/[^0-9]/g, '').slice(0, 2)
    if (player === 'player1') {
      setPlayer1Scores((prev) => ({
        ...prev,
        [selectedMatchId]: { ...(prev[selectedMatchId] ?? {}), [holeNumber]: sanitized }
      }))
    } else {
      setPlayer2Scores((prev) => ({
        ...prev,
        [selectedMatchId]: { ...(prev[selectedMatchId] ?? {}), [holeNumber]: sanitized }
      }))
    }
  }

  const focusCell = useCallback((playerIdx: number, holeIdx: number) => {
    const el = inputRefs.current[playerIdx]?.[holeIdx]
    if (el) {
      el.focus()
      el.select()
    }
  }, [])

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
    playerIdx: number,
    holeIdx: number
  ) {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      if (holeIdx < 8) focusCell(playerIdx, holeIdx + 1)
      else focusCell(1 - playerIdx, 0)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      if (holeIdx > 0) focusCell(playerIdx, holeIdx - 1)
      else focusCell(1 - playerIdx, 8)
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (playerIdx === 0) focusCell(1, holeIdx)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (playerIdx === 1) focusCell(0, holeIdx)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      const holeNumber = holeIdx + 1
      if (playerIdx === 0) {
        setPlayer1Scores((prev) => ({
          ...prev,
          [selectedMatchId]: { ...(prev[selectedMatchId] ?? {}), [holeNumber]: '' }
        }))
      } else {
        setPlayer2Scores((prev) => ({
          ...prev,
          [selectedMatchId]: { ...(prev[selectedMatchId] ?? {}), [holeNumber]: '' }
        }))
      }
    } else if (event.key === 'Enter') {
      event.preventDefault()
      // Advance same as Tab
      if (playerIdx === 0) {
        if (holeIdx < 8) focusCell(0, holeIdx + 1)
        else focusCell(1, 0)
      } else {
        if (holeIdx < 8) focusCell(1, holeIdx + 1)
        // else: last cell, let submit button get focus naturally
      }
    }
  }

  async function handleSubmit() {
    if (!isComplete || !matchPlayResult || !matchData) return
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(
        `/api/weeks/${matchData.match.weekId}/matches/${matchData.match.id}/scores`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            player1Scores: computedRows.map((r) => ({ holeNumber: r.holeNumber, grossScore: r.player1Gross })),
            player2Scores: computedRows.map((r) => ({ holeNumber: r.holeNumber, grossScore: r.player2Gross }))
          })
        }
      )

      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.error ?? 'Unable to submit scores')
      }

      setSavedMatches((prev) => new Set(prev).add(selectedMatchId))

      // Invalidate cached data so re-selecting shows fresh scores
      setMatchDataCache((prev) => {
        const next = { ...prev }
        delete next[selectedMatchId]
        return next
      })

      // Move to next incomplete match
      const nextIncomplete = matches.find((m) => !m.scoreComplete && m.id !== selectedMatchId && !savedMatches.has(m.id))
      if (nextIncomplete) {
        setSelectedMatchId(nextIncomplete.id)
      }

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit scores')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (matches.length === 0) {
    return (
      <div className="px-6 py-8 text-sm text-text-muted">
        No locked matches yet.
      </div>
    )
  }

  const isReadOnly = matchData?.match.seasonArchived || !matchData?.match.locked

  return (
    <div className="flex flex-col gap-4 px-6 py-4">
      {/* Match tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-surface-border pb-0">
        {matches.map((match) => {
          const isSaved = savedMatches.has(match.id)
          const isSelected = match.id === selectedMatchId
          const isDone = match.scoreComplete || isSaved
          return (
            <button
              key={match.id}
              type="button"
              onClick={() => { setSelectedMatchId(match.id); setError(null) }}
              className={`font-condensed flex shrink-0 items-center gap-1.5 border-b-2 px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wide transition-colors ${
                isSelected
                  ? 'border-accent text-accent-text'
                  : 'border-transparent text-text-secondary hover:text-text-primary'
              }`}
            >
              {isDone ? (
                <span className="text-accent-text">✓</span>
              ) : (
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning" />
              )}
              <span className="max-w-[140px] truncate">
                {match.player1Name.split(' ')[0]} / {match.player2Name.split(' ')[0]}
              </span>
            </button>
          )
        })}
      </div>

      {error ? (
        <div className="rounded-md border border-danger bg-danger-dim px-4 py-2 text-sm text-danger-text">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="py-8 text-center text-sm text-text-muted">Loading scorecard…</div>
      ) : matchData ? (
        <>
          {/* Match play status bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="rounded-md border-l-[3px] border-accent bg-accent-dim px-3 py-1.5 text-sm font-semibold text-accent-text">
              {formatMatchPlay(matchPlayResult, matchData.match.player1, matchData.match.player2)}
            </div>
            <span className="text-xs text-text-muted">
              {completeHoleCount} / 9 holes
            </span>
          </div>

          {/* Scorecard grid */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-surface-border bg-surface-sunken">
                  <th className="font-condensed w-[180px] px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    Player
                  </th>
                  {[1,2,3,4,5,6,7,8,9].map((h) => (
                    <th key={h} className="font-condensed w-10 px-0 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                      {h}
                    </th>
                  ))}
                  <th className="font-condensed w-14 px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    Tot
                  </th>
                  <th className="font-condensed w-14 px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                    Net
                  </th>
                  {pointsPreview ? (
                    <th className="font-condensed w-14 px-3 py-1.5 text-center text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                      Pts
                    </th>
                  ) : null}
                </tr>
                <tr className="border-b border-surface-border text-[11px] text-text-muted">
                  <td className="px-3 py-1 text-left text-[10px] uppercase tracking-wide text-text-muted">
                    Par / SI
                  </td>
                  {matchData.rows.map((row) => (
                    <td key={row.holeNumber} className="px-0 py-1 text-center">
                      <span className="block">{row.par}</span>
                      <span className="block text-[9px] text-text-disabled">{row.strokeIndex}</span>
                    </td>
                  ))}
                  <td />
                  <td />
                  {pointsPreview ? <td /> : null}
                </tr>
              </thead>
              <tbody>
                {([matchData.match.player1, matchData.match.player2] as const).map((player, playerIdx) => {
                  const scores = playerIdx === 0 ? p1Scores : p2Scores
                  const netTotal = playerIdx === 0 ? totals.p1Net : totals.p2Net
                  const grossTotal = playerIdx === 0 ? totals.p1Gross : totals.p2Gross
                  const allFilled = matchData.rows.every((r) => (scores[r.holeNumber] ?? '') !== '')

                  return (
                    <tr
                      key={player.id}
                      className={`border-b border-surface-border ${playerIdx === 0 ? '' : 'bg-surface-elevated/50'}`}
                    >
                      <td className="px-3 py-2">
                        <span className="font-medium text-text-primary">{player.name}</span>
                        <span className="ml-2 text-[11px] text-text-muted">
                          HCP {player.playingHandicap}
                        </span>
                      </td>
                      {matchData.rows.map((row, holeIdx) => {
                        const value = scores[row.holeNumber] ?? ''
                        const gross = value === '' ? null : Number(value)
                        const isAboveRange = gross !== null && gross > 12
                        const isCtp = matchData.match.ctpHoleNumber === row.holeNumber
                        const hasStroke = playerIdx === 0
                          ? row.player1StrokesReceived > 0
                          : row.player2StrokesReceived > 0

                        return (
                          <td
                            key={row.holeNumber}
                            className={`px-0.5 py-1.5 ${isCtp ? 'bg-accent-dim/40' : ''}`}
                          >
                            <div className="relative mx-auto w-10">
                              <input
                                ref={(el) => {
                                  if (!inputRefs.current[playerIdx]) {
                                    inputRefs.current[playerIdx] = Array(9).fill(null)
                                  }
                                  inputRefs.current[playerIdx][holeIdx] = el
                                }}
                                type="text"
                                inputMode="numeric"
                                value={value}
                                onChange={(e) => setScore(
                                  playerIdx === 0 ? 'player1' : 'player2',
                                  row.holeNumber,
                                  e.target.value
                                )}
                                onFocus={(e) => e.target.select()}
                                onKeyDown={(e) => handleKeyDown(e, playerIdx, holeIdx)}
                                disabled={isReadOnly || isSubmitting}
                                className={`h-8 w-10 rounded border text-center text-sm font-bold transition-colors ${
                                  value
                                    ? isAboveRange
                                      ? 'border-warning bg-warning-dim text-warning-text'
                                      : 'border-surface-border bg-surface-sunken text-text-primary'
                                    : 'border-surface-border bg-surface-base text-text-muted'
                                } focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50`}
                              />
                              {hasStroke ? (
                                <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-accent" />
                              ) : null}
                            </div>
                          </td>
                        )
                      })}
                      <td className="px-3 py-2 text-center font-bold text-text-primary">
                        {allFilled ? grossTotal : '—'}
                      </td>
                      <td className="px-3 py-2 text-center font-bold text-text-primary">
                        {allFilled ? netTotal : '—'}
                      </td>
                      {pointsPreview ? (
                        <td className="px-3 py-2 text-center font-semibold text-accent-text">
                          {playerIdx === 0 ? pointsPreview.player1Points : pointsPreview.player2Points}
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pop dots legend */}
          {matchData.rows.some((r) => r.player1StrokesReceived > 0 || r.player2StrokesReceived > 0) ? (
            <p className="text-[11px] text-text-muted">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" /> = stroke received on that hole
            </p>
          ) : null}

          {/* Submit */}
          {!isReadOnly ? (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!isComplete || isSubmitting}
                className={`font-condensed rounded-lg px-5 py-2 text-sm font-bold uppercase tracking-wide transition-colors ${
                  isComplete
                    ? 'bg-accent text-white hover:bg-accent-hover'
                    : 'cursor-not-allowed bg-surface-sunken text-text-disabled'
                }`}
              >
                {isSubmitting ? 'Saving…' : isComplete ? 'Save Scores' : `${completeHoleCount} / 9 holes entered`}
              </button>
              {savedMatches.has(selectedMatchId) ? (
                <span className="text-sm text-accent-text">Saved ✓</span>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-text-muted">
              {matchData.match.seasonArchived ? 'Season archived — read only.' : 'Scores locked.'}
            </p>
          )}
        </>
      ) : !loading && selectedMatchId ? (
        <div className="py-8 text-center text-sm text-text-muted">
          Select a match to enter scores.
        </div>
      ) : null}
    </div>
  )
}

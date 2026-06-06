'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { ReferenceScorecardPlayer, UnmatchedPlayer } from '@/app/(app)/week/pairings-section'

const REFERENCE_SCORECARD_PLAYER_ID = '__reference_scorecard__'

interface WeekPairingsActionBarProps {
  unmatchedPresentPlayers: UnmatchedPlayer[]
  referenceScorecardPlayers: ReferenceScorecardPlayer[]
  locked: boolean
  allScoresComplete: boolean
  canCloseWeek: boolean
  canGeneratePairings: boolean
  canCreateManualPairing: boolean
  manualPlayer1Id: string
  manualPlayer2Id: string
  manualReferencePlayerId: string
  matchCount: number
  generateBlockReason: string | null
  isRefreshing: boolean
  onManualPlayer1Change: (value: string) => void
  onManualPlayer2Change: (value: string) => void
  onManualReferencePlayerChange: (value: string) => void
  onGeneratePairings: () => Promise<void> | void
  onSetLockState: (locked: boolean) => void
  onCreateManualPairing: () => Promise<void> | void
  onCopyPairingsLink: () => void
  onCopyResultsShareText: () => void
  onCloseCurrentWeek: () => void
}

export function WeekPairingsActionBar({
  unmatchedPresentPlayers,
  referenceScorecardPlayers,
  locked,
  allScoresComplete,
  canCloseWeek,
  canGeneratePairings,
  canCreateManualPairing,
  manualPlayer1Id,
  manualPlayer2Id,
  manualReferencePlayerId,
  matchCount,
  generateBlockReason,
  isRefreshing,
  onManualPlayer1Change,
  onManualPlayer2Change,
  onManualReferencePlayerChange,
  onGeneratePairings,
  onSetLockState,
  onCreateManualPairing,
  onCopyPairingsLink,
  onCopyResultsShareText,
  onCloseCurrentWeek
}: WeekPairingsActionBarProps) {
  const panelId = useId()
  const reasonId = useId()
  const [manualOpen, setManualOpen] = useState(false)
  const manualButtonRef = useRef<HTMLButtonElement | null>(null)
  const firstSelectRef = useRef<HTMLSelectElement | null>(null)

  useEffect(() => {
    if (!manualOpen) {
      return
    }

    firstSelectRef.current?.focus()

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setManualOpen(false)
      }
    }

    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [manualOpen])

  useEffect(() => {
    if (locked && manualOpen) {
      setManualOpen(false)
    }
  }, [locked, manualOpen])

  function closePanel() {
    setManualOpen(false)
    manualButtonRef.current?.focus()
  }

  async function handleCreateManualPairing() {
    await onCreateManualPairing()
    setManualOpen(false)
    manualButtonRef.current?.focus()
  }

  function getManualPlayerLabel(player: UnmatchedPlayer) {
    return `${player.name} - ${player.pairingHandicap.label} ${player.pairingHandicap.value}`
  }

  const canUseReferenceScorecard = referenceScorecardPlayers.length > 0

  return (
    <div
      className="fixed bottom-[calc(var(--app-nav-h)+var(--app-tab-h))] left-0 right-0 z-20 border-t border-surface-border bg-surface-elevated/95 backdrop-blur xl:hidden"
    >
      {!locked && manualOpen ? (
        <div
          id={panelId}
          role="region"
          aria-label="Manual pairing"
          className="border-b border-surface-border bg-surface-base px-4 py-3"
        >
          <div className="mx-auto flex max-w-5xl flex-col gap-2">
            <p className="font-condensed text-[11px] font-semibold uppercase tracking-widest text-text-muted">
              Manual Pairing
            </p>
            <select
              ref={firstSelectRef}
              className="rounded-md border border-surface-border bg-surface-sunken px-3 py-3 text-sm text-text-primary"
              value={manualPlayer1Id}
              onChange={(event) => onManualPlayer1Change(event.target.value)}
              disabled={isRefreshing || unmatchedPresentPlayers.length < 1}
              aria-label="Player 1"
            >
              <option value="">Select player 1</option>
              {unmatchedPresentPlayers.map((player) => (
                <option key={player.playerId} value={player.playerId}>
                  {getManualPlayerLabel(player)}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-surface-border bg-surface-sunken px-3 py-3 text-sm text-text-primary"
              value={manualPlayer2Id}
              onChange={(event) => onManualPlayer2Change(event.target.value)}
              disabled={isRefreshing || unmatchedPresentPlayers.length < 1}
              aria-label="Player 2"
            >
              <option value="">Select player 2</option>
              {unmatchedPresentPlayers
                .filter((player) => player.playerId !== manualPlayer1Id)
                .map((player) => (
                  <option key={player.playerId} value={player.playerId}>
                    {getManualPlayerLabel(player)}
                  </option>
                ))}
              {canUseReferenceScorecard ? (
                <option value={REFERENCE_SCORECARD_PLAYER_ID}>Reference scorecard</option>
              ) : null}
            </select>
            {manualPlayer2Id === REFERENCE_SCORECARD_PLAYER_ID ? (
              <select
                className="rounded-md border border-surface-border bg-surface-sunken px-3 py-3 text-sm text-text-primary"
                value={manualReferencePlayerId}
                onChange={(event) => onManualReferencePlayerChange(event.target.value)}
                disabled={isRefreshing || !canUseReferenceScorecard}
                aria-label="Reference player"
              >
                <option value="">Select reference player</option>
                {referenceScorecardPlayers.map((player) => (
                  <option key={player.playerId} value={player.playerId}>
                    {player.name}
                  </option>
                ))}
              </select>
            ) : null}
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                className="font-condensed flex-1 rounded-lg bg-surface-sunken px-4 py-3 text-sm font-bold uppercase tracking-wide text-text-primary min-h-[44px]"
                onClick={closePanel}
              >
                Cancel
              </button>
              <button
                type="button"
                className="font-condensed flex-[2] rounded-lg bg-accent px-4 py-3 text-sm font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-disabled min-h-[44px]"
                onClick={handleCreateManualPairing}
                disabled={!canCreateManualPairing || isRefreshing}
              >
                Create Match
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-5xl px-3 py-2">
        {!locked && generateBlockReason ? (
          <p
            id={reasonId}
            className="px-1 pb-1 text-[11px] text-text-muted"
          >
            {generateBlockReason}
          </p>
        ) : null}

        {locked ? (
          <div className="flex flex-wrap items-stretch gap-2">
            <button
              type="button"
              className="font-condensed flex-1 min-h-[44px] rounded-lg bg-accent px-3 py-2 text-sm font-bold uppercase tracking-wide text-white"
              onClick={onCopyPairingsLink}
            >
              Copy Link
            </button>
            {allScoresComplete ? (
              <button
                type="button"
                className="font-condensed flex-1 min-h-[44px] rounded-lg bg-accent px-3 py-2 text-sm font-bold uppercase tracking-wide text-white"
                onClick={onCopyResultsShareText}
              >
                Share Results
              </button>
            ) : null}
            <button
              type="button"
              className="font-condensed min-h-[44px] rounded-lg bg-surface-sunken px-3 py-2 text-sm font-bold uppercase tracking-wide text-text-primary disabled:cursor-not-allowed disabled:text-text-disabled"
              onClick={() => onSetLockState(false)}
              disabled={isRefreshing}
            >
              Unlock
            </button>
            {canCloseWeek ? (
              <button
                type="button"
                className="font-condensed min-h-[44px] rounded-lg bg-surface-sunken px-3 py-2 text-sm font-bold uppercase tracking-wide text-text-primary disabled:cursor-not-allowed disabled:text-text-disabled"
                onClick={onCloseCurrentWeek}
                disabled={isRefreshing}
              >
                Close Week
              </button>
            ) : null}
          </div>
        ) : (
          <div className="flex items-stretch gap-2">
            <button
              type="button"
              className="font-condensed flex-[2] min-h-[44px] rounded-lg bg-accent px-3 py-2 text-sm font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-disabled"
              onClick={onGeneratePairings}
              disabled={!canGeneratePairings || isRefreshing}
              aria-describedby={generateBlockReason ? reasonId : undefined}
            >
              {isRefreshing
                ? 'Working...'
                : matchCount > 0
                  ? 'Generate Next'
                  : 'Generate Pairings'}
            </button>
            <button
              ref={manualButtonRef}
              type="button"
              className="font-condensed flex-1 min-h-[44px] rounded-lg bg-surface-sunken px-3 py-2 text-sm font-bold uppercase tracking-wide text-text-primary"
              onClick={() => setManualOpen((value) => !value)}
              aria-expanded={manualOpen}
              aria-controls={panelId}
            >
              {manualOpen ? 'Close' : 'Manual'}
            </button>
            {matchCount > 0 ? (
              <button
                type="button"
                className="font-condensed min-h-[44px] rounded-lg bg-surface-sunken px-3 py-2 text-xs font-bold uppercase tracking-wide text-text-primary"
                onClick={() => onSetLockState(true)}
                disabled={isRefreshing}
              >
                Lock
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

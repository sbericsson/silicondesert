'use client'

import type { TeeColor } from '@prisma/client'
import Link from 'next/link'
import { describeMatchPops } from '@/lib/match-net-scoring'
import { REFERENCE_SCORECARD_PLAYER_ID } from '@/lib/matchmaking'

export type PairingMatch = {
  id: string
  player1Id: string
  player2Id: string
  player1Name: string
  player2Name: string
  player1TeeColor: TeeColor
  player1SeasonTeeColor: TeeColor
  player1TeeOverrideColor: TeeColor | null
  player2TeeColor: TeeColor
  player2SeasonTeeColor: TeeColor
  player2TeeOverrideColor: TeeColor | null
  player1DisplayHandicapIndex: number
  player2DisplayHandicapIndex: number
  player1PlayingHandicap: number
  player2PlayingHandicap: number
  popDifference: number
  popRecipientId: string | null
  popHoles: Array<{ holeNumber: number; strokes: number }>
  player2ScorecardOnly: boolean
  warnings: Array<{
    player1Id: string
    player2Id: string
    type: 'repeat' | 'gap'
    detail: string
  }>
  locked: boolean
  scoreComplete: boolean
  hasScores: boolean
}

export type UnmatchedPlayer = {
  playerId: string
  name: string
  pairingHandicap: {
    label: 'IDX' | 'CH'
    value: number
  }
}

export type ReferenceScorecardPlayer = {
  playerId: string
  name: string
}

interface PairingsSectionProps {
  weekId: string
  matches: PairingMatch[]
  matchCount: number
  locked: boolean
  handicapMode: 'index' | 'course'
  unmatchedPresentPlayers: UnmatchedPlayer[]
  referenceScorecardPlayers: ReferenceScorecardPlayer[]
  currentCourseTeeOptions: TeeColor[]
  allScoresComplete: boolean
  canCloseWeek: boolean
  canGeneratePairings: boolean
  canCreateManualPairing: boolean
  manualPlayer1Id: string
  manualPlayer2Id: string
  manualReferencePlayerId: string
  copyMessage: string | null
  isRefreshing: boolean
  onManualPlayer1Change: (value: string) => void
  onManualPlayer2Change: (value: string) => void
  onManualReferencePlayerChange: (value: string) => void
  onGeneratePairings: () => void
  onSetLockState: (locked: boolean) => void
  onCreateManualPairing: () => void
  onRemovePairing: (matchId: string) => void
  onClearMatchScores: (matchId: string) => void
  onUpdateMatchTee: (
    matchId: string,
    field: 'player1TeeOverrideColor' | 'player2TeeOverrideColor',
    value: string
  ) => void
  onCopyPairingsLink: () => void
  onCopyResultsShareText: () => void
  onCloseCurrentWeek: () => void
}

export function PairingsSection({
  weekId,
  matches,
  matchCount,
  locked,
  handicapMode,
  unmatchedPresentPlayers,
  referenceScorecardPlayers,
  currentCourseTeeOptions,
  allScoresComplete,
  canCloseWeek,
  canGeneratePairings,
  canCreateManualPairing,
  manualPlayer1Id,
  manualPlayer2Id,
  manualReferencePlayerId,
  copyMessage,
  isRefreshing,
  onManualPlayer1Change,
  onManualPlayer2Change,
  onManualReferencePlayerChange,
  onGeneratePairings,
  onSetLockState,
  onCreateManualPairing,
  onRemovePairing,
  onClearMatchScores,
  onUpdateMatchTee,
  onCopyPairingsLink,
  onCopyResultsShareText,
  onCloseCurrentWeek
}: PairingsSectionProps) {
  function getManualPlayerLabel(player: UnmatchedPlayer) {
    return `${player.name} - ${player.pairingHandicap.label} ${player.pairingHandicap.value}`
  }

  const canUseReferenceScorecard = referenceScorecardPlayers.length > 0

  return (
    <section id="pairings" className="rounded-xl border border-surface-border bg-surface-elevated p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
            Pairings
          </p>
          <p className="mt-2 text-sm text-text-secondary">
            {matchCount > 0
              ? `${matchCount} ${locked ? 'locked' : 'tentative'} matches created.`
              : 'No pairings generated yet.'}
          </p>
          {unmatchedPresentPlayers.length > 0 ? (
            <p className="mt-1 text-xs text-text-secondary">
              {locked
                ? `${unmatchedPresentPlayers.length} checked-in player${unmatchedPresentPlayers.length === 1 ? '' : 's'} not in a match. They still receive ${unmatchedPresentPlayers.length === 1 ? 'their attendance point' : 'attendance points'} for the week.`
                : `${unmatchedPresentPlayers.length} checked-in player${unmatchedPresentPlayers.length === 1 ? '' : 's'} still unpaired.`}
            </p>
          ) : !locked ? (
            <p className="mt-1 text-xs text-text-secondary">
              All checked-in players are currently assigned to matches.
            </p>
          ) : null}
        </div>
        <div className="hidden gap-2 xl:flex">
          <button
            type="button"
            className="font-condensed rounded-lg bg-accent px-4 py-3 text-sm font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-disabled"
            onClick={onGeneratePairings}
            disabled={!canGeneratePairings || isRefreshing}
          >
            {isRefreshing ? 'Working...' : 'Generate Next Pairing'}
          </button>
          {matchCount > 0 ? (
            <button
              type="button"
              className={`font-condensed rounded-lg px-4 py-3 text-sm font-bold uppercase tracking-wide ${
                locked ? 'bg-danger-dim text-danger-text' : 'bg-surface-sunken text-text-primary'
              } disabled:cursor-not-allowed disabled:opacity-70`}
              onClick={() => onSetLockState(!locked)}
              disabled={isRefreshing}
            >
              {locked ? 'Unlock' : 'Lock Pairings'}
            </button>
          ) : null}
        </div>
      </div>

      {locked ? (
        <div className="mt-4 hidden flex-wrap gap-2 xl:flex">
          <button
            type="button"
            className="font-condensed rounded-lg border border-surface-border bg-surface-base px-4 py-3 text-sm font-bold uppercase tracking-wide text-text-primary"
            onClick={onCopyPairingsLink}
          >
            Copy Pairings Link
          </button>
          {allScoresComplete ? (
            <button
              type="button"
              className="font-condensed rounded-lg bg-accent px-4 py-3 text-sm font-bold uppercase tracking-wide text-white"
              onClick={onCopyResultsShareText}
            >
              Share Results
            </button>
          ) : null}
          {canCloseWeek ? (
            <button
              type="button"
              className="font-condensed rounded-lg bg-surface-sunken px-4 py-3 text-sm font-bold uppercase tracking-wide text-text-primary disabled:cursor-not-allowed disabled:text-text-disabled"
              onClick={onCloseCurrentWeek}
              disabled={isRefreshing}
            >
              Close Week
            </button>
          ) : null}
          {copyMessage ? (
            <span className="self-center text-sm text-accent-text">{copyMessage}</span>
          ) : null}
        </div>
      ) : null}

      {locked && !allScoresComplete ? (
        <p className="mt-4 text-sm text-text-secondary">
          Enter every locked match score before closing this week.
        </p>
      ) : null}

      {matches.length > 0 ? (
        <div className="mt-4 space-y-3">
          {matches.map((match, index) => (
            <div key={match.id} className="rounded-lg border border-surface-border bg-surface-sunken p-3">
              <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
                Match {index + 1}
              </p>
              <p
                className={`mt-1 text-xs font-semibold ${
                  match.scoreComplete ? 'text-accent-text' : 'text-text-secondary'
                }`}
              >
                {match.scoreComplete ? 'Complete' : locked ? 'Pending scores' : 'Tentative'}
              </p>
              <div className="mt-2 flex items-center justify-between text-sm text-text-primary">
                <span>
                  {match.player1Name} ({match.player1TeeColor.toUpperCase()})
                </span>
                <span className="text-right text-text-secondary">
                  HI {match.player1DisplayHandicapIndex} · {handicapMode === 'course' ? 'CH' : 'IDX'}{' '}
                  {match.player1PlayingHandicap}
                </span>
              </div>
              {currentCourseTeeOptions.length > 0 ? (
                <label className="mt-2 block">
                  <span className="font-condensed text-[11px] font-semibold uppercase tracking-widest text-text-muted">
                    {match.player1Name} Tee
                  </span>
                  <select
                    className="mt-1 w-full rounded-md border border-surface-border bg-surface-base px-3 py-2 text-sm text-text-primary"
                    value={match.player1TeeOverrideColor ?? ''}
                    onChange={(event) => onUpdateMatchTee(match.id, 'player1TeeOverrideColor', event.target.value)}
                    disabled={isRefreshing}
                  >
                    <option value="">
                      Season default ({match.player1SeasonTeeColor.toUpperCase()})
                    </option>
                    {currentCourseTeeOptions.map((teeColor) => (
                      <option key={`player1-${match.id}-${teeColor}`} value={teeColor}>
                        {teeColor.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <div className="font-condensed mt-1 text-center text-xs font-bold uppercase tracking-widest text-text-muted">vs</div>
              <div className="mt-1 flex items-center justify-between text-sm text-text-primary">
                <span>
                  {match.player2Name} ({match.player2TeeColor.toUpperCase()})
                </span>
                <span className="text-text-secondary">
                  HI {match.player2DisplayHandicapIndex} · {handicapMode === 'course' ? 'CH' : 'IDX'}{' '}
                  {match.player2PlayingHandicap}
                  {match.player2ScorecardOnly ? ' · Reference scorecard' : ''}
                </span>
              </div>
              {currentCourseTeeOptions.length > 0 ? (
                <label className="mt-2 block">
                  <span className="font-condensed text-[11px] font-semibold uppercase tracking-widest text-text-muted">
                    {match.player2Name} Tee
                  </span>
                  <select
                    className="mt-1 w-full rounded-md border border-surface-border bg-surface-base px-3 py-2 text-sm text-text-primary"
                    value={match.player2TeeOverrideColor ?? ''}
                    onChange={(event) => onUpdateMatchTee(match.id, 'player2TeeOverrideColor', event.target.value)}
                    disabled={isRefreshing}
                  >
                    <option value="">
                      Season default ({match.player2SeasonTeeColor.toUpperCase()})
                    </option>
                    {currentCourseTeeOptions.map((teeColor) => (
                      <option key={`player2-${match.id}-${teeColor}`} value={teeColor}>
                        {teeColor.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <p className="mt-2 text-xs text-text-secondary">
                {describeMatchPops(match)}
              </p>
              {match.warnings.length > 0 ? (
                <div className="mt-3 space-y-1">
                  {match.warnings.map((warning) => (
                    <p
                      key={`${match.id}-${warning.type}`}
                      className="rounded-md border border-warning bg-warning-dim px-3 py-2 text-xs font-semibold text-warning-text"
                    >
                      {warning.type === 'repeat' ? 'Repeat pairing warning' : 'Handicap gap warning'}: {warning.detail}
                    </p>
                  ))}
                </div>
              ) : null}
              {locked ? (
                <div className="mt-3 flex items-center gap-4 xl:justify-end">
                  <Link
                    href={`/week/matches/${match.id}`}
                    className="text-sm font-semibold text-accent-text xl:hidden"
                  >
                    Enter Scores
                  </Link>
                  {match.hasScores ? (
                    <button
                      type="button"
                      className="text-sm font-semibold text-danger-text"
                      onClick={() => onClearMatchScores(match.id)}
                      disabled={isRefreshing}
                    >
                      Clear Scores
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="mt-3 flex items-center gap-4">
                  {match.hasScores ? (
                    <button
                      type="button"
                      className="text-sm font-semibold text-danger-text"
                      onClick={() => onClearMatchScores(match.id)}
                      disabled={isRefreshing}
                    >
                      Clear Scores
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="text-sm font-semibold text-danger-text"
                      onClick={() => onRemovePairing(match.id)}
                      disabled={isRefreshing}
                    >
                      Remove Pairing
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : null}


      {!locked ? (
        <div className="mt-4 hidden rounded-lg border border-dashed border-surface-border bg-surface-base p-4 xl:block">
          <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
            Manual Pairing
          </p>
          <p className="mt-2 text-sm text-text-secondary">
            Use this when you want to hand-build a specific match. Player 2 can also use a reference
            scorecard from the latest live match.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <select
              className="rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              value={manualPlayer1Id}
              onChange={(event) => onManualPlayer1Change(event.target.value)}
              disabled={isRefreshing || unmatchedPresentPlayers.length < 1}
            >
              <option value="">Select player 1</option>
              {unmatchedPresentPlayers.map((player) => (
                <option key={player.playerId} value={player.playerId}>
                  {getManualPlayerLabel(player)}
                </option>
              ))}
            </select>
            <select
              className="rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              value={manualPlayer2Id}
              onChange={(event) => onManualPlayer2Change(event.target.value)}
              disabled={isRefreshing || unmatchedPresentPlayers.length < 1}
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
            <button
              type="button"
              className="font-condensed rounded-lg bg-surface-sunken px-4 py-3 text-sm font-bold uppercase tracking-wide text-text-primary disabled:cursor-not-allowed disabled:text-text-disabled"
              onClick={onCreateManualPairing}
              disabled={!canCreateManualPairing || isRefreshing}
            >
              Create Match
            </button>
          </div>
          {manualPlayer2Id === REFERENCE_SCORECARD_PLAYER_ID ? (
            <label className="mt-3 block">
              <span className="font-condensed text-[11px] font-semibold uppercase tracking-widest text-text-muted">
                Reference Player
              </span>
              <select
                className="mt-1 w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
                value={manualReferencePlayerId}
                onChange={(event) => onManualReferencePlayerChange(event.target.value)}
                disabled={isRefreshing || !canUseReferenceScorecard}
              >
                <option value="">Select reference player</option>
                {referenceScorecardPlayers.map((player) => (
                  <option key={player.playerId} value={player.playerId}>
                    {player.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

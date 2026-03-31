'use client'

import type { FormEvent } from 'react'
import { startTransition, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatUsPhoneInput, formatUsPhoneNumber } from '@/lib/phone'
import {
  formatImportedHandicapRoundsText,
  parseImportedHandicapRoundsText
} from '@/lib/imported-handicap'

type RosterPageData = {
  players: Array<{
    id: string
    name: string
    email: string | null
    cellPhone: string | null
    active: boolean
    seedHandicap: number | null
    importedHandicapRounds: Array<{
      date: string
      grossScore: number
      adjustedGrossScore: number
      courseRating: number
      slopeRating: number
      coursePar: number
    }>
    handicap: {
      kind: 'HCP' | 'PRO' | 'EST'
      value: string | null
    }
  }>
  seasons: Array<{
    id: string
    name: string
    type: 'spring' | 'summer'
    weekCount: number
    startDate: string
    endDate: string
    weekDates: string[]
    archivedAt: string | null
    hasWeekActivity: boolean
  }>
}

interface RosterClientProps {
  initialData: RosterPageData
}

export function RosterClient({ initialData }: RosterClientProps) {
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [playerName, setPlayerName] = useState('')
  const [playerEmail, setPlayerEmail] = useState('')
  const [playerCellPhone, setPlayerCellPhone] = useState('')
  const [playerSeedHandicap, setPlayerSeedHandicap] = useState('')
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  const [editingPlayerName, setEditingPlayerName] = useState('')
  const [editingPlayerEmail, setEditingPlayerEmail] = useState('')
  const [editingPlayerCellPhone, setEditingPlayerCellPhone] = useState('')
  const [editingPlayerSeedHandicap, setEditingPlayerSeedHandicap] = useState('')
  const [editingPlayerImportedRoundsText, setEditingPlayerImportedRoundsText] = useState('')
  const [seasonName, setSeasonName] = useState('')
  const [seasonType, setSeasonType] = useState<'spring' | 'summer'>('spring')
  const [seasonStartDate, setSeasonStartDate] = useState('')
  const [seasonWeekDates, setSeasonWeekDates] = useState<string[]>([])
  const [seasonDatePickerValue, setSeasonDatePickerValue] = useState('')
  const [seasonWeekCount, setSeasonWeekCount] = useState('8')
  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null)
  const [editingSeasonName, setEditingSeasonName] = useState('')
  const [editingSeasonType, setEditingSeasonType] = useState<'spring' | 'summer'>('spring')
  const [editingSeasonStartDate, setEditingSeasonStartDate] = useState('')
  const [editingSeasonWeekDates, setEditingSeasonWeekDates] = useState<string[]>([])
  const [editingSeasonDatePickerValue, setEditingSeasonDatePickerValue] = useState('')
  const [editingSeasonWeekCount, setEditingSeasonWeekCount] = useState('8')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setData(initialData)
  }, [initialData])

  async function refreshPage(successMessage: string) {
    setMessage(successMessage)
    startTransition(() => {
      router.refresh()
    })
  }

  async function handleCreatePlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    const response = await fetch('/api/players', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: playerName,
        email: playerEmail,
        cellPhone: playerCellPhone,
        seedHandicap: playerSeedHandicap
      })
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? 'Unable to create player')
      setIsSubmitting(false)
      return
    }

    setPlayerName('')
    setPlayerEmail('')
    setPlayerCellPhone('')
    setPlayerSeedHandicap('')
    setIsSubmitting(false)
    await refreshPage('Player created.')
  }

  async function handleTogglePlayer(playerId: string, active: boolean) {
    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    const response = await fetch(`/api/players/${playerId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ active })
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? 'Unable to update player')
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
    await refreshPage(active ? 'Player activated.' : 'Player deactivated.')
  }

  async function handleSavePlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingPlayerId) {
      return
    }

    const parsedImportedRounds = parseImportedHandicapRoundsText(editingPlayerImportedRoundsText)
    if (parsedImportedRounds.error) {
      setError(parsedImportedRounds.error)
      return
    }

    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    const response = await fetch(`/api/players/${editingPlayerId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: editingPlayerName,
        email: editingPlayerEmail,
        cellPhone: editingPlayerCellPhone,
        seedHandicap: editingPlayerSeedHandicap,
        importedHandicapRounds: parsedImportedRounds.rounds
      })
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? 'Unable to save player')
      setIsSubmitting(false)
      return
    }

    setEditingPlayerId(null)
    setEditingPlayerName('')
    setEditingPlayerEmail('')
    setEditingPlayerCellPhone('')
    setEditingPlayerSeedHandicap('')
    setEditingPlayerImportedRoundsText('')
    setIsSubmitting(false)
    await refreshPage('Player updated.')
  }

  function beginEditingPlayer(player: RosterPageData['players'][number]) {
    setEditingPlayerId(player.id)
    setEditingPlayerName(player.name)
    setEditingPlayerEmail(player.email ?? '')
    setEditingPlayerCellPhone(formatUsPhoneNumber(player.cellPhone) ?? '')
    setEditingPlayerSeedHandicap(player.seedHandicap?.toString() ?? '')
    setEditingPlayerImportedRoundsText(formatImportedHandicapRoundsText(player.importedHandicapRounds))
  }

  function handlePlayerCellPhoneChange(value: string) {
    setPlayerCellPhone(formatUsPhoneInput(value))
  }

  function handleEditingPlayerCellPhoneChange(value: string) {
    setEditingPlayerCellPhone(formatUsPhoneInput(value))
  }

  function buildWeeklyDates(startDate: string, weekCountValue: string) {
    const weeks = Number(weekCountValue)
    if (!startDate) {
      setError('Choose a season start date first.')
      return null
    }

    if (!Number.isInteger(weeks) || weeks < 1) {
      setError('Week count must be at least 1.')
      return null
    }

    const start = new Date(`${startDate}T00:00:00-07:00`)
    return Array.from({ length: weeks }, (_, index) => {
      const next = new Date(start)
      next.setDate(start.getDate() + index * 7)
      return next.toISOString().slice(0, 10)
    })
  }

  function addSeasonDate(date: string) {
    if (!date) {
      return
    }

    setSeasonWeekDates((current) => [...new Set([...current, date])].sort())
    setSeasonDatePickerValue('')
  }

  function removeSeasonDate(date: string) {
    setSeasonWeekDates((current) => current.filter((item) => item !== date))
  }

  function generateWeeklyDates() {
    const dates = buildWeeklyDates(seasonStartDate, seasonWeekCount)
    if (!dates) {
      return
    }

    setSeasonWeekDates(dates)
    setError(null)
  }

  function beginEditingSeason(season: RosterPageData['seasons'][number]) {
    setEditingSeasonId(season.id)
    setEditingSeasonName(season.name)
    setEditingSeasonType(season.type)
    setEditingSeasonStartDate(season.startDate)
    setEditingSeasonWeekDates(season.weekDates)
    setEditingSeasonDatePickerValue('')
    setEditingSeasonWeekCount(String(season.weekCount))
  }

  function addEditingSeasonDate(date: string) {
    if (!date) {
      return
    }

    setEditingSeasonWeekDates((current) => [...new Set([...current, date])].sort())
    setEditingSeasonDatePickerValue('')
  }

  function removeEditingSeasonDate(date: string) {
    setEditingSeasonWeekDates((current) => current.filter((item) => item !== date))
  }

  function generateEditingSeasonDates() {
    const dates = buildWeeklyDates(editingSeasonStartDate, editingSeasonWeekCount)
    if (!dates) {
      return
    }

    setEditingSeasonWeekDates(dates)
    setError(null)
  }

  async function handleCreateSeason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    const weekDates = [...seasonWeekDates]

    const response = await fetch('/api/seasons', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: seasonName,
        type: seasonType,
        startDate: seasonStartDate,
        weekDates
      })
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? 'Unable to create season')
      setIsSubmitting(false)
      return
    }

    setSeasonName('')
    setSeasonStartDate('')
    setSeasonWeekDates([])
    setSeasonDatePickerValue('')
    setIsSubmitting(false)
    await refreshPage('Season created.')
  }

  async function handleSaveSeason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingSeasonId) {
      return
    }

    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    const response = await fetch(`/api/seasons/${editingSeasonId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(
        editingSeason?.hasWeekActivity
          ? {
              name: editingSeasonName,
              type: editingSeasonType
            }
          : {
              name: editingSeasonName,
              type: editingSeasonType,
              startDate: editingSeasonStartDate,
              weekDates: editingSeasonWeekDates
            }
      )
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? 'Unable to save season')
      setIsSubmitting(false)
      return
    }

    setEditingSeasonId(null)
    setEditingSeasonName('')
    setEditingSeasonType('spring')
    setEditingSeasonStartDate('')
    setEditingSeasonWeekDates([])
    setEditingSeasonDatePickerValue('')
    setEditingSeasonWeekCount('8')
    setIsSubmitting(false)
    await refreshPage('Season updated.')
  }

  async function handleSeasonArchiveToggle(
    season: RosterPageData['seasons'][number],
    archived: boolean
  ) {
    const confirmed = window.confirm(
      archived
        ? `Archive ${season.name}? It will remain visible in standings and history, but future edits will be blocked until restored.`
        : `Restore ${season.name}? This will make the season editable again.`
    )

    if (!confirmed) {
      return
    }

    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    const response = await fetch(`/api/seasons/${season.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ archived })
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? 'Unable to update season')
      setIsSubmitting(false)
      return
    }

    if (editingSeasonId === season.id && archived) {
      setEditingSeasonId(null)
    }

    setIsSubmitting(false)
    await refreshPage(archived ? 'Season archived.' : 'Season restored.')
  }

  async function handleDeleteSeason(season: RosterPageData['seasons'][number]) {
    const confirmed = window.confirm(
      `Delete ${season.name}? This permanently removes its weeks, matches, scores, and history.`
    )

    if (!confirmed) {
      return
    }

    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    const response = await fetch(`/api/seasons/${season.id}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? 'Unable to delete season')
      setIsSubmitting(false)
      return
    }

    if (editingSeasonId === season.id) {
      setEditingSeasonId(null)
    }

    setIsSubmitting(false)
    await refreshPage('Season deleted.')
  }

  const editingSeason = data.seasons.find((season) => season.id === editingSeasonId) ?? null

  return (
    <section className="space-y-4 px-4 py-6">
      <div className="rounded-xl border border-surface-border bg-surface-elevated p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
          Roster
        </p>
        <h2 className="mt-2 text-xl font-bold text-text-primary">Players and Admin</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Add players, manage contact info, and create or maintain seasons with prebuilt Friday weeks.
        </p>
      </div>

      {message ? (
        <div className="rounded-md border border-accent bg-accent-dim px-4 py-3 text-sm text-accent-text">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-danger bg-danger-dim px-4 py-3 text-sm text-danger-text">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <form
          className="rounded-xl border border-surface-border bg-surface-elevated p-4"
          onSubmit={handleCreatePlayer}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
            Add Player
          </p>
          <div className="mt-4 space-y-3">
            <input
              className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              placeholder="Name"
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
            />
            <input
              className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              placeholder="Email (optional)"
              value={playerEmail}
              onChange={(event) => setPlayerEmail(event.target.value)}
            />
            <input
              className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              inputMode="tel"
              placeholder="Cell phone (optional)"
              value={playerCellPhone}
              onChange={(event) => handlePlayerCellPhoneChange(event.target.value)}
            />
            <input
              className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              inputMode="decimal"
              placeholder="Seed handicap (optional)"
              value={playerSeedHandicap}
              onChange={(event) => setPlayerSeedHandicap(event.target.value)}
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-disabled"
              disabled={isSubmitting}
            >
              Add Player
            </button>
          </div>
        </form>

        <form
          className="rounded-xl border border-surface-border bg-surface-elevated p-4"
          onSubmit={handleCreateSeason}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
            Create Season
          </p>
          <div className="mt-4 space-y-3">
            <input
              className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              placeholder="Spring 2026"
              value={seasonName}
              onChange={(event) => setSeasonName(event.target.value)}
            />
            <select
              className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              value={seasonType}
              onChange={(event) => setSeasonType(event.target.value as 'spring' | 'summer')}
            >
              <option value="spring">Spring</option>
              <option value="summer">Summer</option>
            </select>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
                Start Date
              </p>
              <input
                className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
                type="date"
                value={seasonStartDate}
                onChange={(event) => setSeasonStartDate(event.target.value)}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_120px]">
              <input
                className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
                type="date"
                value={seasonDatePickerValue}
                onChange={(event) => setSeasonDatePickerValue(event.target.value)}
              />
              <button
                type="button"
                className="rounded-lg border border-surface-border bg-surface-sunken px-4 py-3 text-sm font-semibold text-text-primary"
                onClick={() => addSeasonDate(seasonDatePickerValue)}
              >
                Add Date
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-[120px_1fr]">
              <input
                className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
                inputMode="numeric"
                value={seasonWeekCount}
                onChange={(event) => setSeasonWeekCount(event.target.value)}
              />
              <button
                type="button"
                className="rounded-lg border border-surface-border bg-surface-sunken px-4 py-3 text-sm font-semibold text-text-primary"
                onClick={generateWeeklyDates}
              >
                Generate Weekly Dates
              </button>
            </div>
            <div className="rounded-lg border border-surface-border bg-surface-sunken p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
                Selected Week Dates
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {seasonWeekDates.length > 0 ? (
                  seasonWeekDates.map((date) => (
                    <button
                      key={date}
                      type="button"
                      className="rounded bg-accent-dim px-2 py-1 text-xs font-semibold text-accent-text"
                      onClick={() => removeSeasonDate(date)}
                    >
                      {date} ×
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-text-secondary">No dates selected yet.</p>
                )}
              </div>
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-disabled"
              disabled={isSubmitting}
            >
              Create Season
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-surface-border bg-surface-elevated">
        <div className="border-b border-surface-border px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
            Players ({data.players.length})
          </p>
        </div>
        <div className="divide-y divide-surface-border">
          {data.players.map((player) => (
            <div key={player.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-text-primary">{player.name}</p>
                <p className="mt-1 text-xs text-text-secondary">
                  {player.email ?? 'No email'} · {formatUsPhoneNumber(player.cellPhone) ?? 'No cell'}{' '}
                  ·{' '}
                  {player.handicap.kind === 'HCP' ? player.handicap.value : player.handicap.kind}
                </p>
                <p className="mt-1 text-[11px] text-text-secondary">
                  {player.importedHandicapRounds.length > 0
                    ? `${player.importedHandicapRounds.length} imported handicap round${player.importedHandicapRounds.length === 1 ? '' : 's'}`
                    : 'No imported handicap history'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-lg bg-surface-sunken px-3 py-2 text-sm font-semibold text-text-primary"
                  onClick={() => beginEditingPlayer(player)}
                  disabled={isSubmitting}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                    player.active
                      ? 'bg-surface-sunken text-text-primary'
                      : 'bg-accent-dim text-accent-text'
                  }`}
                  onClick={() => handleTogglePlayer(player.id, !player.active)}
                  disabled={isSubmitting}
                >
                  {player.active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {editingPlayerId ? (
        <form
          className="rounded-xl border border-surface-border bg-surface-elevated p-4"
          onSubmit={handleSavePlayer}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
                Edit Player
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Update player profile, contact info, and seeded handicap.
              </p>
            </div>
            <button
              type="button"
              className="text-sm text-text-secondary"
              onClick={() => setEditingPlayerId(null)}
            >
              Close
            </button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              placeholder="Name"
              value={editingPlayerName}
              onChange={(event) => setEditingPlayerName(event.target.value)}
            />
            <input
              className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              placeholder="Email"
              value={editingPlayerEmail}
              onChange={(event) => setEditingPlayerEmail(event.target.value)}
            />
            <input
              className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              inputMode="tel"
              placeholder="Cell phone"
              value={editingPlayerCellPhone}
              onChange={(event) => handleEditingPlayerCellPhoneChange(event.target.value)}
            />
            <input
              className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              inputMode="decimal"
              placeholder="Seed handicap"
              value={editingPlayerSeedHandicap}
              onChange={(event) => setEditingPlayerSeedHandicap(event.target.value)}
            />
          </div>
          <div className="mt-4 rounded-lg border border-surface-border bg-surface-sunken p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
              Prior Handicap Rounds
            </p>
            <p className="mt-2 text-xs text-text-secondary">
              Paste up to 20 lines in this format:
              {' '}
              <code>YYYY-MM-DD, gross, adjusted, rating, slope, par</code>
            </p>
            <p className="mt-1 text-xs text-text-secondary">
              You can also omit adjusted and use
              {' '}
              <code>YYYY-MM-DD, gross, rating, slope, par</code>
              {' '}
              when gross and adjusted are the same.
            </p>
            <textarea
              className="mt-3 min-h-48 w-full rounded-md border border-surface-border bg-surface-elevated px-3 py-2.5 text-sm text-text-primary"
              placeholder={'2025-10-03, 41, 39, 34.9, 119, 36\n2025-10-10, 43, 43, 35.4, 123, 36'}
              value={editingPlayerImportedRoundsText}
              onChange={(event) => setEditingPlayerImportedRoundsText(event.target.value)}
            />
          </div>
          <button
            type="submit"
            className="mt-4 w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-disabled"
            disabled={isSubmitting}
          >
            Save Player
          </button>
        </form>
      ) : null}

      <section className="rounded-xl border border-surface-border bg-surface-elevated">
        <div className="border-b border-surface-border px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
            Seasons ({data.seasons.length})
          </p>
        </div>
        <div className="divide-y divide-surface-border">
          {data.seasons.length > 0 ? (
            data.seasons.map((season) => (
              <div key={season.id} className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-text-primary">{season.name}</p>
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em] ${
                        season.archivedAt
                          ? 'bg-surface-sunken text-text-secondary'
                          : 'bg-accent-dim text-accent-text'
                      }`}
                    >
                      {season.archivedAt ? 'Archived' : 'Active'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    {season.type} · {season.startDate} to {season.endDate} · {season.weekCount} weeks
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {season.hasWeekActivity
                      ? 'Week dates are locked in because attendance or match data already exists.'
                      : 'Week dates are still editable.'}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-surface-sunken px-3 py-2 text-sm font-semibold text-text-primary disabled:cursor-not-allowed disabled:text-text-disabled"
                    onClick={() => beginEditingSeason(season)}
                    disabled={isSubmitting || Boolean(season.archivedAt)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-surface-sunken px-3 py-2 text-sm font-semibold text-text-primary disabled:cursor-not-allowed disabled:text-text-disabled"
                    onClick={() => handleSeasonArchiveToggle(season, !season.archivedAt)}
                    disabled={isSubmitting}
                  >
                    {season.archivedAt ? 'Restore' : 'Archive'}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-danger-dim px-3 py-2 text-sm font-semibold text-danger-text disabled:cursor-not-allowed disabled:text-text-disabled"
                    onClick={() => handleDeleteSeason(season)}
                    disabled={isSubmitting}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-text-secondary">No seasons created yet.</div>
          )}
        </div>
      </section>

      {editingSeasonId ? (
        <form
          className="rounded-xl border border-surface-border bg-surface-elevated p-4"
          onSubmit={handleSaveSeason}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
                Edit Season
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Update season metadata and, when no week activity exists yet, adjust the scheduled dates.
              </p>
            </div>
            <button
              type="button"
              className="text-sm text-text-secondary"
              onClick={() => setEditingSeasonId(null)}
            >
              Close
            </button>
          </div>
          <div className="mt-4 space-y-3">
            <input
              className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              placeholder="Season name"
              value={editingSeasonName}
              onChange={(event) => setEditingSeasonName(event.target.value)}
            />
            <select
              className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              value={editingSeasonType}
              onChange={(event) => setEditingSeasonType(event.target.value as 'spring' | 'summer')}
            >
              <option value="spring">Spring</option>
              <option value="summer">Summer</option>
            </select>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
                Start Date
              </p>
              <input
                className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
                type="date"
                value={editingSeasonStartDate}
                onChange={(event) => setEditingSeasonStartDate(event.target.value)}
                disabled={editingSeason?.hasWeekActivity}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_120px]">
              <input
                className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary disabled:text-text-disabled"
                type="date"
                value={editingSeasonDatePickerValue}
                onChange={(event) => setEditingSeasonDatePickerValue(event.target.value)}
                disabled={editingSeason?.hasWeekActivity}
              />
              <button
                type="button"
                className="rounded-lg border border-surface-border bg-surface-sunken px-4 py-3 text-sm font-semibold text-text-primary disabled:cursor-not-allowed disabled:text-text-disabled"
                onClick={() => addEditingSeasonDate(editingSeasonDatePickerValue)}
                disabled={editingSeason?.hasWeekActivity}
              >
                Add Date
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-[120px_1fr]">
              <input
                className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary disabled:text-text-disabled"
                inputMode="numeric"
                value={editingSeasonWeekCount}
                onChange={(event) => setEditingSeasonWeekCount(event.target.value)}
                disabled={editingSeason?.hasWeekActivity}
              />
              <button
                type="button"
                className="rounded-lg border border-surface-border bg-surface-sunken px-4 py-3 text-sm font-semibold text-text-primary disabled:cursor-not-allowed disabled:text-text-disabled"
                onClick={generateEditingSeasonDates}
                disabled={editingSeason?.hasWeekActivity}
              >
                Generate Weekly Dates
              </button>
            </div>
            <div className="rounded-lg border border-surface-border bg-surface-sunken p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
                Scheduled Week Dates
              </p>
              {editingSeason?.hasWeekActivity ? (
                <p className="mt-2 text-xs text-text-secondary">
                  Dates are read-only because this season already has attendance, pairings, or scores.
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {editingSeasonWeekDates.length > 0 ? (
                  editingSeasonWeekDates.map((date) => (
                    <button
                      key={date}
                      type="button"
                      className="rounded bg-accent-dim px-2 py-1 text-xs font-semibold text-accent-text disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => removeEditingSeasonDate(date)}
                      disabled={editingSeason?.hasWeekActivity}
                    >
                      {date} ×
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-text-secondary">No dates selected yet.</p>
                )}
              </div>
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-disabled"
              disabled={isSubmitting}
            >
              Save Season
            </button>
          </div>
        </form>
      ) : null}
    </section>
  )
}

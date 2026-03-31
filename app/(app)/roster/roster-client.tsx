'use client'

import type { FormEvent } from 'react'
import { startTransition, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type RosterPageData = {
  players: Array<{
    id: string
    name: string
    email: string | null
    cellPhone: string | null
    active: boolean
    seedHandicap: number | null
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
  const [seasonName, setSeasonName] = useState('')
  const [seasonType, setSeasonType] = useState<'spring' | 'summer'>('spring')
  const [seasonStartDate, setSeasonStartDate] = useState('')
  const [seasonWeekDates, setSeasonWeekDates] = useState<string[]>([])
  const [seasonDatePickerValue, setSeasonDatePickerValue] = useState('')
  const [seasonWeekCount, setSeasonWeekCount] = useState('8')
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
        seedHandicap: editingPlayerSeedHandicap
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
    setIsSubmitting(false)
    await refreshPage('Player updated.')
  }

  function beginEditingPlayer(player: RosterPageData['players'][number]) {
    setEditingPlayerId(player.id)
    setEditingPlayerName(player.name)
    setEditingPlayerEmail(player.email ?? '')
    setEditingPlayerCellPhone(player.cellPhone ?? '')
    setEditingPlayerSeedHandicap(player.seedHandicap?.toString() ?? '')
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
    if (!seasonStartDate) {
      setError('Choose a season start date first.')
      return
    }

    const weeks = Number(seasonWeekCount)
    if (!Number.isInteger(weeks) || weeks < 1) {
      setError('Week count must be at least 1.')
      return
    }

    const start = new Date(`${seasonStartDate}T00:00:00-07:00`)
    const dates = Array.from({ length: weeks }, (_, index) => {
      const next = new Date(start)
      next.setDate(start.getDate() + index * 7)
      return next.toISOString().slice(0, 10)
    })

    setSeasonWeekDates(dates)
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

  return (
    <section className="space-y-4 px-4 py-6">
      <div className="rounded-xl border border-surface-border bg-surface-elevated p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
          Roster
        </p>
        <h2 className="mt-2 text-xl font-bold text-text-primary">Players and Admin</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Add players, toggle active status, and create seasons with prebuilt Friday weeks.
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
              placeholder="Cell phone (optional)"
              value={playerCellPhone}
              onChange={(event) => setPlayerCellPhone(event.target.value)}
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
                  {player.email ?? 'No email'} · {player.cellPhone ?? 'No cell'} ·{' '}
                  {player.handicap.kind === 'HCP' ? player.handicap.value : player.handicap.kind}
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
              placeholder="Cell phone"
              value={editingPlayerCellPhone}
              onChange={(event) => setEditingPlayerCellPhone(event.target.value)}
            />
            <input
              className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              inputMode="decimal"
              placeholder="Seed handicap"
              value={editingPlayerSeedHandicap}
              onChange={(event) => setEditingPlayerSeedHandicap(event.target.value)}
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
              <div key={season.id} className="px-4 py-3">
                <p className="text-sm font-medium text-text-primary">{season.name}</p>
                <p className="mt-1 text-xs text-text-secondary">
                  {season.type} · {season.startDate} to {season.endDate} · {season.weekCount} weeks
                </p>
              </div>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-text-secondary">No seasons created yet.</div>
          )}
        </div>
      </section>
    </section>
  )
}

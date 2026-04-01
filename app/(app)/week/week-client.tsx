'use client'

import type { TeeColor } from '@prisma/client'
import { startTransition, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type WeekPageData = {
  currentWeek: {
    id: string
    weekNumber: number
    seasonName: string
    dateLabel: string
    courseId: string | null
    courseName: string | null
    ctpHoleNumber: number | null
    longestPuttHoleNumber: number | null
    ctpWinnerId: string | null
    longestPuttWinnerId: string | null
    locked: boolean
    matchCount: number
    matches: Array<{
      id: string
      player1Name: string
      player2Name: string
      player1TeeColor: TeeColor
      player2TeeColor: TeeColor
      player1Handicap: number
      player2Handicap: number
      player2ScorecardOnly: boolean
      locked: boolean
      scoreComplete: boolean
    }>
  } | null
  upcomingWeek: {
    id: string
    weekNumber: number
    seasonName: string
    dateLabel: string
  } | null
  attendance: Array<{
    playerId: string
    name: string
    present: boolean
    checkedInAt: string | null
    teeColor: TeeColor
    handicap: {
      kind: 'HCP' | 'PRO' | 'EST'
      value: string | null
    }
  }>
  courses: Array<{
    id: string
    name: string
    tees: Array<{
      color: TeeColor
      rating: number
      slope: number
    }>
  }>
  presentCount: number
  totalPlayers: number
}

interface WeekClientProps {
  initialData: WeekPageData
}

const holeOptions = Array.from({ length: 9 }, (_, index) => index + 1)

export function WeekClient({ initialData }: WeekClientProps) {
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setData(initialData)
  }, [initialData])

  async function runAction(action: () => Promise<void>) {
    setIsRefreshing(true)
    setError(null)
    setMessage(null)

    try {
      await action()
      setMessage('Week updated.')
      startTransition(() => {
        router.refresh()
      })
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Request failed')
    } finally {
      setIsRefreshing(false)
    }
  }

  async function toggleAttendance(playerId: string, present: boolean) {
    if (!data.currentWeek) {
      return
    }

    await runAction(async () => {
      const response = await fetch(`/api/weeks/${data.currentWeek?.id}/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          playerId,
          present
        })
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Unable to update attendance')
      }
    })
  }

  async function updateWeekField(field: 'courseId' | 'ctpHoleNumber' | 'longestPuttHoleNumber' | 'ctpWinnerId' | 'longestPuttWinnerId', value: string) {
    if (!data.currentWeek) {
      return
    }

    await runAction(async () => {
      const response = await fetch(`/api/weeks/${data.currentWeek?.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          [field]: value === '' ? null : (field === 'courseId' || field === 'ctpWinnerId' || field === 'longestPuttWinnerId') ? value : Number(value)
        })
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Unable to update week')
      }
    })
  }

  async function generatePairings() {
    if (!data.currentWeek) {
      return
    }

    await runAction(async () => {
      const response = await fetch(`/api/weeks/${data.currentWeek?.id}/pairings`, {
        method: 'POST'
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Unable to generate pairings')
      }

      setMessage('Pairings generated.')
    })
  }

  async function setLockState(locked: boolean) {
    if (!data.currentWeek) {
      return
    }

    await runAction(async () => {
      const response = await fetch(`/api/weeks/${data.currentWeek?.id}/pairings/lock`, {
        method: locked ? 'POST' : 'DELETE'
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Unable to update lock state')
      }

      setMessage(locked ? 'Pairings locked.' : 'Pairings unlocked.')
    })
  }

  async function startUpcomingWeek() {
    if (!data.upcomingWeek) {
      return
    }

    await runAction(async () => {
      const response = await fetch(`/api/weeks/${data.upcomingWeek?.id}/start`, {
        method: 'POST'
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Unable to start the upcoming week')
      }

      setMessage('Upcoming week started for today.')
    })
  }

  if (!data.currentWeek) {
    return (
      <section className="px-4 py-6">
        <div className="rounded-xl border border-surface-border bg-surface-elevated p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
            Week
          </p>
          <h2 className="mt-2 text-xl font-bold text-text-primary">
            {data.upcomingWeek
              ? `Week ${data.upcomingWeek.weekNumber} - ${data.upcomingWeek.seasonName}`
              : 'No current week'}
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            {data.upcomingWeek
              ? `${data.upcomingWeek.dateLabel}. Create or start this week from the season setup flow.`
              : 'No scheduled week was found yet. Start by creating a season and its Friday dates.'}
          </p>
          <div className="mt-6 rounded-lg border border-surface-border bg-surface-sunken p-4 text-sm text-text-secondary">
            <p>Players on roster: {data.totalPlayers}</p>
            <p className="mt-2">Courses configured: {data.courses.length}</p>
          </div>
          {data.upcomingWeek ? (
            <button
              type="button"
              className="mt-4 w-full rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-disabled"
              onClick={startUpcomingWeek}
              disabled={isRefreshing}
            >
              {isRefreshing ? 'Working...' : `Start Week ${data.upcomingWeek.weekNumber} Now`}
            </button>
          ) : null}
        </div>
      </section>
    )
  }

  const canGeneratePairings =
    data.presentCount >= 2 && !!data.currentWeek.courseId && !!data.currentWeek.ctpHoleNumber && !data.currentWeek.locked

  return (
    <section className="space-y-4 px-4 py-6">
      <header className="rounded-xl border border-surface-border bg-surface-elevated p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
          Silicone Desert Golf League
        </p>
        <h2 className="mt-2 text-xl font-bold text-text-primary">
          Week {data.currentWeek.weekNumber} - {data.currentWeek.seasonName}
        </h2>
        <p className="mt-2 text-sm text-accent-text">
          {data.currentWeek.courseName ?? 'Course not selected'} - {data.currentWeek.dateLabel}
        </p>
      </header>

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

      <div className="rounded-md border-l-[3px] border-accent bg-accent-dim px-4 py-3 text-sm text-accent-text">
        {data.presentCount} players checked in
        {data.presentCount % 2 === 1 && data.presentCount > 0 ? ' - Threesome will form' : ''}
        {data.currentWeek.locked ? ' - Pairings locked' : ''}
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <label className="rounded-xl border border-surface-border bg-surface-elevated p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">Course</p>
          <select
            className="mt-2 w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
            value={data.currentWeek.courseId ?? ''}
            onChange={(event) => updateWeekField('courseId', event.target.value)}
            disabled={isRefreshing || data.currentWeek.locked}
          >
            <option value="">Select course</option>
            {data.courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.name}
              </option>
            ))}
          </select>
        </label>

        <label className="rounded-xl border border-surface-border bg-surface-elevated p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
            Closest To Pin
          </p>
          <select
            className="mt-2 w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
            value={data.currentWeek.ctpHoleNumber ?? ''}
            onChange={(event) => updateWeekField('ctpHoleNumber', event.target.value)}
            disabled={isRefreshing || data.currentWeek.locked}
          >
            <option value="">Select hole</option>
            {holeOptions.map((hole) => (
              <option key={hole} value={hole}>
                Hole {hole}
              </option>
            ))}
          </select>
        </label>

        <label className="rounded-xl border border-surface-border bg-surface-elevated p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
            Longest Putt
          </p>
          <select
            className="mt-2 w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
            value={data.currentWeek.longestPuttHoleNumber ?? ''}
            onChange={(event) => updateWeekField('longestPuttHoleNumber', event.target.value)}
            disabled={isRefreshing || data.currentWeek.locked}
          >
            <option value="">Select hole</option>
            {holeOptions.map((hole) => (
              <option key={hole} value={hole}>
                Hole {hole}
              </option>
            ))}
          </select>
        </label>
      </section>

      {data.currentWeek.locked ? (
        <section className="grid gap-3 md:grid-cols-2">
          <label className="rounded-xl border border-surface-border bg-surface-elevated p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
              CTP Winner · Hole {data.currentWeek.ctpHoleNumber ?? '—'}
            </p>
            <select
              className="mt-2 w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              value={data.currentWeek.ctpWinnerId ?? ''}
              onChange={(event) => updateWeekField('ctpWinnerId', event.target.value)}
              disabled={isRefreshing}
            >
              <option value="">No winner recorded</option>
              {data.attendance.filter((player) => player.present).map((player) => (
                <option key={player.playerId} value={player.playerId}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>

          <label className="rounded-xl border border-surface-border bg-surface-elevated p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
              LP Winner · Hole {data.currentWeek.longestPuttHoleNumber ?? '—'}
            </p>
            <select
              className="mt-2 w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              value={data.currentWeek.longestPuttWinnerId ?? ''}
              onChange={(event) => updateWeekField('longestPuttWinnerId', event.target.value)}
              disabled={isRefreshing}
            >
              <option value="">No winner recorded</option>
              {data.attendance.filter((player) => player.present).map((player) => (
                <option key={player.playerId} value={player.playerId}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>
        </section>
      ) : null}

      <section className="rounded-xl border border-surface-border bg-surface-elevated">
        <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
            Attendance
          </p>
          <span className="rounded bg-accent px-2 py-1 text-[11px] font-semibold text-white">
            {data.presentCount} / {data.totalPlayers}
          </span>
        </div>
        <div className="divide-y divide-surface-border">
          {data.attendance.map((player) => (
            <button
              key={player.playerId}
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-left disabled:cursor-not-allowed"
              onClick={() => toggleAttendance(player.playerId, !player.present)}
              disabled={isRefreshing || data.currentWeek?.locked}
            >
              <span
                className={`h-4 w-4 rounded-full border ${
                  player.present ? 'border-accent bg-accent' : 'border-text-disabled bg-transparent'
                }`}
              />
              <span
                className={`flex-1 text-sm ${
                  player.present ? 'font-semibold text-text-primary' : 'text-text-secondary'
                }`}
              >
                {player.name}
              </span>
              <span
                className={`rounded px-2 py-1 text-[11px] font-semibold ${
                  player.handicap.kind === 'PRO'
                    ? 'bg-warning-dim text-warning-text'
                    : player.handicap.kind === 'EST'
                      ? 'bg-surface-sunken text-text-secondary'
                      : 'bg-transparent text-text-secondary'
                }`}
              >
                {player.handicap.kind === 'HCP' ? player.handicap.value : player.handicap.kind} ·{' '}
                {player.teeColor.toUpperCase()}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-surface-border bg-surface-elevated p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
              Pairings
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              {data.currentWeek.matchCount > 0
                ? `${data.currentWeek.matchCount} tentative matches created.`
                : 'No pairings generated yet.'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-disabled"
              onClick={generatePairings}
              disabled={!canGeneratePairings || isRefreshing}
            >
              {isRefreshing ? 'Working...' : 'Generate Pairings'}
            </button>
            {data.currentWeek.matchCount > 0 ? (
              <button
                type="button"
                className={`rounded-lg px-4 py-3 text-sm font-semibold ${
                  data.currentWeek.locked
                    ? 'bg-danger-dim text-danger-text'
                    : 'bg-surface-sunken text-text-primary'
                } disabled:cursor-not-allowed disabled:opacity-70`}
                onClick={() => setLockState(!data.currentWeek?.locked)}
                disabled={isRefreshing}
              >
                {data.currentWeek.locked ? 'Unlock' : 'Lock Pairings'}
              </button>
            ) : null}
          </div>
        </div>

        {data.currentWeek.matches.length > 0 ? (
          <div className="mt-4 space-y-3">
            {data.currentWeek.matches.map((match, index) => (
              <div key={match.id} className="rounded-lg border border-surface-border bg-surface-sunken p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-text-muted">
                  Match {index + 1}
                </p>
                <p
                  className={`mt-1 text-xs font-semibold ${
                    match.scoreComplete ? 'text-accent-text' : 'text-text-secondary'
                  }`}
                >
                  {match.scoreComplete ? 'Complete' : data.currentWeek?.locked ? 'Pending scores' : 'Tentative'}
                </p>
                <div className="mt-2 flex items-center justify-between text-sm text-text-primary">
                  <span>
                    {match.player1Name} ({match.player1TeeColor.toUpperCase()})
                  </span>
                  <span className="text-text-secondary">HCP {match.player1Handicap}</span>
                </div>
                <div className="mt-1 text-center text-xs uppercase tracking-[0.06em] text-text-muted">vs</div>
                <div className="mt-1 flex items-center justify-between text-sm text-text-primary">
                  <span>
                    {match.player2Name} ({match.player2TeeColor.toUpperCase()})
                  </span>
                  <span className="text-text-secondary">
                    {match.player2ScorecardOnly ? 'Reference scorecard' : `HCP ${match.player2Handicap}`}
                  </span>
                </div>
                {data.currentWeek?.locked ? (
                  <div className="mt-3">
                    <Link
                      href={`/week/matches/${match.id}`}
                      className="text-sm font-semibold text-accent-text"
                    >
                      Enter Scores
                    </Link>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </section>
  )
}

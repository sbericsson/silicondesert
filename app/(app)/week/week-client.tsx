'use client'

import type { TeeColor } from '@prisma/client'
import { startTransition, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { buildPublicUrl } from '@/lib/public-url'

type WeekPageData = {
  currentWeek: {
    id: string
    weekNumber: number
    seasonName: string
    dateLabel: string
    startedAt: string | null
    completedAt: string | null
    courseId: string | null
    courseName: string | null
    ctpHoleOptions: number[]
    ctpHoleNumber: number | null
    longestPuttHoleNumber: number | null
    ctpWinnerId: string | null
    ctpWinnerName: string | null
    longestPuttWinnerId: string | null
    longestPuttWinnerName: string | null
    locked: boolean
    matchCount: number
    matches: Array<{
      id: string
      player1Id: string
      player2Id: string
      player1Name: string
      player2Name: string
      player1TeeColor: TeeColor
      player2TeeColor: TeeColor
      player1DisplayHandicapIndex: number
      player2DisplayHandicapIndex: number
      player1CourseHandicap: number
      player2CourseHandicap: number
      popDifference: number
      popRecipientId: string | null
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
    isOverdue: boolean
  } | null
  attendance: Array<{
    playerId: string
    name: string
    present: boolean
    ctpPoolPaid: boolean
    longestPuttPoolPaid: boolean
    checkedInAt: string | null
    teeColor: TeeColor
    handicap: {
      kind: 'HCP' | 'NEW' | 'EST'
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
    holes: Array<{
      holeNumber: number
      par: number
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
  const [manualPlayer1Id, setManualPlayer1Id] = useState('')
  const [manualPlayer2Id, setManualPlayer2Id] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pendingAttendancePlayerIds, setPendingAttendancePlayerIds] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copyMessage, setCopyMessage] = useState<string | null>(null)

  useEffect(() => {
    setData(initialData)
  }, [initialData])

  useEffect(() => {
    if (!data.currentWeek) {
      setManualPlayer1Id('')
      setManualPlayer2Id('')
      return
    }

    const matchedPlayerIds = new Set(
      data.currentWeek.matches.flatMap((match) => [match.player1Id, match.player2Id])
    )
    const unmatchedPresentPlayers = data.attendance.filter(
      (player) => player.present && !matchedPlayerIds.has(player.playerId)
    )

    setManualPlayer1Id((current) =>
      current && unmatchedPresentPlayers.some((player) => player.playerId === current)
        ? current
        : unmatchedPresentPlayers[0]?.playerId ?? ''
    )
    setManualPlayer2Id((current) =>
      current &&
      current !== unmatchedPresentPlayers[0]?.playerId &&
      unmatchedPresentPlayers.some((player) => player.playerId === current)
        ? current
        : unmatchedPresentPlayers.find((player) => player.playerId !== unmatchedPresentPlayers[0]?.playerId)
            ?.playerId ?? ''
    )
  }, [data])

  function applyAttendanceRecord(record: {
    playerId: string
    present: boolean
    ctpPoolPaid: boolean
    longestPuttPoolPaid: boolean
    checkedInAt: string | null
  }) {
    setData((current) => {
      const nextAttendance = current.attendance.map((player) =>
        player.playerId === record.playerId
          ? {
              ...player,
              present: record.present,
              ctpPoolPaid: record.ctpPoolPaid,
              longestPuttPoolPaid: record.longestPuttPoolPaid,
              checkedInAt: record.checkedInAt
            }
          : player
      )

      return {
        ...current,
        attendance: nextAttendance,
        presentCount: nextAttendance.filter((player) => player.present).length
      }
    })
  }

  function setAttendancePending(playerId: string, pending: boolean) {
    setPendingAttendancePlayerIds((current) => {
      if (pending) {
        return current.includes(playerId) ? current : [...current, playerId]
      }

      return current.filter((currentPlayerId) => currentPlayerId !== playerId)
    })
  }

  async function runAction(action: () => Promise<void>, successMessage = 'Week updated.') {
    setIsRefreshing(true)
    setError(null)
    setMessage(null)
    setCopyMessage(null)

    try {
      await action()
      setMessage(successMessage)
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

    const previousAttendance = data.attendance
    const previousPresentCount = data.presentCount
    const currentPlayer = previousAttendance.find((player) => player.playerId === playerId)

    applyAttendanceRecord({
      playerId,
      present,
      ctpPoolPaid: false,
      longestPuttPoolPaid: false,
      checkedInAt: present ? currentPlayer?.checkedInAt ?? new Date().toISOString() : null
    })
    setAttendancePending(playerId, true)
    setError(null)
    setCopyMessage(null)

    try {
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

      const payload = await response.json()
      applyAttendanceRecord({
        playerId: payload.playerId,
        present: payload.present,
        ctpPoolPaid: payload.ctpPoolPaid,
        longestPuttPoolPaid: payload.longestPuttPoolPaid,
        checkedInAt: payload.checkedInAt
      })
    } catch (actionError) {
      setData((current) => ({
        ...current,
        attendance: previousAttendance,
        presentCount: previousPresentCount
      }))
      setError(actionError instanceof Error ? actionError.message : 'Unable to update attendance')
    } finally {
      setAttendancePending(playerId, false)
    }
  }

  async function updatePrizePoolStatus(
    playerId: string,
    field: 'ctpPoolPaid' | 'longestPuttPoolPaid',
    value: boolean
  ) {
    if (!data.currentWeek) {
      return
    }

    const previousAttendance = data.attendance
    const previousPresentCount = data.presentCount
    const currentPlayer = previousAttendance.find((player) => player.playerId === playerId)

    if (!currentPlayer) {
      return
    }

    applyAttendanceRecord({
      playerId,
      present: currentPlayer.present,
      ctpPoolPaid: field === 'ctpPoolPaid' ? value : currentPlayer.ctpPoolPaid,
      longestPuttPoolPaid:
        field === 'longestPuttPoolPaid' ? value : currentPlayer.longestPuttPoolPaid,
      checkedInAt: currentPlayer.checkedInAt
    })
    setAttendancePending(playerId, true)
    setError(null)
    setCopyMessage(null)

    try {
      const response = await fetch(`/api/weeks/${data.currentWeek?.id}/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          playerId,
          [field]: value
        })
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Unable to update prize-pool status')
      }

      const payload = await response.json()
      applyAttendanceRecord({
        playerId: payload.playerId,
        present: payload.present,
        ctpPoolPaid: payload.ctpPoolPaid,
        longestPuttPoolPaid: payload.longestPuttPoolPaid,
        checkedInAt: payload.checkedInAt
      })
    } catch (actionError) {
      setData((current) => ({
        ...current,
        attendance: previousAttendance,
        presentCount: previousPresentCount
      }))
      setError(
        actionError instanceof Error ? actionError.message : 'Unable to update prize-pool status'
      )
    } finally {
      setAttendancePending(playerId, false)
    }
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
    }, 'Pairings generated.')
  }

  async function createManualPairing() {
    if (!data.currentWeek || !manualPlayer1Id || !manualPlayer2Id || manualPlayer1Id === manualPlayer2Id) {
      return
    }

    await runAction(async () => {
      const response = await fetch(`/api/weeks/${data.currentWeek?.id}/pairings/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          player1Id: manualPlayer1Id,
          player2Id: manualPlayer2Id
        })
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Unable to create manual pairing')
      }
    }, 'Manual pairing created.')
  }

  async function removePairing(matchId: string) {
    if (!data.currentWeek) {
      return
    }

    await runAction(async () => {
      const response = await fetch(`/api/weeks/${data.currentWeek?.id}/pairings/${matchId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Unable to remove pairing')
      }
    }, 'Pairing removed.')
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
    }, locked ? 'Pairings locked.' : 'Pairings unlocked.')
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
    }, 'Week started.')
  }

  async function closeCurrentWeek() {
    if (!data.currentWeek) {
      return
    }

    await runAction(async () => {
      const response = await fetch(`/api/weeks/${data.currentWeek?.id}/close`, {
        method: 'POST'
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Unable to close the week')
      }
    }, 'Week closed. Start the next scheduled week when you are ready.')
  }

  async function copyToClipboard(text: string) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text)
        return
      } catch {
        // clipboard permission denied — fall through to execCommand
      }
    }

    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.setAttribute('readonly', 'true')
    textArea.style.position = 'absolute'
    textArea.style.left = '-9999px'
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
  }

  async function copyPairingsLink() {
    if (!data.currentWeek) {
      return
    }

    const url = buildPublicUrl(`/public/weeks/${data.currentWeek.id}`, window.location.origin)
    await copyToClipboard(url)
    setCopyMessage('Copied pairings link.')
  }

  async function copyResultsShareText() {
    if (!data.currentWeek) {
      return
    }

    const resultsUrl = buildPublicUrl(`/public/weeks/${data.currentWeek.id}`, window.location.origin)
    const standingsUrl = buildPublicUrl('/public/standings', window.location.origin)
    const lines = [
      `Silicon Desert Golf League - Week ${data.currentWeek.weekNumber}`,
      `${data.currentWeek.courseName ?? 'Course TBD'} · ${data.currentWeek.dateLabel}`,
      '',
      `Results: ${resultsUrl}`,
      `Standings: ${standingsUrl}`
    ]

    if (data.currentWeek.ctpWinnerName && data.currentWeek.ctpHoleNumber) {
      lines.push('', `CTP: ${data.currentWeek.ctpWinnerName} (Hole ${data.currentWeek.ctpHoleNumber})`)
    }

    if (data.currentWeek.longestPuttWinnerName && data.currentWeek.longestPuttHoleNumber) {
      if (!(data.currentWeek.ctpWinnerName && data.currentWeek.ctpHoleNumber)) {
        lines.push('')
      }

      lines.push(
        `LP: ${data.currentWeek.longestPuttWinnerName} (Hole ${data.currentWeek.longestPuttHoleNumber})`
      )
    }

    const normalizedLines = lines.filter((line, index, array) => {
      if (line !== '') {
        return true
      }

      return array[index - 1] !== ''
    })

    await copyToClipboard(normalizedLines.join('\n'))
    setCopyMessage('Copied results share text.')
  }

  if (!data.currentWeek) {
    return (
      <section className="px-4 py-6">
        <div className="rounded-xl border border-surface-border bg-surface-elevated p-4">
          <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
            Week Workspace
          </p>
          <h2 className="font-condensed mt-2 text-2xl font-bold uppercase tracking-wide text-text-primary">
            {data.upcomingWeek
              ? `Week ${data.upcomingWeek.weekNumber} - ${data.upcomingWeek.seasonName}`
              : 'No active week'}
          </h2>
          <p className="mt-2 text-sm text-text-secondary">
            {data.upcomingWeek
              ? data.upcomingWeek.isOverdue
                ? `${data.upcomingWeek.dateLabel}. This scheduled week has not been started yet and needs to be opened before later weeks can be scored.`
                : `${data.upcomingWeek.dateLabel}. This is the next scheduled week and can be started whenever the commissioner is ready.`
              : 'No scheduled week was found yet. Start by creating a season and its Friday dates.'}
          </p>
          <div className="mt-6 rounded-lg border border-surface-border bg-surface-sunken p-4 text-sm text-text-secondary">
            {data.upcomingWeek ? (
              <p>
                {data.upcomingWeek.isOverdue ? 'Needs attention:' : 'Next up:'} Week {data.upcomingWeek.weekNumber} -{' '}
                {data.upcomingWeek.seasonName}
              </p>
            ) : null}
            <p>Players on roster: {data.totalPlayers}</p>
            <p className="mt-2">Courses configured: {data.courses.length}</p>
          </div>
          {data.upcomingWeek ? (
            <button
              type="button"
              className="font-condensed mt-4 w-full rounded-lg bg-accent px-4 py-3 text-sm font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-disabled"
              onClick={startUpcomingWeek}
              disabled={isRefreshing}
            >
              {isRefreshing ? 'Working...' : `Start Week ${data.upcomingWeek.weekNumber}`}
            </button>
          ) : null}
        </div>
      </section>
    )
  }

  const matchedPlayerIds = new Set(
    data.currentWeek.matches.flatMap((match) => [match.player1Id, match.player2Id])
  )
  const unmatchedPresentPlayers = data.attendance.filter(
    (player) => player.present && !matchedPlayerIds.has(player.playerId)
  )
  const canGeneratePairings =
    unmatchedPresentPlayers.length >= 2 &&
    !!data.currentWeek.courseId &&
    !!data.currentWeek.ctpHoleNumber &&
    !data.currentWeek.locked
  const allScoresComplete =
    data.currentWeek.matches.length > 0 && data.currentWeek.matches.every((match) => match.scoreComplete)
  const canCreateManualPairing =
    !data.currentWeek.locked &&
    unmatchedPresentPlayers.length >= 2 &&
    manualPlayer1Id.length > 0 &&
    manualPlayer2Id.length > 0 &&
    manualPlayer1Id !== manualPlayer2Id
  const canCloseWeek = data.currentWeek.locked && allScoresComplete && !data.currentWeek.completedAt

  const selectedCourse =
    data.currentWeek.courseId
      ? data.courses.find((course) => course.id === data.currentWeek?.courseId) ?? null
      : null
  const ctpHoleOptions =
    selectedCourse?.holes.filter((hole) => hole.par === 3).map((hole) => hole.holeNumber) ??
    data.currentWeek.ctpHoleOptions
  const eligibleCtpPlayers = data.attendance.filter((player) => player.present && player.ctpPoolPaid)
  const eligibleLongestPuttPlayers = data.attendance.filter(
    (player) => player.present && player.longestPuttPoolPaid
  )

  return (
    <section className="space-y-4 px-4 py-6">
      <header className="rounded-xl border border-surface-border bg-surface-elevated p-4">
        <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
          Silicon Desert Golf League
        </p>
        <h2 className="font-condensed mt-2 text-2xl font-bold uppercase tracking-wide text-text-primary">
          Week {data.currentWeek.weekNumber} — {data.currentWeek.seasonName}
        </h2>
        <p className="mt-2 text-sm text-accent-text">
          {data.currentWeek.courseName ?? 'Course not selected'} - {data.currentWeek.dateLabel}
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-surface-border bg-surface-elevated p-4">
          <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
            Active Week
          </p>
          <p className="mt-2 text-sm text-text-primary">
            Week {data.currentWeek.weekNumber} is the live commissioner workspace.
          </p>
          <p className="mt-1 text-sm text-text-secondary">
            Close it when pairings are locked and all scorecards are entered.
          </p>
        </div>
        <div className="rounded-xl border border-surface-border bg-surface-elevated p-4">
          <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
            Next Scheduled
          </p>
          {data.upcomingWeek ? (
            <>
              <p className="mt-2 text-sm text-text-primary">
                Week {data.upcomingWeek.weekNumber} - {data.upcomingWeek.seasonName}
              </p>
              <p className="mt-1 text-sm text-text-secondary">{data.upcomingWeek.dateLabel}</p>
            </>
          ) : (
            <p className="mt-2 text-sm text-text-secondary">
              No later scheduled week found yet.
            </p>
          )}
        </div>
      </section>

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

      <p className="sr-only" aria-live="polite">
        {copyMessage ?? ''}
      </p>

      <div className="rounded-md border-l-[3px] border-accent bg-accent-dim px-4 py-3 text-sm text-accent-text">
        {data.presentCount} players checked in
        {data.presentCount % 2 === 1 && data.presentCount > 0 ? ' - Threesome will form' : ''}
        {data.currentWeek.locked ? ' - Pairings locked' : ''}
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <label className="rounded-xl border border-surface-border bg-surface-elevated p-4">
          <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">Course</p>
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
          <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
            Closest To Pin
          </p>
          <select
            className="mt-2 w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
            value={data.currentWeek.ctpHoleNumber ?? ''}
            onChange={(event) => updateWeekField('ctpHoleNumber', event.target.value)}
            disabled={isRefreshing || data.currentWeek.locked}
          >
            <option value="">{selectedCourse ? 'Select par 3 hole' : 'Select course first'}</option>
            {ctpHoleOptions.map((hole) => (
              <option key={hole} value={hole}>
                Hole {hole}
              </option>
            ))}
            {data.currentWeek.locked &&
              data.currentWeek.ctpHoleNumber !== null &&
              !ctpHoleOptions.includes(data.currentWeek.ctpHoleNumber) && (
                <option value={data.currentWeek.ctpHoleNumber}>
                  Hole {data.currentWeek.ctpHoleNumber}
                </option>
              )}
          </select>
        </label>

        <label className="rounded-xl border border-surface-border bg-surface-elevated p-4">
          <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
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
            <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
              CTP Winner · Hole {data.currentWeek.ctpHoleNumber ?? '—'}
            </p>
            <p className="mt-2 text-xs text-text-secondary">
              Only checked-in players with the weekly `CTP` box checked are eligible.
            </p>
            <select
              className="mt-2 w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              value={data.currentWeek.ctpWinnerId ?? ''}
              onChange={(event) => updateWeekField('ctpWinnerId', event.target.value)}
              disabled={isRefreshing}
            >
              <option value="">No winner recorded</option>
              {eligibleCtpPlayers.map((player) => (
                <option key={player.playerId} value={player.playerId}>
                  {player.name}
                </option>
              ))}
            </select>
          </label>

          <label className="rounded-xl border border-surface-border bg-surface-elevated p-4">
            <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
              LP Winner · Hole {data.currentWeek.longestPuttHoleNumber ?? '—'}
            </p>
            <p className="mt-2 text-xs text-text-secondary">
              Only checked-in players with the weekly `LPM` box checked are eligible.
            </p>
            <select
              className="mt-2 w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              value={data.currentWeek.longestPuttWinnerId ?? ''}
              onChange={(event) => updateWeekField('longestPuttWinnerId', event.target.value)}
              disabled={isRefreshing}
            >
              <option value="">No winner recorded</option>
              {eligibleLongestPuttPlayers.map((player) => (
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
          <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
            Attendance
          </p>
          <span className="rounded bg-accent px-2 py-1 font-condensed text-[11px] font-semibold text-white">
            {data.presentCount} / {data.totalPlayers}
          </span>
        </div>
        <div className="divide-y divide-surface-border">
          {data.attendance.map((player) => (
            <div
              key={player.playerId}
              className="flex w-full items-center gap-3 px-4 py-3"
            >
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-not-allowed"
                onClick={() => toggleAttendance(player.playerId, !player.present)}
                disabled={
                  isRefreshing ||
                  pendingAttendancePlayerIds.includes(player.playerId) ||
                  data.currentWeek?.locked ||
                  (player.present && matchedPlayerIds.has(player.playerId))
                }
              >
              <span
                className={`h-4 w-4 rounded-full border-2 ${
                  player.present ? 'border-transparent bg-accent-bright' : 'border-surface-border bg-transparent'
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
                  player.handicap.kind === 'NEW'
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
              <label className="flex items-center gap-1 rounded bg-surface-sunken px-2 py-1 text-[11px] font-semibold text-text-secondary">
                <input
                  type="checkbox"
                  checked={player.ctpPoolPaid}
                  onChange={(event) =>
                    updatePrizePoolStatus(player.playerId, 'ctpPoolPaid', event.target.checked)
                  }
                  disabled={
                    isRefreshing ||
                    pendingAttendancePlayerIds.includes(player.playerId) ||
                    data.currentWeek?.locked ||
                    !player.present
                  }
                />
                CTP
              </label>
              <label className="flex items-center gap-1 rounded bg-surface-sunken px-2 py-1 text-[11px] font-semibold text-text-secondary">
                <input
                  type="checkbox"
                  checked={player.longestPuttPoolPaid}
                  onChange={(event) =>
                    updatePrizePoolStatus(
                      player.playerId,
                      'longestPuttPoolPaid',
                      event.target.checked
                    )
                  }
                  disabled={
                    isRefreshing ||
                    pendingAttendancePlayerIds.includes(player.playerId) ||
                    data.currentWeek?.locked ||
                    !player.present
                  }
                />
                LPM
              </label>
              {player.present && matchedPlayerIds.has(player.playerId) ? (
                <span className="rounded bg-surface-sunken px-2 py-1 text-[11px] font-semibold text-text-secondary">
                  Paired
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-surface-border bg-surface-elevated p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
              Pairings
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              {data.currentWeek.matchCount > 0
                ? `${data.currentWeek.matchCount} ${data.currentWeek.locked ? 'locked' : 'tentative'} matches created.`
                : 'No pairings generated yet.'}
            </p>
            {!data.currentWeek.locked ? (
              <p className="mt-1 text-xs text-text-secondary">
                {unmatchedPresentPlayers.length > 0
                  ? `${unmatchedPresentPlayers.length} checked-in player${unmatchedPresentPlayers.length === 1 ? '' : 's'} still unpaired.`
                  : 'All checked-in players are currently assigned to matches.'}
              </p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="font-condensed rounded-lg bg-accent px-4 py-3 text-sm font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-disabled"
              onClick={generatePairings}
              disabled={!canGeneratePairings || isRefreshing}
            >
              {isRefreshing ? 'Working...' : data.currentWeek.matchCount > 0 ? 'Generate Next Pairings' : 'Generate Pairings'}
            </button>
            {data.currentWeek.matchCount > 0 ? (
              <button
                type="button"
                className={`font-condensed rounded-lg px-4 py-3 text-sm font-bold uppercase tracking-wide ${
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

        {data.currentWeek.locked ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="font-condensed rounded-lg border border-surface-border bg-surface-base px-4 py-3 text-sm font-bold uppercase tracking-wide text-text-primary"
              onClick={copyPairingsLink}
            >
              Copy Pairings Link
            </button>
            {allScoresComplete ? (
              <button
                type="button"
                className="font-condensed rounded-lg bg-accent px-4 py-3 text-sm font-bold uppercase tracking-wide text-white"
                onClick={copyResultsShareText}
              >
                Share Results
              </button>
            ) : null}
            {canCloseWeek ? (
              <button
                type="button"
                className="font-condensed rounded-lg bg-surface-sunken px-4 py-3 text-sm font-bold uppercase tracking-wide text-text-primary disabled:cursor-not-allowed disabled:text-text-disabled"
                onClick={closeCurrentWeek}
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

        {data.currentWeek.locked && !allScoresComplete ? (
          <p className="mt-4 text-sm text-text-secondary">
            Enter every locked match score before closing this week.
          </p>
        ) : null}

        {data.currentWeek.matches.length > 0 ? (
          <div className="mt-4 space-y-3">
            {data.currentWeek.matches.map((match, index) => (
              <div key={match.id} className="rounded-lg border border-surface-border bg-surface-sunken p-3">
                <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
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
                  <span className="text-right text-text-secondary">
                    HI {match.player1DisplayHandicapIndex.toFixed(1)} · CH {match.player1CourseHandicap}
                  </span>
                </div>
                <div className="font-condensed mt-1 text-center text-xs font-bold uppercase tracking-widest text-text-muted">vs</div>
                <div className="mt-1 flex items-center justify-between text-sm text-text-primary">
                  <span>
                    {match.player2Name} ({match.player2TeeColor.toUpperCase()})
                  </span>
                  <span className="text-text-secondary">
                    HI {match.player2DisplayHandicapIndex.toFixed(1)} · CH {match.player2CourseHandicap}
                    {match.player2ScorecardOnly ? ' · Reference scorecard' : ''}
                  </span>
                </div>
                <p className="mt-2 text-xs text-text-secondary">
                  {match.popDifference === 0
                    ? 'No pops in this match.'
                    : `${match.popRecipientId === match.player1Id ? match.player1Name : match.player2Name} gets ${match.popDifference} pop${match.popDifference === 1 ? '' : 's'}${match.player2ScorecardOnly ? ' against the reference scorecard' : ''}.`}
                </p>
                {data.currentWeek?.locked ? (
                  <div className="mt-3">
                    <Link
                      href={`/week/matches/${match.id}`}
                      className="text-sm font-semibold text-accent-text"
                    >
                      Enter Scores
                    </Link>
                  </div>
                ) : (
                  <div className="mt-3">
                    <button
                      type="button"
                      className="text-sm font-semibold text-danger-text"
                      onClick={() => removePairing(match.id)}
                      disabled={isRefreshing}
                    >
                      Remove Pairing
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : null}

        {!data.currentWeek.locked ? (
          <div className="mt-4 rounded-lg border border-dashed border-surface-border bg-surface-base p-4">
            <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
              Manual Pairing
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              Use this when you want to hand-build a specific match. Only unmatched checked-in players are shown.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <select
                className="rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
                value={manualPlayer1Id}
                onChange={(event) => setManualPlayer1Id(event.target.value)}
                disabled={isRefreshing || unmatchedPresentPlayers.length < 2}
              >
                <option value="">Select player 1</option>
                {unmatchedPresentPlayers.map((player) => (
                  <option key={player.playerId} value={player.playerId}>
                    {player.name}
                  </option>
                ))}
              </select>
              <select
                className="rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
                value={manualPlayer2Id}
                onChange={(event) => setManualPlayer2Id(event.target.value)}
                disabled={isRefreshing || unmatchedPresentPlayers.length < 2}
              >
                <option value="">Select player 2</option>
                {unmatchedPresentPlayers
                  .filter((player) => player.playerId !== manualPlayer1Id)
                  .map((player) => (
                    <option key={player.playerId} value={player.playerId}>
                      {player.name}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="font-condensed rounded-lg bg-surface-sunken px-4 py-3 text-sm font-bold uppercase tracking-wide text-text-primary disabled:cursor-not-allowed disabled:text-text-disabled"
                onClick={createManualPairing}
                disabled={!canCreateManualPairing || isRefreshing}
              >
                Create Match
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </section>
  )
}

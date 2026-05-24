'use client'

import type { TeeColor } from '@prisma/client'
import { startTransition, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { buildPublicUrl } from '@/lib/public-url'
import { DEFAULT_TRAILING_PLAYER_NAME } from '@/lib/week-commissioner'
import { AttendanceList } from '@/app/(app)/week/attendance-list'
import { PairingsSection } from '@/app/(app)/week/pairings-section'
import { WeekPairingsActionBar } from '@/app/(app)/week/week-pairings-action-bar'
import { WeekTabBar } from '@/app/(app)/week/week-tab-bar'
import { DesktopScoreEntry } from '@/app/(app)/week/desktop-score-entry'
import type { WeekTab } from '@/app/(app)/week/week-tab-bar'
import { WeekSummaryStrip } from '@/app/(app)/week/week-summary-strip'

type WeekPageData = {
  currentWeek: {
    id: string
    weekNumber: number
    seasonName: string
    dateLabel: string
    startedAt: string | null
    completedAt: string | null
    handicapMode: 'index' | 'course'
    handicapModeLabel: string
    courseId: string | null
    courseName: string | null
    ctpHoleOptions: number[]
    ctpHoleNumber: number | null
    longestPuttHoleNumber: number | null
    commissionerPlayerId: string | null
    commissionerPlayerName: string | null
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
      player2ScorecardOnly: boolean
      warnings: Array<{
        player1Id: string
        player2Id: string
        type: 'repeat' | 'gap'
        detail: string
      }>
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
    pairingHandicap: {
      label: 'IDX' | 'CH'
      value: number
    }
    opponentInitials: string[]
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
const SIDE_GAME_ENTRY_FEE = 5

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
  const [activeTab, setActiveTab] = useState<WeekTab>('checkin')

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

  async function updateWeekField(
    field:
      | 'courseId'
      | 'handicapMode'
      | 'ctpHoleNumber'
      | 'longestPuttHoleNumber'
      | 'commissionerPlayerId'
      | 'ctpWinnerId'
      | 'longestPuttWinnerId',
    value: string
  ) {
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
          [field]:
            value === ''
              ? null
              : field === 'courseId' ||
                  field === 'handicapMode' ||
                  field === 'commissionerPlayerId' ||
                  field === 'ctpWinnerId' ||
                  field === 'longestPuttWinnerId'
                ? value
                : Number(value)
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

  async function updateMatchTee(
    matchId: string,
    field: 'player1TeeOverrideColor' | 'player2TeeOverrideColor',
    value: string
  ) {
    if (!data.currentWeek) {
      return
    }

    await runAction(async () => {
      const response = await fetch(`/api/weeks/${data.currentWeek?.id}/pairings/${matchId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          [field]: value === '' ? null : value
        })
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? 'Unable to update match tee')
      }
    }, 'Match tee updated.')
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
  const currentCourseTeeOptions = Array.from(
    new Set(selectedCourse?.tees.map((tee) => tee.color) ?? [])
  )
  const ctpHoleOptions =
    selectedCourse?.holes.filter((hole) => hole.par === 3).map((hole) => hole.holeNumber) ??
    data.currentWeek.ctpHoleOptions
  const eligibleCtpPlayers = data.attendance.filter((player) => player.present && player.ctpPoolPaid)
  const eligibleLongestPuttPlayers = data.attendance.filter(
    (player) => player.present && player.longestPuttPoolPaid
  )
  const ctpPot = eligibleCtpPlayers.length * SIDE_GAME_ENTRY_FEE
  const longestPuttPot = eligibleLongestPuttPlayers.length * SIDE_GAME_ENTRY_FEE
  const isDefaultTrailingPlayerCheckedIn = data.attendance.some(
    (player) => player.present && player.name === DEFAULT_TRAILING_PLAYER_NAME
  )

  const setupIncomplete = !data.currentWeek.courseId || data.currentWeek.ctpHoleNumber == null

  let generateBlockReason: string | null = null
  if (!data.currentWeek.locked && !canGeneratePairings) {
    if (!data.currentWeek.courseId) {
      generateBlockReason = 'Select a course to enable Generate.'
    } else if (data.currentWeek.ctpHoleNumber == null) {
      generateBlockReason = 'Set the CTP hole to enable Generate.'
    } else if (unmatchedPresentPlayers.length < 2) {
      generateBlockReason = 'Check in at least 2 unmatched players.'
    }
  }

  const settingsGrid = (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
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
          Handicap Basis
        </p>
        <select
          className="mt-2 w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
          value={data.currentWeek.handicapMode}
          onChange={(event) => updateWeekField('handicapMode', event.target.value)}
          disabled={isRefreshing}
        >
          <option value="index">Rounded index</option>
          <option value="course">Course handicap</option>
        </select>
        <p className="mt-2 text-xs text-text-secondary">
          Uses {data.currentWeek.handicapModeLabel.toLowerCase()} to assign pops and match net scores.
        </p>
        {data.currentWeek.locked ? (
          <p className="mt-1 text-xs text-text-secondary">
            Locked pairings stay in place, and any saved scores are rescored immediately when this changes.
          </p>
        ) : data.currentWeek.matchCount > 0 ? (
          <p className="mt-1 text-xs text-text-secondary">
            Regenerate pairings if you want this basis to affect matchup selection too.
          </p>
        ) : null}
      </label>

      {!isDefaultTrailingPlayerCheckedIn ? (
        <label className="rounded-xl border border-surface-border bg-surface-elevated p-4">
          <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
            Weekly Commish
          </p>
          <select
            className="mt-2 w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
            value={data.currentWeek.commissionerPlayerId ?? ''}
            onChange={(event) => updateWeekField('commissionerPlayerId', event.target.value)}
            disabled={isRefreshing || data.currentWeek.locked}
          >
            <option value="">No alternate selected</option>
            {data.attendance.map((player) => (
              <option key={player.playerId} value={player.playerId}>
                {player.name}
                {player.present ? ' · checked in' : ''}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-text-secondary">
            Peter Pestalozzi is not checked in, so the selected weekly commissioner will be used
            for the last group when pairings generate.
          </p>
        </label>
      ) : null}

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
        <p className="mt-2 text-xs text-text-secondary">
          {eligibleCtpPlayers.length} player{eligibleCtpPlayers.length === 1 ? '' : 's'} in the
          CTP game · Pot ${ctpPot}
        </p>
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
        <p className="mt-2 text-xs text-text-secondary">
          {eligibleLongestPuttPlayers.length} player{eligibleLongestPuttPlayers.length === 1 ? '' : 's'} in the
          LPM game · Pot ${longestPuttPot}
        </p>
      </label>
    </div>
  )

  return (
    <>
      <section className="space-y-4 px-4 py-6 pb-52 xl:px-6 xl:pb-6">
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

        <section className="hidden gap-3 xl:grid xl:grid-cols-2">
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

        <WeekSummaryStrip
          courseName={data.currentWeek.courseName}
          handicapModeLabel={data.currentWeek.handicapModeLabel}
          ctpHoleNumber={data.currentWeek.ctpHoleNumber}
          longestPuttHoleNumber={data.currentWeek.longestPuttHoleNumber}
          setupIncomplete={setupIncomplete}
        >
          {settingsGrid}
        </WeekSummaryStrip>

        {data.currentWeek.locked ? (
          <section className="grid gap-3 md:grid-cols-2">
            <label className="rounded-xl border border-surface-border bg-surface-elevated p-4">
              <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
                CTP Winner · Hole {data.currentWeek.ctpHoleNumber ?? '—'}
              </p>
              <p className="mt-2 text-xs text-text-secondary">
                Only checked-in players with the weekly `CTP` box checked are eligible. Current pot:
                {' '}${ctpPot} from {eligibleCtpPlayers.length} player{eligibleCtpPlayers.length === 1 ? '' : 's'}.
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
                Only checked-in players with the weekly `LPM` box checked are eligible. Current pot:
                {' '}${longestPuttPot} from {eligibleLongestPuttPlayers.length} player{eligibleLongestPuttPlayers.length === 1 ? '' : 's'}.
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

        <div className="flex flex-col gap-4 xl:flex-row">
          <div className={`xl:flex-1 xl:order-2 ${activeTab === 'pairings' ? '' : 'hidden xl:block'}`}>
            <PairingsSection
              weekId={data.currentWeek.id}
              matches={data.currentWeek.matches}
              matchCount={data.currentWeek.matchCount}
              locked={data.currentWeek.locked}
              handicapMode={data.currentWeek.handicapMode}
              unmatchedPresentPlayers={unmatchedPresentPlayers.map((player) => ({
                playerId: player.playerId,
                name: player.name,
                pairingHandicap: player.pairingHandicap
              }))}
              currentCourseTeeOptions={currentCourseTeeOptions}
              allScoresComplete={allScoresComplete}
              canCloseWeek={canCloseWeek}
              canGeneratePairings={canGeneratePairings}
              canCreateManualPairing={canCreateManualPairing}
              manualPlayer1Id={manualPlayer1Id}
              manualPlayer2Id={manualPlayer2Id}
              copyMessage={copyMessage}
              isRefreshing={isRefreshing}
              onManualPlayer1Change={setManualPlayer1Id}
              onManualPlayer2Change={setManualPlayer2Id}
              onGeneratePairings={generatePairings}
              onSetLockState={setLockState}
              onCreateManualPairing={createManualPairing}
              onRemovePairing={removePairing}
              onUpdateMatchTee={updateMatchTee}
              onCopyPairingsLink={copyPairingsLink}
              onCopyResultsShareText={copyResultsShareText}
              onCloseCurrentWeek={closeCurrentWeek}
            />
          </div>

          <div className={`xl:flex-1 xl:order-1 ${activeTab === 'checkin' ? '' : 'hidden xl:block'}`}>
            <AttendanceList
              attendance={data.attendance}
              presentCount={data.presentCount}
              totalPlayers={data.totalPlayers}
              matchedPlayerIds={matchedPlayerIds}
              pendingAttendancePlayerIds={pendingAttendancePlayerIds}
              isRefreshing={isRefreshing}
              locked={data.currentWeek.locked}
              onToggleAttendance={toggleAttendance}
              onUpdatePrizePoolStatus={updatePrizePoolStatus}
            />
          </div>
        </div>

        {data.currentWeek.locked && data.currentWeek.matches.length > 0 ? (
          <div className="hidden xl:block">
            <div className="rounded-xl border border-surface-border bg-surface-elevated">
              <div className="border-b border-surface-border px-6 py-3">
                <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
                  Score Entry
                </p>
              </div>
              <DesktopScoreEntry
                matches={data.currentWeek.matches.map((match) => ({
                  id: match.id,
                  player1Name: match.player1Name,
                  player2Name: match.player2Name,
                  scoreComplete: match.scoreComplete,
                  player2ScorecardOnly: match.player2ScorecardOnly,
                  weekId: data.currentWeek!.id
                }))}
              />
            </div>
          </div>
        ) : null}
      </section>

      <WeekTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        presentCount={data.presentCount}
        matchCount={data.currentWeek.matchCount}
        unmatchedCount={unmatchedPresentPlayers.length}
        locked={data.currentWeek.locked}
      />

      {activeTab === 'pairings' ? (
        <WeekPairingsActionBar
          unmatchedPresentPlayers={unmatchedPresentPlayers.map((player) => ({
            playerId: player.playerId,
            name: player.name,
            pairingHandicap: player.pairingHandicap
          }))}
          locked={data.currentWeek.locked}
          allScoresComplete={allScoresComplete}
          canCloseWeek={canCloseWeek}
          canGeneratePairings={canGeneratePairings}
          canCreateManualPairing={canCreateManualPairing}
          manualPlayer1Id={manualPlayer1Id}
          manualPlayer2Id={manualPlayer2Id}
          matchCount={data.currentWeek.matchCount}
          generateBlockReason={generateBlockReason}
          isRefreshing={isRefreshing}
          onManualPlayer1Change={setManualPlayer1Id}
          onManualPlayer2Change={setManualPlayer2Id}
          onGeneratePairings={generatePairings}
          onSetLockState={setLockState}
          onCreateManualPairing={createManualPairing}
          onCopyPairingsLink={copyPairingsLink}
          onCopyResultsShareText={copyResultsShareText}
          onCloseCurrentWeek={closeCurrentWeek}
        />
      ) : null}
    </>
  )
}

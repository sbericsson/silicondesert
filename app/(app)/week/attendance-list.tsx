'use client'

import type { TeeColor } from '@prisma/client'

export type AttendancePlayer = {
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
}

interface AttendanceListProps {
  attendance: AttendancePlayer[]
  presentCount: number
  totalPlayers: number
  matchedPlayerIds: Set<string>
  pendingAttendancePlayerIds: string[]
  isRefreshing: boolean
  locked: boolean
  onToggleAttendance: (playerId: string, present: boolean) => void
  onUpdatePrizePoolStatus: (
    playerId: string,
    field: 'ctpPoolPaid' | 'longestPuttPoolPaid',
    value: boolean
  ) => void
}

export function AttendanceList({
  attendance,
  presentCount,
  totalPlayers,
  matchedPlayerIds,
  pendingAttendancePlayerIds,
  isRefreshing,
  locked,
  onToggleAttendance,
  onUpdatePrizePoolStatus
}: AttendanceListProps) {
  return (
    <section className="rounded-xl border border-surface-border bg-surface-elevated">
      <div className="flex items-center justify-between border-b border-surface-border px-4 py-3">
        <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
          Attendance
        </p>
        <span className="rounded bg-accent px-2 py-1 font-condensed text-[11px] font-semibold text-white">
          {presentCount} / {totalPlayers}
        </span>
      </div>
      <div className="divide-y divide-surface-border">
        {attendance.map((player) => (
          <div
            key={player.playerId}
            className="flex w-full items-center gap-3 px-4 py-3"
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-not-allowed"
              onClick={() => onToggleAttendance(player.playerId, !player.present)}
              disabled={
                isRefreshing ||
                pendingAttendancePlayerIds.includes(player.playerId) ||
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
                  onUpdatePrizePoolStatus(player.playerId, 'ctpPoolPaid', event.target.checked)
                }
                disabled={
                  isRefreshing ||
                  pendingAttendancePlayerIds.includes(player.playerId) ||
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
                  onUpdatePrizePoolStatus(
                    player.playerId,
                    'longestPuttPoolPaid',
                    event.target.checked
                  )
                }
                disabled={
                  isRefreshing ||
                  pendingAttendancePlayerIds.includes(player.playerId) ||
                  !player.present
                }
              />
              LPM
            </label>
            {player.present && matchedPlayerIds.has(player.playerId) ? (
              <span className="rounded bg-surface-sunken px-2 py-1 text-[11px] font-semibold text-text-secondary">
                Paired
              </span>
            ) : player.present && locked ? (
              <span className="rounded bg-surface-sunken px-2 py-1 text-[11px] font-semibold text-text-secondary">
                Attendance only
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}

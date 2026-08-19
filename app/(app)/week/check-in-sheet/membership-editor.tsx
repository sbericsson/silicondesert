'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CheckInSheetData } from '@/lib/checkin-sheet'

interface MembershipEditorProps {
  rows: CheckInSheetData['rows']
}

/**
 * Screen-only editor for "is this player a club member".
 *
 * It lives next to the sheet rather than in the roster because a wrong guest
 * flag is noticed here, while looking at the printed column. Membership is a
 * single flag: Oakwood and Ironwood members carry the same entitlement, so
 * there is nothing venue-specific to choose.
 */
export function MembershipEditor({ rows }: MembershipEditorProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const guests = useMemo(() => rows.filter((row) => !row.isMember), [rows])

  async function toggleMembership(playerId: string, courseMember: boolean) {
    setPendingId(playerId)
    setError(null)

    try {
      const response = await fetch(`/api/players/${playerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseMember })
      })

      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error ?? 'Unable to update membership')
      }

      router.refresh()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to update membership')
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="cis-screen-only mx-4 mt-4 rounded-lg border border-surface-border bg-surface-elevated xl:mx-6">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-condensed text-sm font-bold uppercase tracking-widest text-text-primary">
          Club membership &middot; {guests.length} printing as guests
        </span>
        <span className="text-sm text-text-secondary">{open ? 'Hide' : 'Edit'}</span>
      </button>

      {open ? (
        <div className="border-t border-surface-border px-4 py-3">
          <p className="mb-3 text-xs text-text-secondary">
            Ticked players are members and print an empty Mem? box. Everyone else prints a
            blank cell and owes a guest fee.
          </p>
          {error ? <p className="mb-3 text-xs text-danger-text">{error}</p> : null}
          <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => (
              <label
                key={row.playerId}
                className="flex items-center gap-2 py-1 text-sm text-text-primary"
              >
                <input
                  type="checkbox"
                  checked={row.isMember}
                  disabled={pendingId === row.playerId}
                  onChange={(event) => toggleMembership(row.playerId, event.target.checked)}
                  className="h-4 w-4"
                />
                <span className={row.isMember ? '' : 'font-semibold'}>{row.name}</span>
                {!row.isMember ? (
                  <span className="font-condensed text-[10px] font-bold uppercase tracking-widest text-warning-text">
                    Guest
                  </span>
                ) : null}
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

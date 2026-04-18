import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getApiSession, unauthorizedResponse } from '@/lib/api-auth'
import { writeAuditLog } from '@/lib/audit'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const body = await request.json()
  const playerId = typeof body.playerId === 'string' ? body.playerId : null
  const present = typeof body.present === 'boolean' ? body.present : undefined
  const ctpPoolPaid = typeof body.ctpPoolPaid === 'boolean' ? body.ctpPoolPaid : undefined
  const longestPuttPoolPaid =
    typeof body.longestPuttPoolPaid === 'boolean' ? body.longestPuttPoolPaid : undefined

  if (
    !playerId ||
    (present === undefined && ctpPoolPaid === undefined && longestPuttPoolPaid === undefined)
  ) {
    return NextResponse.json(
      {
        error:
          'playerId and at least one of present, ctpPoolPaid, or longestPuttPoolPaid are required'
      },
      { status: 400 }
    )
  }

  const week = await prisma.week.findUnique({
    where: { id: params.id },
    include: {
      season: {
        select: {
          archivedAt: true
        }
      }
    }
  })

  if (!week) {
    return NextResponse.json({ error: 'Week not found' }, { status: 404 })
  }

  if (week.season.archivedAt) {
    return NextResponse.json({ error: 'Archived seasons cannot be edited' }, { status: 409 })
  }

  if (week.completedAt) {
    return NextResponse.json({ error: 'Closed weeks cannot be edited' }, { status: 409 })
  }

  if (present === false) {
    const activeMatch = await prisma.match.findFirst({
      where: {
        weekId: params.id,
        OR: [{ player1Id: playerId }, { player2Id: playerId }]
      },
      select: { id: true }
    })

    if (activeMatch) {
      return NextResponse.json(
        { error: 'This player is already in a pairing. Remove the match before un-checking them.' },
        { status: 409 }
      )
    }
  }

  try {
    const attendance = await prisma.$transaction(async (tx) => {
      const existing = await tx.attendance.findUnique({
        where: {
          weekId_playerId: {
            weekId: params.id,
            playerId
          }
        }
      })

      if (!existing && present === undefined) {
        throw new Error('Check in the player before marking prize-pool status')
      }

      if (existing && present === undefined && !existing.present) {
        throw new Error('Only checked-in players can be marked as paid into the prize pools')
      }

      const nextPresent = present ?? existing?.present ?? false
      const nextCtpPoolPaid = nextPresent ? (ctpPoolPaid ?? existing?.ctpPoolPaid ?? false) : false
      const nextLongestPuttPoolPaid = nextPresent
        ? (longestPuttPoolPaid ?? existing?.longestPuttPoolPaid ?? false)
        : false

      const record = existing
        ? await tx.attendance.update({
            where: {
              weekId_playerId: {
                weekId: params.id,
                playerId
              }
            },
            data: {
              present: nextPresent,
              ctpPoolPaid: nextCtpPoolPaid,
              longestPuttPoolPaid: nextLongestPuttPoolPaid,
              checkedInAt: nextPresent ? existing.checkedInAt ?? new Date() : null
            }
          })
        : await tx.attendance.create({
            data: {
              weekId: params.id,
              playerId,
              present: nextPresent,
              ctpPoolPaid: nextCtpPoolPaid,
              longestPuttPoolPaid: nextLongestPuttPoolPaid,
              checkedInAt: nextPresent ? new Date() : null
            }
          })

      if (present !== undefined && (existing?.present ?? null) !== nextPresent) {
        await writeAuditLog(tx, {
          weekId: params.id,
          playerId,
          action: 'attendance_toggle',
          field: 'present',
          oldValue: existing ? String(existing.present) : null,
          newValue: String(nextPresent)
        })
      }

      if (ctpPoolPaid !== undefined && (existing?.ctpPoolPaid ?? false) !== nextCtpPoolPaid) {
        await writeAuditLog(tx, {
          weekId: params.id,
          playerId,
          action: 'attendance_prize_pool',
          field: 'ctpPoolPaid',
          oldValue: existing ? String(existing.ctpPoolPaid) : null,
          newValue: String(nextCtpPoolPaid)
        })
      }

      if (
        longestPuttPoolPaid !== undefined &&
        (existing?.longestPuttPoolPaid ?? false) !== nextLongestPuttPoolPaid
      ) {
        await writeAuditLog(tx, {
          weekId: params.id,
          playerId,
          action: 'attendance_prize_pool',
          field: 'longestPuttPoolPaid',
          oldValue: existing ? String(existing.longestPuttPoolPaid) : null,
          newValue: String(nextLongestPuttPoolPaid)
        })
      }

      return record
    })

    return NextResponse.json(attendance)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update attendance' },
      { status: 400 }
    )
  }
}

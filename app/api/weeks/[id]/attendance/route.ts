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
  const present = typeof body.present === 'boolean' ? body.present : null

  if (!playerId || present === null) {
    return NextResponse.json({ error: 'playerId and present are required' }, { status: 400 })
  }

  const week = await prisma.week.findUnique({
    where: { id: params.id }
  })

  if (!week) {
    return NextResponse.json({ error: 'Week not found' }, { status: 404 })
  }

  if (week.locked) {
    return NextResponse.json({ error: 'Attendance is locked for this week' }, { status: 409 })
  }

  const attendance = await prisma.$transaction(async (tx) => {
    const existing = await tx.attendance.findUnique({
      where: {
        weekId_playerId: {
          weekId: params.id,
          playerId
        }
      }
    })

    const record = existing
      ? await tx.attendance.update({
          where: {
            weekId_playerId: {
              weekId: params.id,
              playerId
            }
          },
          data: {
            present,
            checkedInAt: present ? existing.checkedInAt ?? new Date() : null
          }
        })
      : await tx.attendance.create({
          data: {
            weekId: params.id,
            playerId,
            present,
            checkedInAt: present ? new Date() : null
          }
        })

    await writeAuditLog(tx, {
      weekId: params.id,
      playerId,
      action: 'attendance_toggle',
      field: 'present',
      oldValue: existing ? String(existing.present) : null,
      newValue: String(present)
    })

    return record
  })

  return NextResponse.json(attendance)
}

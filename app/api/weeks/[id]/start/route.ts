import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getApiSession, unauthorizedResponse } from '@/lib/api-auth'
import { writeAuditLog } from '@/lib/audit'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const startedAt = new Date()

  const [existingCurrentWeek, targetWeek] = await Promise.all([
    prisma.week.findFirst({
      where: {
        season: {
          is: {
            archivedAt: null
          }
        },
        completedAt: null,
        OR: [
          {
            startedAt: {
              not: null
            }
          },
          {
            locked: true
          },
          {
            matches: {
              some: {}
            }
          },
          {
            attendance: {
              some: {
                present: true
              }
            }
          }
        ]
      }
    }),
    prisma.week.findUnique({
      where: { id: params.id },
      include: {
        season: {
          select: {
            archivedAt: true
          }
        }
      }
    })
  ])

  if (!targetWeek) {
    return NextResponse.json({ error: 'Week not found' }, { status: 404 })
  }

  if (targetWeek.season.archivedAt) {
    return NextResponse.json({ error: 'Archived seasons cannot be edited' }, { status: 409 })
  }

  if (targetWeek.completedAt) {
    return NextResponse.json({ error: 'Closed weeks cannot be started again' }, { status: 409 })
  }

  if (existingCurrentWeek && existingCurrentWeek.id !== params.id) {
    return NextResponse.json({ error: 'Another week is already active' }, { status: 409 })
  }

  if (targetWeek.startedAt) {
    return NextResponse.json({ error: 'This week is already active' }, { status: 409 })
  }

  const updatedWeek = await prisma.$transaction(async (tx) => {
    const week = await tx.week.update({
      where: { id: params.id },
      data: {
        startedAt
      }
    })

    await writeAuditLog(tx, {
      weekId: params.id,
      action: 'week_start',
      field: 'startedAt',
      oldValue: targetWeek.startedAt?.toISOString() ?? null,
      newValue: startedAt.toISOString()
    })

    return week
  })

  return NextResponse.json(updatedWeek)
}

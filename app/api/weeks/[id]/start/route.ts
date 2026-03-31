import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getApiSession, unauthorizedResponse } from '@/lib/api-auth'
import { getPhoenixDateParts } from '@/lib/phoenix-time'
import { writeAuditLog } from '@/lib/audit'

function phoenixStartOfDay(isoDate: string) {
  return new Date(`${isoDate}T00:00:00-07:00`)
}

function phoenixEndOfDay(isoDate: string) {
  return new Date(`${isoDate}T23:59:59.999-07:00`)
}

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const { isoDate } = getPhoenixDateParts()
  const startOfToday = phoenixStartOfDay(isoDate)
  const endOfToday = phoenixEndOfDay(isoDate)

  const [existingCurrentWeek, targetWeek] = await Promise.all([
    prisma.week.findFirst({
      where: {
        season: {
          is: {
            archivedAt: null
          }
        },
        date: {
          gte: startOfToday,
          lte: endOfToday
        }
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

  if (existingCurrentWeek && existingCurrentWeek.id !== params.id) {
    return NextResponse.json({ error: 'A current week already exists for today' }, { status: 409 })
  }

  const updatedWeek = await prisma.$transaction(async (tx) => {
    const week = await tx.week.update({
      where: { id: params.id },
      data: {
        date: startOfToday
      }
    })

    await writeAuditLog(tx, {
      weekId: params.id,
      action: 'week_start',
      field: 'date',
      oldValue: targetWeek.date.toISOString(),
      newValue: startOfToday.toISOString()
    })

    return week
  })

  return NextResponse.json(updatedWeek)
}

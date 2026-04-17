import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getApiSession, unauthorizedResponse } from '@/lib/api-auth'
import { writeAuditLog } from '@/lib/audit'
import { revalidateWeekPages } from '@/lib/revalidate-week-pages'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const week = await prisma.week.findUnique({
    where: { id: params.id },
    include: {
      season: {
        select: {
          archivedAt: true
        }
      },
      matches: {
        select: {
          id: true,
          matchPlayLeadBy: true
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
    return NextResponse.json({ error: 'Week is already closed' }, { status: 409 })
  }

  if (!week.locked) {
    return NextResponse.json({ error: 'Lock pairings before closing the week' }, { status: 409 })
  }

  if (week.matches.length === 0) {
    return NextResponse.json({ error: 'Enter pairings before closing the week' }, { status: 409 })
  }

  if (week.matches.some((match) => match.matchPlayLeadBy === null)) {
    return NextResponse.json(
      { error: 'All match scores must be entered before closing the week' },
      { status: 409 }
    )
  }

  const now = new Date()

  const updatedWeek = await prisma.$transaction(async (tx) => {
    const nextWeek = await tx.week.update({
      where: { id: params.id },
      data: {
        startedAt: week.startedAt ?? now,
        completedAt: now
      }
    })

    await writeAuditLog(tx, {
      weekId: params.id,
      action: 'week_close',
      field: 'completedAt',
      oldValue: null,
      newValue: now.toISOString()
    })

    return nextWeek
  })

  revalidateWeekPages(params.id)

  return NextResponse.json(updatedWeek)
}

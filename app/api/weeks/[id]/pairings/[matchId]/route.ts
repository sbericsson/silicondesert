import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getApiSession, unauthorizedResponse } from '@/lib/api-auth'
import { writeAuditLog } from '@/lib/audit'

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; matchId: string } }
) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const match = await prisma.match.findFirst({
    where: {
      id: params.matchId,
      weekId: params.id
    },
    include: {
      week: {
        include: {
          season: {
            select: {
              archivedAt: true
            }
          }
        }
      },
      holeScores: {
        select: { id: true }
      }
    }
  })

  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  }

  if (match.week.season.archivedAt) {
    return NextResponse.json({ error: 'Archived seasons cannot be edited' }, { status: 409 })
  }

  if (match.week.completedAt) {
    return NextResponse.json({ error: 'Closed weeks cannot be edited' }, { status: 409 })
  }

  if (match.week.locked || match.locked) {
    return NextResponse.json({ error: 'Locked matches cannot be removed' }, { status: 409 })
  }

  if (match.holeScores.length > 0) {
    return NextResponse.json({ error: 'Matches with saved scores cannot be removed' }, { status: 409 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.match.delete({
      where: { id: params.matchId }
    })

    await writeAuditLog(tx, {
      weekId: params.id,
      matchId: params.matchId,
      action: 'pairings_manual_delete',
      field: 'matchId',
      oldValue: params.matchId,
      newValue: null
    })
  })

  return NextResponse.json({ deleted: true })
}

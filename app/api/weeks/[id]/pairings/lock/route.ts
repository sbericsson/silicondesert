import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getApiSession, unauthorizedResponse } from '@/lib/api-auth'
import { writeAuditLog } from '@/lib/audit'
import { handicapIndex } from '@/lib/handicap'

function getPlayerHandicapSnapshot(player: {
  seedHandicap: number | null
  handicapRecords: Array<{ courseDifferential: number }>
}) {
  return handicapIndex(player.handicapRecords.map((record) => record.courseDifferential)) ?? player.seedHandicap
}

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
      matches: {
        include: {
          player1: {
            include: {
              handicapRecords: {
                orderBy: { date: 'asc' },
                take: 20
              }
            }
          },
          player2: {
            include: {
              handicapRecords: {
                orderBy: { date: 'asc' },
                take: 20
              }
            }
          }
        }
      }
    }
  })

  if (!week) {
    return NextResponse.json({ error: 'Week not found' }, { status: 404 })
  }

  if (week.locked) {
    return NextResponse.json({ error: 'Week is already locked' }, { status: 409 })
  }

  if (week.matches.length === 0) {
    return NextResponse.json({ error: 'Generate pairings before locking the week' }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.week.update({
      where: { id: params.id },
      data: { locked: true }
    })

    for (const match of week.matches) {
      await tx.match.update({
        where: { id: match.id },
        data: {
          locked: true,
          player1HandicapIndex: getPlayerHandicapSnapshot(match.player1),
          player2HandicapIndex: getPlayerHandicapSnapshot(match.player2)
        }
      })
    }

    await writeAuditLog(tx, {
      weekId: params.id,
      action: 'week_lock',
      field: 'locked',
      oldValue: 'false',
      newValue: 'true'
    })
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(
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
      matches: {
        include: {
          holeScores: {
            select: { id: true }
          }
        }
      }
    }
  })

  if (!week) {
    return NextResponse.json({ error: 'Week not found' }, { status: 404 })
  }

  if (!week.locked) {
    return NextResponse.json({ error: 'Week is not locked' }, { status: 409 })
  }

  if (week.matches.some((match) => match.holeScores.length > 0)) {
    return NextResponse.json(
      { error: 'Weeks with entered scores cannot be unlocked' },
      { status: 409 }
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.week.update({
      where: { id: params.id },
      data: { locked: false }
    })

    await tx.match.updateMany({
      where: { weekId: params.id },
      data: {
        locked: false,
        player1HandicapIndex: null,
        player2HandicapIndex: null
      }
    })

    await writeAuditLog(tx, {
      weekId: params.id,
      action: 'week_unlock',
      field: 'locked',
      oldValue: 'true',
      newValue: 'false'
    })
  })

  return NextResponse.json({ ok: true })
}

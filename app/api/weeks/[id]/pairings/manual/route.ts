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

  const body = await request.json().catch(() => null)
  const player1Id = typeof body?.player1Id === 'string' ? body.player1Id : null
  const player2Id = typeof body?.player2Id === 'string' ? body.player2Id : null

  if (!player1Id || !player2Id || player1Id === player2Id) {
    return NextResponse.json(
      { error: 'Select two different checked-in players for a manual match' },
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
      },
      attendance: {
        where: {
          present: true,
          playerId: {
            in: [player1Id, player2Id]
          }
        },
        select: {
          playerId: true
        }
      },
      matches: {
        select: {
          id: true,
          locked: true,
          player1Id: true,
          player2Id: true
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

  if (week.locked) {
    return NextResponse.json({ error: 'Week is locked' }, { status: 409 })
  }

  if (week.attendance.length !== 2) {
    return NextResponse.json(
      { error: 'Both manual pairing players must be checked in for this week' },
      { status: 400 }
    )
  }

  const pairedPlayerIds = new Set(week.matches.flatMap((match) => [match.player1Id, match.player2Id]))
  if (pairedPlayerIds.has(player1Id) || pairedPlayerIds.has(player2Id)) {
    return NextResponse.json(
      { error: 'One of those players is already assigned to a match. Remove that match first.' },
      { status: 409 }
    )
  }

  const createdMatch = await prisma.$transaction(async (tx) => {
    const match = await tx.match.create({
      data: {
        weekId: params.id,
        player1Id,
        player2Id
      }
    })

    await writeAuditLog(tx, {
      weekId: params.id,
      matchId: match.id,
      action: 'pairings_manual_create',
      field: 'players',
      oldValue: null,
      newValue: `${player1Id}:${player2Id}`
    })

    return match
  })

  return NextResponse.json({ matchId: createdMatch.id })
}

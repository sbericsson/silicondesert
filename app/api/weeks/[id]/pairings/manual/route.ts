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
  const referencePlayerId =
    typeof body?.referencePlayerId === 'string' ? body.referencePlayerId : null
  const requestedPlayerIds = [player1Id, player2Id, referencePlayerId].filter(
    (playerId): playerId is string => Boolean(playerId)
  )
  const isManualLastGroup = referencePlayerId !== null

  if (isManualLastGroup) {
    if (
      !player1Id ||
      !player2Id ||
      !referencePlayerId ||
      new Set(requestedPlayerIds).size !== 3
    ) {
      return NextResponse.json(
        {
          error:
            'Select three different checked-in players to create a manual last group'
        },
        { status: 400 }
      )
    }
  } else if (!player1Id || !player2Id || player1Id === player2Id) {
    return NextResponse.json(
      { error: 'Select two different checked-in players for a manual match' },
      { status: 400 }
    )
  }

  const livePlayerId = player1Id as string
  const anchorPlayerId = player2Id as string
  const referenceMatchPlayerId = referencePlayerId as string | null

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
            in: requestedPlayerIds
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

  if (week.completedAt) {
    return NextResponse.json({ error: 'Closed weeks cannot be edited' }, { status: 409 })
  }

  if (week.locked) {
    return NextResponse.json({ error: 'Week is locked' }, { status: 409 })
  }

  if (week.attendance.length !== requestedPlayerIds.length) {
    return NextResponse.json(
      {
        error: isManualLastGroup
          ? 'All three manual last-group players must be checked in for this week'
          : 'Both manual pairing players must be checked in for this week'
      },
      { status: 400 }
    )
  }

  const pairedPlayerIds = new Set(week.matches.flatMap((match) => [match.player1Id, match.player2Id]))
  if (requestedPlayerIds.some((playerId) => pairedPlayerIds.has(playerId))) {
    return NextResponse.json(
      { error: 'One of those players is already assigned to a match. Remove that match first.' },
      { status: 409 }
    )
  }

  const createdMatches = await prisma.$transaction(async (tx) => {
    if (isManualLastGroup && referenceMatchPlayerId) {
      const liveMatch = await tx.match.create({
        data: {
          weekId: params.id,
          player1Id: livePlayerId,
          player2Id: anchorPlayerId
        }
      })

      const referenceMatch = await tx.match.create({
        data: {
          weekId: params.id,
          player1Id: referenceMatchPlayerId,
          player2Id: anchorPlayerId,
          player2ScorecardOnly: true
        }
      })

      await writeAuditLog(tx, {
        weekId: params.id,
        action: 'pairings_manual_last_group_create',
        field: 'players',
        oldValue: null,
        newValue: JSON.stringify({
          liveMatch: {
            player1Id: livePlayerId,
            player2Id: anchorPlayerId
          },
          referenceMatch: {
            player1Id: referenceMatchPlayerId,
            player2Id: anchorPlayerId,
            player2ScorecardOnly: true
          }
        })
      })

      return [liveMatch, referenceMatch]
    }

    const match = await tx.match.create({
      data: {
        weekId: params.id,
        player1Id: livePlayerId,
        player2Id: anchorPlayerId
      }
    })

    await writeAuditLog(tx, {
      weekId: params.id,
      matchId: match.id,
      action: 'pairings_manual_create',
      field: 'players',
      oldValue: null,
      newValue: `${livePlayerId}:${anchorPlayerId}`
    })

    return [match]
  })

  return NextResponse.json({
    matchId: createdMatches[0]?.id ?? null,
    matchIds: createdMatches.map((match) => match.id),
    matchesCreated: createdMatches.length
  })
}

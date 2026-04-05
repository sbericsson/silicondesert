import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getApiSession, unauthorizedResponse } from '@/lib/api-auth'
import { writeAuditLog } from '@/lib/audit'
import { handicapIndex } from '@/lib/handicap'
import { generatePairings } from '@/lib/matchmaking'

const COMMISSIONER_LAST_PLAYER_NAME = 'Peter Pestalozzi'

function getPlayerPairingHandicap(player: {
  seedHandicap: number | null
  handicapRecords: Array<{ courseDifferential: number }>
}) {
  return handicapIndex(player.handicapRecords.map((record) => record.courseDifferential)) ?? player.seedHandicap ?? 0
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const body = await request.json().catch(() => ({}))
  const requestedPlayerIds = Array.isArray(body?.playerIds)
    ? body.playerIds.filter((playerId: unknown): playerId is string => typeof playerId === 'string')
    : null

  const week = await prisma.week.findUnique({
    where: { id: params.id },
    include: {
      attendance: {
        where: { present: true },
        include: {
          player: {
            include: {
              handicapRecords: {
                orderBy: { date: 'desc' },
                take: 20
              }
            }
          }
        },
        orderBy: { checkedInAt: 'asc' }
      },
      matches: {
        select: {
          id: true,
          locked: true,
          player1Id: true,
          player2Id: true,
          player2ScorecardOnly: true
        }
      },
      season: {
        select: {
          archivedAt: true,
          weeks: {
            where: {
              id: { not: params.id }
            },
            select: { id: true }
          }
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

  if (!week.courseId) {
    return NextResponse.json({ error: 'Select a course before generating pairings' }, { status: 400 })
  }

  if (!week.ctpHoleNumber) {
    return NextResponse.json({ error: 'Select a CTP hole before generating pairings' }, { status: 400 })
  }

  const alreadyPairedPlayerIds = new Set(
    week.matches.flatMap((match) => [match.player1Id, match.player2Id])
  )
  const peterAttendance = week.attendance.find(
    (entry) => entry.player.name === COMMISSIONER_LAST_PLAYER_NAME
  )
  const peterId = peterAttendance?.playerId ?? null
  const requestedPlayerIdSet = requestedPlayerIds ? new Set(requestedPlayerIds) : null
  const peterCurrentGroupMatches =
    peterId && week.matches.length > 0
      ? week.matches.filter((match) => match.player1Id === peterId || match.player2Id === peterId)
      : []
  const peterCurrentGroupPlayerIds = new Set(
    peterCurrentGroupMatches.flatMap((match) => [match.player1Id, match.player2Id])
  )
  const shouldRebuildPeterGroup =
    Boolean(peterId) &&
    peterCurrentGroupMatches.length > 0 &&
    week.attendance.some(
      (entry) =>
        !alreadyPairedPlayerIds.has(entry.playerId) &&
        entry.playerId !== peterId &&
        (!requestedPlayerIdSet || requestedPlayerIdSet.has(entry.playerId))
    )

  const availableAttendance = week.attendance.filter(
    (entry) =>
      ((!alreadyPairedPlayerIds.has(entry.playerId) &&
        (!requestedPlayerIdSet || requestedPlayerIdSet.has(entry.playerId))) ||
        (shouldRebuildPeterGroup && peterCurrentGroupPlayerIds.has(entry.playerId)))
  )

  if (availableAttendance.length < 2) {
    return NextResponse.json(
      {
        error:
          week.matches.length > 0
            ? 'Need at least 2 unmatched checked-in players to generate more pairings'
            : 'Need at least 2 checked-in players'
      },
      { status: 400 }
    )
  }

  const priorWeekIds = week.season.weeks.map((seasonWeek) => seasonWeek.id)
  const priorMatches = priorWeekIds.length
    ? await prisma.match.findMany({
        where: {
          weekId: { in: priorWeekIds }
        },
        select: {
          player1Id: true,
          player2Id: true
        }
      })
    : []

  const pairingInput = availableAttendance.map((entry, index) => ({
    id: entry.player.id,
    name: entry.player.name,
    handicapIndex: getPlayerPairingHandicap(entry.player),
    checkInOrder: index + 1
  }))

  const generated = generatePairings(pairingInput, priorMatches, {
    trailingPlayerId: peterId
  })

  const result = await prisma.$transaction(async (tx) => {
    const createdMatches = []

    if (shouldRebuildPeterGroup && peterCurrentGroupMatches.length > 0) {
      await tx.match.deleteMany({
        where: {
          id: {
            in: peterCurrentGroupMatches.map((match) => match.id)
          }
        }
      })
    }

    for (const match of generated.matches) {
      createdMatches.push(
        await tx.match.create({
          data: {
            weekId: params.id,
            player1Id: match.player1.id,
            player2Id: match.player2.id
          }
        })
      )
    }

    if (generated.threesome) {
      createdMatches.push(
        await tx.match.create({
          data: {
            weekId: params.id,
            player1Id: generated.threesome.matchA.player1.id,
            player2Id: generated.threesome.matchA.player2.id
          }
        })
      )

      createdMatches.push(
        await tx.match.create({
          data: {
            weekId: params.id,
            player1Id: generated.threesome.matchBRef.player.id,
            player2Id: generated.threesome.matchBRef.referencePlayer.id,
            player2ScorecardOnly: true
          }
        })
      )
    }

    await writeAuditLog(tx, {
      weekId: params.id,
      action: 'pairings_generate',
      field: 'matchCount',
      oldValue: String(week.matches.length),
      newValue: String(
        week.matches.length - peterCurrentGroupMatches.length + createdMatches.length
      )
    })

    return createdMatches
  }).catch((error: Error) => {
    return error
  })

  if (result instanceof Error) {
    return NextResponse.json({ error: result.message }, { status: 409 })
  }

  return NextResponse.json({
    matchesCreated: result.length,
    pairingResult: generated
  })
}

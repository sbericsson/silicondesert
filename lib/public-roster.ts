import { prisma } from '@/lib/db'
import { handicapIndex } from '@/lib/handicap'

function getPublicHandicap(player: {
  seedHandicap: number | null
  handicapRecords: Array<{ courseDifferential: number }>
}) {
  if (player.handicapRecords.length === 0 && player.seedHandicap !== null) {
    return {
      kind: 'EST' as const,
      value: player.seedHandicap.toFixed(1)
    }
  }

  if (player.handicapRecords.length === 0) {
    return {
      kind: 'NEW' as const,
      value: null
    }
  }

  const value = handicapIndex(player.handicapRecords.map((record) => record.courseDifferential))
  return {
    kind: 'HCP' as const,
    value: value?.toFixed(1) ?? null
  }
}

export async function getPublicRosterData() {
  if (!process.env.DATABASE_URL) {
    return {
      enabled: false,
      players: []
    }
  }

  const commissioner = await prisma.commissioner.findFirst({
    select: {
      publicRosterEnabled: true
    }
  })

  if (!commissioner?.publicRosterEnabled) {
    return {
      enabled: false,
      players: []
    }
  }

  const players = await prisma.player.findMany({
    where: {
      active: true
    },
    include: {
      handicapRecords: {
        orderBy: { date: 'desc' },
        take: 20
      }
    },
    orderBy: { name: 'asc' }
  })

  return {
    enabled: true,
    players: players.map((player) => ({
      id: player.id,
      name: player.name,
      handicap: getPublicHandicap(player)
    }))
  }
}

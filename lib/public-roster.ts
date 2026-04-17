import { prisma } from '@/lib/db'
import { getPlayerHandicapDisplay } from '@/lib/player-handicap-display'

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
      handicap: getPlayerHandicapDisplay(player)
    }))
  }
}

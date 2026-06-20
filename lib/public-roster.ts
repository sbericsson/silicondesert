import { prisma } from '@/lib/db'
import { HANDICAP_RECORDS_INCLUDE } from '@/lib/handicap-records'
import { getPlayerHandicapDisplay } from '@/lib/player-handicap-display'
import { comparePlayerNamesByLastName } from '@/lib/player-sort'

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
      handicapRecords: HANDICAP_RECORDS_INCLUDE
    }
  })

  return {
    enabled: true,
    players: players
      .sort((a, b) => comparePlayerNamesByLastName(a.name, b.name))
      .map((player) => ({
        id: player.id,
        name: player.name,
        handicap: getPlayerHandicapDisplay(player)
      }))
  }
}

import { prisma } from '@/lib/db'
import { handicapIndex } from '@/lib/handicap'

function getPlayerDisplay(player: {
  seedHandicap: number | null
  handicapRecords: Array<{ courseDifferential: number }>
}) {
  if (player.handicapRecords.length === 0 && player.seedHandicap !== null) {
    return { kind: 'EST' as const, value: player.seedHandicap.toFixed(1) }
  }

  if (player.handicapRecords.length < 3) {
    return { kind: 'PRO' as const, value: null }
  }

  const value = handicapIndex(player.handicapRecords.map((record) => record.courseDifferential))
  return { kind: 'HCP' as const, value: value?.toFixed(1) ?? null }
}

export async function getRosterPageData() {
  if (!process.env.DATABASE_URL) {
    return {
      players: [],
      seasons: []
    }
  }

  const [players, seasons] = await Promise.all([
    prisma.player.findMany({
      include: {
        handicapRecords: {
          orderBy: { date: 'asc' },
          take: 20
        }
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }]
    }),
    prisma.season.findMany({
      include: {
        weeks: {
          orderBy: { date: 'asc' }
        }
      },
      orderBy: { startDate: 'asc' }
    })
  ])

  return {
    players: players.map((player) => ({
      id: player.id,
      name: player.name,
      email: player.email,
      active: player.active,
      handicap: getPlayerDisplay(player)
    })),
    seasons: seasons.map((season) => ({
      id: season.id,
      name: season.name,
      type: season.type,
      weekCount: season.weeks.length,
      startDate: season.startDate.toISOString().slice(0, 10),
      endDate: season.endDate.toISOString().slice(0, 10)
    }))
  }
}

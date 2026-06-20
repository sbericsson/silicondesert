import type { TeeColor } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getPlayerHandicapDisplay } from '@/lib/player-handicap-display'
import { getPlayerSeasonTeeColor } from '@/lib/course-tee'
import { getPublicStandingsData } from '@/lib/public-standings'

const TEE_COLOR_LABELS: Record<TeeColor, string> = {
  blue: 'Blue',
  silver: 'Silver',
  white: 'White',
  yellow: 'Yellow'
}

export async function getPublicPlayerDetail(playerId: string) {
  if (!process.env.DATABASE_URL) {
    return null
  }

  const commissioner = await prisma.commissioner.findFirst({
    select: { publicRosterEnabled: true }
  })

  if (!commissioner?.publicRosterEnabled) {
    return null
  }

  const player = await prisma.player.findFirst({
    where: { id: playerId, active: true },
    include: {
      handicapRecords: {
        where: { countsForHandicap: true },
        orderBy: { date: 'desc' },
        take: 20,
        include: {
          week: { include: { course: { select: { name: true } } } }
        }
      },
      seasonTeeChoices: true
    }
  })

  if (!player) {
    return null
  }

  // Tees they play from: resolve the current (latest non-archived) season,
  // matching the season selection used by the public standings page.
  const seasons = await prisma.season.findMany({
    where: { archivedAt: null },
    orderBy: [{ startDate: 'asc' }]
  })
  const currentSeason = seasons.at(-1) ?? null
  const teeColor = currentSeason
    ? getPlayerSeasonTeeColor(
        player.seasonTeeChoices,
        currentSeason.id,
        player.gender,
        player.defaultTeeColor
      )
    : player.defaultTeeColor ?? null

  const handicap = getPlayerHandicapDisplay(player)

  const rounds = player.handicapRecords.map((record) => ({
    date: record.date.toISOString().slice(0, 10),
    courseName: record.week?.course?.name ?? null,
    isImported: record.isImported,
    grossScore: record.grossScore,
    adjustedGrossScore: record.adjustedGrossScore,
    courseRating: record.courseRating,
    slopeRating: record.slopeRating,
    coursePar: record.coursePar,
    courseDifferential: record.courseDifferential,
    usedInIndex: record.usedInIndex
  }))

  // Season points: reuse the public standings calculation and find this player.
  const standings = await getPublicStandingsData()
  const standingRow = standings.standings.find((row) => row.playerId === player.id)

  return {
    id: player.id,
    name: player.name,
    handicap,
    email: player.email,
    cellPhone: player.cellPhone,
    teeColorLabel: teeColor ? TEE_COLOR_LABELS[teeColor] : null,
    seasonPoints: {
      multiSeason: standings.multiSeason,
      overall: standingRow?.overallPoints ?? 0,
      spring: standingRow?.springPoints ?? 0,
      summer: standingRow?.summerPoints ?? 0
    },
    rounds
  }
}

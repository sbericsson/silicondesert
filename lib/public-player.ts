import type { TeeColor } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getPlayerHandicapDisplay } from '@/lib/player-handicap-display'
import { getPlayerSeasonTeeColor } from '@/lib/course-tee'
import { getPublicStandingsData } from '@/lib/public-standings'
import { buildPublicWeekMatchPath } from '@/lib/public-week-url'

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

  // Resolve a link to the hole-by-hole match scorecard for each league round.
  // A round is only clickable when the week's results are public (every match
  // scored, matching getPublicMatchHoleData's resultsVisible guard) and the
  // player actually has a match that week.
  const leagueWeekIds = [
    ...new Set(
      player.handicapRecords
        .map((record) => record.weekId)
        .filter((weekId): weekId is string => weekId !== null)
    )
  ]
  const matchHrefByWeek = new Map<string, string>()
  const weekDateById = new Map(
    player.handicapRecords.flatMap((record) =>
      record.weekId && record.week ? [[record.weekId, record.week.date] as const] : []
    )
  )
  if (leagueWeekIds.length > 0) {
    const matches = await prisma.match.findMany({
      where: { weekId: { in: leagueWeekIds } },
      select: {
        id: true,
        weekId: true,
        player1Id: true,
        player2Id: true,
        matchPlayLeadBy: true
      }
    })
    const matchesByWeek = new Map<string, typeof matches>()
    for (const match of matches) {
      const list = matchesByWeek.get(match.weekId) ?? []
      list.push(match)
      matchesByWeek.set(match.weekId, list)
    }
    for (const [weekId, weekMatches] of matchesByWeek) {
      const resultsVisible =
        weekMatches.length > 0 &&
        weekMatches.every((match) => match.matchPlayLeadBy !== null)
      const playerMatch = weekMatches.find(
        (match) => match.player1Id === player.id || match.player2Id === player.id
      )
      const weekDate = weekDateById.get(weekId)
      if (resultsVisible && playerMatch && weekDate) {
        matchHrefByWeek.set(weekId, buildPublicWeekMatchPath(weekDate, playerMatch.id))
      }
    }
  }

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
    usedInIndex: record.usedInIndex,
    matchHref: record.weekId ? matchHrefByWeek.get(record.weekId) ?? null : null
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

import { prisma } from '@/lib/db'
import { getPlayerHandicapInlineLabel } from '@/lib/player-handicap-display'
import { comparePlayerNamesByLastName } from '@/lib/player-sort'
import { resolveSeasonPair } from '@/lib/seasons'
import { accumulatePoints, mergeSeasonTotals, type StandingTotals } from '@/lib/standings-engine'
import { formatPhoenixTimestamp } from '@/lib/phoenix-time'
import { HANDICAP_RECORDS_INCLUDE } from '@/lib/handicap-records'
import { getPlayerHandicapIndexValue } from '@/lib/playing-handicap'

type PublicStandingRow = {
  playerId: string
  name: string
  currentIndexDisplay: string
  springPoints: number
  summerPoints: number
  overallPoints: number
  attendancePoints: number
  strokePoints: number
  matchPlayPoints: number
  ctpWins: number
  lpWins: number
}

type ComparisonStandingRow = StandingTotals & {
  handicapIndexValue: number
  weeksScored: number
  overallPoints: number | null
}

const weekInclude = {
  attendance: {
    select: { playerId: true, present: true }
  },
  handicapRecords: {
    select: { playerId: true, grossScore: true }
  },
  matches: true
} as const

const playerInclude = {
  handicapRecords: HANDICAP_RECORDS_INCLUDE
} as const

function hasAnyPoints(row: {
  attendancePoints: number
  strokePoints: number
  matchPlayPoints: number
  ctpWins: number
  lpWins: number
  totalPoints?: number
  overallPoints?: number | null
}) {
  return (
    (row.totalPoints ?? row.overallPoints ?? 0) > 0 ||
    row.attendancePoints > 0 ||
    row.strokePoints > 0 ||
    row.matchPlayPoints > 0 ||
    row.ctpWins > 0 ||
    row.lpWins > 0
  )
}

// Public players' standings: Spring / Summer / Overall columns once both seasons exist,
// otherwise a single-season table. Scoped to the current (non-archived) season pair.
export async function getPublicStandingsData() {
  if (!process.env.DATABASE_URL) {
    return {
      multiSeason: false,
      seasonLabel: null,
      standings: [] as PublicStandingRow[],
      lastUpdatedLabel: formatPhoenixTimestamp(new Date())
    }
  }

  const seasons = await prisma.season.findMany({
    where: { archivedAt: null },
    orderBy: [{ startDate: 'asc' }]
  })

  const { spring, summer } = resolveSeasonPair(seasons)
  const multiSeasonCandidate = Boolean(spring && summer)
  const selectedSingle = seasons.at(-1) ?? null
  const seasonIds = multiSeasonCandidate ? [spring!.id, summer!.id] : selectedSingle ? [selectedSingle.id] : []

  if (seasonIds.length === 0) {
    return {
      multiSeason: false,
      seasonLabel: null,
      standings: [] as PublicStandingRow[],
      lastUpdatedLabel: formatPhoenixTimestamp(new Date())
    }
  }

  const [weeks, players] = await Promise.all([
    prisma.week.findMany({
      where: { seasonId: { in: seasonIds } },
      include: weekInclude,
      orderBy: { date: 'asc' }
    }),
    prisma.player.findMany({ include: playerInclude, orderBy: { name: 'asc' } })
  ])

  const playerInputs = players.map((player) => ({
    id: player.id,
    name: player.name,
    currentIndexDisplay: getPlayerHandicapInlineLabel(player)
  }))
  const activeById = new Map(players.map((player) => [player.id, player.active]))

  const multiSeason =
    multiSeasonCandidate && weeks.some((w) => w.seasonId === summer!.id && w.completedAt != null)

  const springTotals = multiSeason
    ? accumulatePoints(weeks.filter((week) => week.seasonId === spring!.id), playerInputs)
    : null
  const summerTotals = multiSeason
    ? accumulatePoints(weeks.filter((week) => week.seasonId === summer!.id), playerInputs)
    : null
  const overallTotals = multiSeason
    ? mergeSeasonTotals(springTotals!, summerTotals!)
    : accumulatePoints(weeks, playerInputs)

  const standings = playerInputs
    .map((player) => {
      const overall = overallTotals.get(player.id)!
      return {
        playerId: player.id,
        name: player.name,
        currentIndexDisplay: player.currentIndexDisplay,
        springPoints: springTotals?.get(player.id)?.totalPoints ?? 0,
        summerPoints: summerTotals?.get(player.id)?.totalPoints ?? 0,
        overallPoints: overall.totalPoints,
        attendancePoints: overall.attendancePoints,
        strokePoints: overall.strokePoints,
        matchPlayPoints: overall.matchPlayPoints,
        ctpWins: overall.ctpWins,
        lpWins: overall.lpWins
      }
    })
    .filter((row) => activeById.get(row.playerId) || hasAnyPoints(row))
    .sort((a, b) => {
      if (b.overallPoints !== a.overallPoints) {
        return b.overallPoints - a.overallPoints
      }
      return comparePlayerNamesByLastName(a.name, b.name)
    })

  return {
    multiSeason,
    seasonLabel: multiSeason
      ? `${spring!.name} + ${summer!.name}`
      : multiSeasonCandidate
        ? (spring?.name ?? null)
        : selectedSingle?.name ?? null,
    standings,
    lastUpdatedLabel: formatPhoenixTimestamp(new Date())
  }
}

// Single-season standings for the printable week results page.
export async function getSeasonStandingsForPrint(seasonId: string) {
  if (!process.env.DATABASE_URL) {
    return { seasonLabel: null, standings: [] as StandingTotals[] }
  }

  const [season, weeks, players] = await Promise.all([
    prisma.season.findUnique({ where: { id: seasonId }, select: { name: true } }),
    prisma.week.findMany({
      where: { seasonId },
      include: weekInclude,
      orderBy: { date: 'asc' }
    }),
    prisma.player.findMany({ include: playerInclude, orderBy: { name: 'asc' } })
  ])

  const activeById = new Map(players.map((player) => [player.id, player.active]))
  const totals = accumulatePoints(
    weeks,
    players.map((player) => ({
      id: player.id,
      name: player.name,
      currentIndexDisplay: getPlayerHandicapInlineLabel(player)
    }))
  )

  const standings = [...totals.values()]
    .filter((row) => activeById.get(row.playerId) || hasAnyPoints(row))
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints
      }
      return comparePlayerNamesByLastName(a.name, b.name)
    })

  return { seasonLabel: season?.name ?? null, standings }
}

export async function getComparisonStandings(weekId: string) {
  if (!process.env.DATABASE_URL) {
    return { isSummer: false, seasonLabel: null, standings: [] as ComparisonStandingRow[] }
  }

  const week = await prisma.week.findUnique({
    where: { id: weekId },
    select: {
      seasonId: true,
      season: {
        select: { name: true }
      }
    }
  })

  if (!week) {
    return { isSummer: false, seasonLabel: null, standings: [] as ComparisonStandingRow[] }
  }

  const seasons = await prisma.season.findMany({
    where: { archivedAt: null },
    orderBy: [{ startDate: 'asc' }]
  })
  const { spring, summer } = resolveSeasonPair(seasons)
  const isSummerWeek = summer != null && summer.id === week.seasonId
  const seasonIds = isSummerWeek && spring ? [spring.id, week.seasonId] : [week.seasonId]

  const [weeks, players] = await Promise.all([
    prisma.week.findMany({
      where: { seasonId: { in: seasonIds } },
      include: weekInclude,
      orderBy: { date: 'asc' }
    }),
    prisma.player.findMany({ include: playerInclude, orderBy: { name: 'asc' } })
  ])

  const playerInputs = players.map((player) => ({
    id: player.id,
    name: player.name,
    currentIndexDisplay: getPlayerHandicapInlineLabel(player),
    handicapIndexValue: getPlayerHandicapIndexValue(player)
  }))
  const activeById = new Map(players.map((player) => [player.id, player.active]))
  const seasonWeeks = weeks.filter((seasonWeek) => seasonWeek.seasonId === week.seasonId)
  const seasonTotals = accumulatePoints(seasonWeeks, playerInputs)
  const springTotals =
    isSummerWeek && spring
      ? accumulatePoints(weeks.filter((seasonWeek) => seasonWeek.seasonId === spring.id), playerInputs)
      : null
  const overallTotals = springTotals ? mergeSeasonTotals(springTotals, seasonTotals) : null
  const weeksScoredByPlayerId = new Map<string, number>()

  for (const seasonWeek of seasonWeeks) {
    const scoredPlayerIds = new Set(
      seasonWeek.handicapRecords
        .filter((record) => record.grossScore !== null)
        .map((record) => record.playerId)
    )

    for (const playerId of scoredPlayerIds) {
      weeksScoredByPlayerId.set(playerId, (weeksScoredByPlayerId.get(playerId) ?? 0) + 1)
    }
  }

  const standings = playerInputs
    .map((player) => {
      const totals = seasonTotals.get(player.id)!

      return {
        playerId: player.id,
        name: player.name,
        currentIndexDisplay: player.currentIndexDisplay,
        handicapIndexValue: player.handicapIndexValue,
        weeksScored: weeksScoredByPlayerId.get(player.id) ?? 0,
        totalPoints: totals.totalPoints,
        attendancePoints: totals.attendancePoints,
        strokePoints: totals.strokePoints,
        matchPlayPoints: totals.matchPlayPoints,
        ctpWins: totals.ctpWins,
        lpWins: totals.lpWins,
        overallPoints: overallTotals?.get(player.id)?.totalPoints ?? null
      }
    })
    .filter((row) => activeById.get(row.playerId) || hasAnyPoints(row))
    .sort((a, b) =>
      b.totalPoints - a.totalPoints ||
      a.handicapIndexValue - b.handicapIndexValue ||
      b.weeksScored - a.weeksScored ||
      comparePlayerNamesByLastName(a.name, b.name)
    )

  return {
    isSummer: overallTotals != null,
    seasonLabel: week.season.name,
    standings
  }
}

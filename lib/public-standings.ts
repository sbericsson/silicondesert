import { prisma } from '@/lib/db'
import { getPlayerHandicapInlineLabel } from '@/lib/player-handicap-display'
import { comparePlayerNamesByLastName } from '@/lib/player-sort'
import { resolveSeasonPair } from '@/lib/seasons'
import { accumulatePoints, mergeSeasonTotals } from '@/lib/standings-engine'
import { formatPhoenixTimestamp } from '@/lib/phoenix-time'
import { HANDICAP_RECORDS_INCLUDE } from '@/lib/handicap-records'
import { getPlayerHandicapIndexValue } from '@/lib/playing-handicap'

type PublicStandingRow = {
  playerId: string
  name: string
  currentIndexDisplay: string
  currentSeasonPoints: number
  springPoints: number
  summerPoints: number
  overallPoints: number
  attendancePoints: number
  strokePoints: number
  matchPlayPoints: number
  ctpWins: number
  lpWins: number
}

type ComparisonStandingRow = PublicStandingRow & {
  handicapIndexValue: number
  weeksScored: number
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
  const currentSeasonTotals = multiSeason ? summerTotals : overallTotals

  const standings = playerInputs
    .map((player) => {
      const overall = overallTotals.get(player.id)!
      return {
        playerId: player.id,
        name: player.name,
        currentIndexDisplay: player.currentIndexDisplay,
        currentSeasonPoints: currentSeasonTotals?.get(player.id)?.totalPoints ?? overall.totalPoints,
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

export async function getComparisonStandings(weekId: string) {
  if (!process.env.DATABASE_URL) {
    return {
      multiSeason: false,
      seasonLabel: null,
      standings: [] as ComparisonStandingRow[]
    }
  }

  const [targetWeek, seasons] = await Promise.all([
    prisma.week.findUnique({
      where: { id: weekId },
      select: { seasonId: true }
    }),
    prisma.season.findMany({
      where: { archivedAt: null },
      orderBy: [{ startDate: 'asc' }]
    })
  ])

  if (!targetWeek) {
    return {
      multiSeason: false,
      seasonLabel: null,
      standings: [] as ComparisonStandingRow[]
    }
  }

  const { spring, summer } = resolveSeasonPair(seasons)
  const multiSeasonCandidate = Boolean(spring && summer)
  const selectedSingle = seasons.find((season) => season.id === targetWeek.seasonId) ?? seasons.at(-1) ?? null
  const seasonIds = multiSeasonCandidate ? [spring!.id, summer!.id] : selectedSingle ? [selectedSingle.id] : []

  if (seasonIds.length === 0) {
    return {
      multiSeason: false,
      seasonLabel: null,
      standings: [] as ComparisonStandingRow[]
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
    currentIndexDisplay: getPlayerHandicapInlineLabel(player),
    handicapIndexValue: getPlayerHandicapIndexValue(player)
  }))
  const activeById = new Map(players.map((player) => [player.id, player.active]))
  const multiSeason =
    multiSeasonCandidate && weeks.some((week) => week.seasonId === summer!.id && week.completedAt != null)

  const springTotals = multiSeason
    ? accumulatePoints(weeks.filter((week) => week.seasonId === spring!.id), playerInputs)
    : null
  const summerTotals = multiSeason
    ? accumulatePoints(weeks.filter((week) => week.seasonId === summer!.id), playerInputs)
    : null
  const overallTotals = multiSeason
    ? mergeSeasonTotals(springTotals!, summerTotals!)
    : accumulatePoints(weeks, playerInputs)
  const targetSeasonTotals =
    multiSeason && targetWeek.seasonId === spring!.id
      ? springTotals
      : multiSeason && targetWeek.seasonId === summer!.id
        ? summerTotals
        : overallTotals
  const seasonWeeks = weeks.filter((week) => week.seasonId === targetWeek.seasonId)
  const weeksScoredByPlayerId = new Map<string, number>()

  for (const week of seasonWeeks) {
    const scoredPlayerIds = new Set(
      week.handicapRecords
        .filter((record) => record.grossScore !== null)
        .map((record) => record.playerId)
    )

    for (const playerId of scoredPlayerIds) {
      weeksScoredByPlayerId.set(playerId, (weeksScoredByPlayerId.get(playerId) ?? 0) + 1)
    }
  }

  const standings = playerInputs
    .map((player) => {
      const overall = overallTotals.get(player.id)!
      return {
        playerId: player.id,
        name: player.name,
        currentIndexDisplay: player.currentIndexDisplay,
        currentSeasonPoints: targetSeasonTotals?.get(player.id)?.totalPoints ?? overall.totalPoints,
        springPoints: springTotals?.get(player.id)?.totalPoints ?? 0,
        summerPoints: summerTotals?.get(player.id)?.totalPoints ?? 0,
        overallPoints: overall.totalPoints,
        attendancePoints: overall.attendancePoints,
        strokePoints: overall.strokePoints,
        matchPlayPoints: overall.matchPlayPoints,
        ctpWins: overall.ctpWins,
        lpWins: overall.lpWins,
        handicapIndexValue: player.handicapIndexValue,
        weeksScored: weeksScoredByPlayerId.get(player.id) ?? 0
      }
    })
    .filter((row) => activeById.get(row.playerId) || hasAnyPoints(row))
    .sort(
      (a, b) =>
        b.currentSeasonPoints - a.currentSeasonPoints ||
        a.handicapIndexValue - b.handicapIndexValue ||
        b.weeksScored - a.weeksScored ||
        comparePlayerNamesByLastName(a.name, b.name)
    )

  return {
    multiSeason,
    seasonLabel: multiSeason
      ? `${spring!.name} + ${summer!.name}`
      : multiSeasonCandidate
        ? (spring?.name ?? null)
        : selectedSingle?.name ?? null,
    standings
  }
}

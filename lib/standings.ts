import { prisma } from '@/lib/db'
import { getPlayerHandicapInlineLabel } from '@/lib/player-handicap-display'
import { comparePlayerNamesByLastName } from '@/lib/player-sort'
import { resolveSeasonPair } from '@/lib/seasons'
import { accumulatePoints } from '@/lib/standings-engine'
import { getCurrentWeekRecord } from '@/lib/week'

type StandingRow = {
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

const EMPTY = {
  multiSeason: false as boolean,
  seasonLabel: null as string | null,
  standings: [] as StandingRow[]
}

export async function getStandingsPageData() {
  if (!process.env.DATABASE_URL) {
    return EMPTY
  }

  const [currentWeek, seasons] = await Promise.all([
    getCurrentWeekRecord(),
    prisma.season.findMany({
      where: { archivedAt: null },
      orderBy: [{ startDate: 'asc' }]
    })
  ])

  if (seasons.length === 0) {
    return EMPTY
  }

  const { spring, summer } = resolveSeasonPair(seasons)
  const multiSeasonCandidate = Boolean(spring && summer)

  const selectedSingle =
    (currentWeek?.seasonId ? seasons.find((season) => season.id === currentWeek.seasonId) : null) ??
    seasons.at(-1) ??
    null

  const seasonIds = multiSeasonCandidate ? [spring!.id, summer!.id] : selectedSingle ? [selectedSingle.id] : []

  if (seasonIds.length === 0) {
    return EMPTY
  }

  const [weeks, players] = await Promise.all([
    prisma.week.findMany({
      where: { seasonId: { in: seasonIds } },
      include: {
        attendance: true,
        handicapRecords: {
          select: { playerId: true, grossScore: true }
        },
        matches: true
      },
      orderBy: { date: 'asc' }
    }),
    prisma.player.findMany({
      where: { active: true },
      include: {
        handicapRecords: {
          where: { countsForHandicap: true },
          orderBy: { date: 'desc' },
          take: 20
        }
      },
      orderBy: { name: 'asc' }
    })
  ])

  const playerInputs = players.map((player) => ({
    id: player.id,
    name: player.name,
    currentIndexDisplay: getPlayerHandicapInlineLabel(player)
  }))

  const multiSeason =
    multiSeasonCandidate && weeks.some((w) => w.seasonId === summer!.id && w.completedAt != null)

  const overallTotals = accumulatePoints(weeks, playerInputs)
  const springTotals = multiSeason
    ? accumulatePoints(
        weeks.filter((week) => week.seasonId === spring!.id),
        playerInputs
      )
    : null
  const summerTotals = multiSeason
    ? accumulatePoints(
        weeks.filter((week) => week.seasonId === summer!.id),
        playerInputs
      )
    : null

  const standings: StandingRow[] = playerInputs
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
    .sort((a, b) => {
      if (b.overallPoints !== a.overallPoints) {
        return b.overallPoints - a.overallPoints
      }
      return comparePlayerNamesByLastName(a.name, b.name)
    })

  return {
    multiSeason,
    seasonLabel: multiSeason ? `${spring!.name} + ${summer!.name}` : selectedSingle?.name ?? null,
    standings
  }
}

import type { SeasonType } from '@prisma/client'
import { prisma } from '@/lib/db'
import { HANDICAP_RECORDS_INCLUDE } from '@/lib/handicap-records'
import { getPlayerHandicapInlineLabel } from '@/lib/player-handicap-display'
import { comparePlayerNamesByLastName } from '@/lib/player-sort'
import { findPrecedingSpringSeason } from '@/lib/seasons'
import { accumulatePoints } from '@/lib/standings-engine'

export type PositioningBasis = 'spring' | 'summer' | 'overall'

export const POSITIONING_BASIS_LABEL: Record<PositioningBasis, string> = {
  spring: 'Spring',
  summer: 'Summer',
  overall: 'Overall'
}

// Determines whether a week is a positioning round (and the standings it ranks by),
// purely from its position in the season schedule:
//   - last week of Spring        → rank by Spring points
//   - 2nd-to-last week of Summer  → rank by Summer points
//   - last week of Summer         → rank by Overall (Spring + Summer) points
export function getPositioningBasis(args: {
  seasonType: SeasonType
  weekNumber: number
  seasonWeekNumbers: number[]
}): PositioningBasis | null {
  const { seasonType, weekNumber, seasonWeekNumbers } = args
  if (seasonWeekNumbers.length === 0) {
    return null
  }

  const sorted = [...seasonWeekNumbers].sort((a, b) => a - b)
  const last = sorted[sorted.length - 1]
  const secondToLast = sorted.length >= 2 ? sorted[sorted.length - 2] : null

  if (seasonType === 'spring') {
    return weekNumber === last ? 'spring' : null
  }

  // summer
  if (weekNumber === last) {
    return 'overall'
  }
  if (secondToLast !== null && weekNumber === secondToLast) {
    return 'summer'
  }
  return null
}

// Ranks every active player (1 = best) by the standings that the positioning round uses,
// computed from completed weeks *before* the current week.
export async function getPositioningRanks(
  basis: PositioningBasis,
  currentWeek: { id: string; seasonId: string }
): Promise<Map<string, number>> {
  const currentSeason = await prisma.season.findUnique({
    where: { id: currentWeek.seasonId },
    select: { id: true, type: true, startDate: true }
  })

  if (!currentSeason) {
    return new Map()
  }

  const seasonIds = [currentSeason.id]

  if (basis === 'overall' && currentSeason.type === 'summer') {
    const seasons = await prisma.season.findMany({
      where: { archivedAt: null },
      select: { id: true, type: true, startDate: true, archivedAt: true }
    })
    const precedingSpring = findPrecedingSpringSeason(seasons, currentSeason.startDate)
    if (precedingSpring) {
      seasonIds.push(precedingSpring.id)
    }
  }

  const [weeks, players] = await Promise.all([
    prisma.week.findMany({
      where: { seasonId: { in: seasonIds }, id: { not: currentWeek.id } },
      include: {
        attendance: { select: { playerId: true, present: true } },
        handicapRecords: { select: { playerId: true, grossScore: true } },
        matches: true
      },
      orderBy: { date: 'asc' }
    }),
    prisma.player.findMany({
      where: { active: true },
      include: {
        handicapRecords: HANDICAP_RECORDS_INCLUDE
      },
      orderBy: { name: 'asc' }
    })
  ])

  const totals = accumulatePoints(
    weeks,
    players.map((player) => ({
      id: player.id,
      name: player.name,
      currentIndexDisplay: getPlayerHandicapInlineLabel(player)
    }))
  )

  const ranked = [...totals.values()].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints
    }
    return comparePlayerNamesByLastName(a.name, b.name)
  })

  const ranks = new Map<string, number>()
  ranked.forEach((row, index) => {
    ranks.set(row.playerId, index + 1)
  })
  return ranks
}

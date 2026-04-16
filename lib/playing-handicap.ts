import type { HandicapMode } from '@prisma/client'
import { courseHandicap, handicapIndex } from '@/lib/handicap'

type TeeData = {
  nineHoleSlope: number
  nineHoleRating: number
  nineHolePar: number
}

export function getPlayerHandicapIndexValue(player: {
  seedHandicap: number | null
  handicapRecords: Array<{ courseDifferential: number }>
}) {
  return handicapIndex(player.handicapRecords.map((record) => record.courseDifferential)) ?? player.seedHandicap ?? 0
}

export function getPlayingHandicap(
  handicapMode: HandicapMode | null | undefined,
  handicapIndexValue: number,
  tee: TeeData | null | undefined
) {
  if (handicapMode === 'course' && tee) {
    return courseHandicap(
      handicapIndexValue,
      tee.nineHoleSlope,
      tee.nineHoleRating,
      tee.nineHolePar
    )
  }

  return Math.round(handicapIndexValue)
}

export function getHandicapModeLabel(handicapMode: HandicapMode | null | undefined) {
  return handicapMode === 'course' ? 'Course Handicap' : 'Index'
}

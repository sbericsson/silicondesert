import type { HandicapMode } from '@prisma/client'
import { courseHandicap, exactHandicapIndexFromRecords, roundToWholeHandicap } from '@/lib/handicap'

type TeeData = {
  nineHoleSlope: number
  nineHoleRating: number
  nineHolePar: number
}

export function getPlayerHandicapIndexValue(player: {
  seedHandicap: number | null
  handicapRecords: Array<{ courseDifferential: number }>
}) {
  return exactHandicapIndexFromRecords(player.handicapRecords) ?? player.seedHandicap ?? 0
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

  return roundToWholeHandicap(handicapIndexValue)
}

export function getHandicapModeLabel(handicapMode: HandicapMode | null | undefined) {
  return handicapMode === 'course' ? 'Course Handicap' : 'Index'
}

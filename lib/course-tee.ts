import type { TeeColor } from '@prisma/client'

interface CourseTeeLike {
  color: TeeColor
  nineHolePar: number
  nineHoleRating: number
  nineHoleSlope: number
}

interface SeasonTeeChoiceLike {
  seasonId: string
  teeColor: TeeColor
}

export function getPlayerSeasonTeeColor(
  choices: SeasonTeeChoiceLike[],
  seasonId: string
): TeeColor {
  return choices.find((choice) => choice.seasonId === seasonId)?.teeColor ?? 'white'
}

export function getCourseTee(
  tees: CourseTeeLike[],
  color: TeeColor,
  fallback?: CourseTeeLike
): CourseTeeLike {
  return (
    tees.find((tee) => tee.color === color) ??
    tees.find((tee) => tee.color === 'white') ??
    tees[0] ??
    fallback ?? {
      color: 'white',
      nineHolePar: 36,
      nineHoleRating: 36,
      nineHoleSlope: 113
    }
  )
}

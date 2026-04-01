import type { Gender, TeeColor } from '@prisma/client'

interface CourseTeeLike {
  color: TeeColor
  gender: Gender
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
  gender: Gender,
  fallback?: CourseTeeLike
): CourseTeeLike {
  return (
    tees.find((tee) => tee.color === color && tee.gender === gender) ??
    tees.find((tee) => tee.color === 'white' && tee.gender === gender) ??
    tees.find((tee) => tee.color === color && tee.gender === 'man') ??
    tees.find((tee) => tee.color === 'white' && tee.gender === 'man') ??
    tees[0] ??
    fallback ?? {
      color: 'white',
      gender: 'man',
      nineHolePar: 36,
      nineHoleRating: 36,
      nineHoleSlope: 113
    }
  )
}

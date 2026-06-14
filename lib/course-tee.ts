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

type CourseDefaultTeeFallbackSource = Pick<
  CourseTeeLike,
  'nineHolePar' | 'nineHoleRating' | 'nineHoleSlope'
>

export const COURSE_DEFAULT_TEE_FALLBACK: CourseTeeLike = {
  color: 'white',
  gender: 'man',
  nineHolePar: 35,
  nineHoleRating: 34.0,
  nineHoleSlope: 113
}

export function getCourseDefaultTeeFallback(
  course?: CourseDefaultTeeFallbackSource | null
): CourseTeeLike {
  return course
    ? {
        ...COURSE_DEFAULT_TEE_FALLBACK,
        nineHolePar: course.nineHolePar,
        nineHoleRating: course.nineHoleRating,
        nineHoleSlope: course.nineHoleSlope
      }
    : COURSE_DEFAULT_TEE_FALLBACK
}

export function getDefaultTeeColorForGender(gender: Gender): TeeColor {
  return gender === 'woman' ? 'yellow' : 'blue'
}

export function getPlayerSeasonTeeColor(
  choices: SeasonTeeChoiceLike[],
  seasonId: string,
  gender: Gender,
  defaultTeeColor?: TeeColor | null
): TeeColor {
  return (
    choices.find((choice) => choice.seasonId === seasonId)?.teeColor ??
    defaultTeeColor ??
    getDefaultTeeColorForGender(gender)
  )
}

export function getPlayerMatchTeeColor(
  choices: SeasonTeeChoiceLike[],
  seasonId: string,
  gender: Gender,
  defaultTeeColor?: TeeColor | null,
  matchTeeOverrideColor?: TeeColor | null
): TeeColor {
  return (
    matchTeeOverrideColor ??
    getPlayerSeasonTeeColor(choices, seasonId, gender, defaultTeeColor)
  )
}

export function getCourseTee(
  tees: CourseTeeLike[],
  color: TeeColor,
  gender: Gender,
  fallback?: CourseTeeLike
): CourseTeeLike {
  const defaultColor = getDefaultTeeColorForGender(gender)

  return (
    tees.find((tee) => tee.color === color && tee.gender === gender) ??
    tees.find((tee) => tee.color === defaultColor && tee.gender === gender) ??
    tees.find((tee) => tee.color === color && tee.gender === 'man') ??
    tees.find((tee) => tee.color === 'white' && tee.gender === 'man') ??
    tees[0] ??
    fallback ?? {
      color: defaultColor,
      gender,
      nineHolePar: 36,
      nineHoleRating: 36,
      nineHoleSlope: 113
    }
  )
}

import type { Gender, TeeColor } from '@prisma/client'
import { scoreDifferential } from '@/lib/handicap'

export interface ImportedHandicapRoundInput {
  date: string
  grossScore: number
  adjustedGrossScore: number
  courseRating: number
  slopeRating: number
  coursePar: number
}

export interface ImportedHandicapRoundRecord extends ImportedHandicapRoundInput {
  courseDifferential: number
}

export interface ImportedHandicapCourseOption {
  id: string
  name: string
  tees: Array<{
    color: TeeColor
    gender: Gender
    nineHolePar: number
    nineHoleRating: number
    nineHoleSlope: number
  }>
}

export interface ImportedHandicapRoundMatch {
  courseId: string
  teeColor: TeeColor
}

function parseNumber(value: string) {
  const parsed = Number(value.trim())
  return Number.isFinite(parsed) ? parsed : null
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

const TOO_MANY_ROUNDS_ERROR = 'Enter at most 20 prior handicap rounds.'

function validateRound(
  label: string,
  date: string,
  grossScore: number | null,
  adjustedGrossScore: number | null,
  courseRating: number | null,
  slopeRating: number | null,
  coursePar: number | null,
  duplicateKeys: Set<string>
): { error: string } | ImportedHandicapRoundInput {
  if (!isIsoDate(date)) {
    return { error: `${label} must start with a date like 2026-03-31.` }
  }

  if (
    grossScore === null ||
    adjustedGrossScore === null ||
    courseRating === null ||
    slopeRating === null ||
    coursePar === null
  ) {
    return { error: `${label} has an invalid numeric value.` }
  }

  if (
    !Number.isInteger(grossScore) ||
    !Number.isInteger(adjustedGrossScore) ||
    !Number.isInteger(slopeRating) ||
    !Number.isInteger(coursePar) ||
    grossScore < 1 ||
    adjustedGrossScore < 1 ||
    slopeRating < 1 ||
    coursePar < 1
  ) {
    return { error: `${label} must use positive whole numbers for gross, adjusted, slope, and par.` }
  }

  if (adjustedGrossScore > grossScore) {
    return { error: `${label} cannot have adjusted gross higher than gross.` }
  }

  const duplicateKey = `${date}:${grossScore}`
  if (duplicateKeys.has(duplicateKey)) {
    return { error: `${label} duplicates another round with the same date and gross score.` }
  }

  duplicateKeys.add(duplicateKey)
  return { date, grossScore, adjustedGrossScore, courseRating, slopeRating, coursePar }
}

export function parseImportedHandicapRoundsText(text: string) {
  const trimmed = text.trim()

  if (!trimmed) {
    return { rounds: [] as ImportedHandicapRoundInput[] }
  }

  const lines = trimmed
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length > 20) {
    return { rounds: [] as ImportedHandicapRoundInput[], error: TOO_MANY_ROUNDS_ERROR }
  }

  const rounds: ImportedHandicapRoundInput[] = []
  const duplicateKeys = new Set<string>()

  for (const [index, line] of lines.entries()) {
    const label = `Line ${index + 1}`
    const fields = line.split(',').map((field) => field.trim())

    if (fields.length !== 5 && fields.length !== 6) {
      return {
        rounds: [] as ImportedHandicapRoundInput[],
        error:
          `${label} must be ` +
          '`YYYY-MM-DD, gross, rating, slope, par` or `YYYY-MM-DD, gross, adjusted, rating, slope, par`.'
      }
    }

    const [date, grossValue, thirdValue, fourthValue, fifthValue, sixthValue] = fields
    const grossScore = parseNumber(grossValue)
    const adjustedGrossScore = fields.length === 6 ? parseNumber(thirdValue) : grossScore
    const courseRating = parseNumber(fields.length === 6 ? fourthValue : thirdValue)
    const slopeRating = parseNumber(fields.length === 6 ? fifthValue : fourthValue)
    const coursePar = parseNumber(fields.length === 6 ? sixthValue ?? '' : fifthValue)

    const result = validateRound(label, date, grossScore, adjustedGrossScore, courseRating, slopeRating, coursePar, duplicateKeys)
    if ('error' in result) {
      return { rounds: [] as ImportedHandicapRoundInput[], error: result.error }
    }
    rounds.push(result)
  }

  rounds.sort((a, b) => a.date.localeCompare(b.date))
  return { rounds }
}

export function validateImportedHandicapRounds(rounds: unknown[]) {
  if (rounds.length > 20) {
    return { rounds: [] as ImportedHandicapRoundInput[], error: TOO_MANY_ROUNDS_ERROR }
  }

  const normalized: ImportedHandicapRoundInput[] = []
  const duplicateKeys = new Set<string>()

  for (const [index, round] of rounds.entries()) {
    const label = `Imported round ${index + 1}`

    if (!round || typeof round !== 'object') {
      return { rounds: [] as ImportedHandicapRoundInput[], error: `${label} is invalid.` }
    }

    const candidate = round as Record<string, unknown>
    const date = typeof candidate.date === 'string' ? candidate.date.trim() : ''
    const grossScore = typeof candidate.grossScore === 'number' ? candidate.grossScore : null
    const adjustedGrossScore = typeof candidate.adjustedGrossScore === 'number' ? candidate.adjustedGrossScore : null
    const courseRating = typeof candidate.courseRating === 'number' ? candidate.courseRating : null
    const slopeRating = typeof candidate.slopeRating === 'number' ? candidate.slopeRating : null
    const coursePar = typeof candidate.coursePar === 'number' ? candidate.coursePar : null

    const result = validateRound(label, date, grossScore, adjustedGrossScore, courseRating, slopeRating, coursePar, duplicateKeys)
    if ('error' in result) {
      return { rounds: [] as ImportedHandicapRoundInput[], error: result.error }
    }
    normalized.push(result)
  }

  normalized.sort((a, b) => a.date.localeCompare(b.date))
  return { rounds: normalized }
}

export function toImportedHandicapRoundRecords(rounds: ImportedHandicapRoundInput[]) {
  return rounds.map((round) => ({
    ...round,
    courseDifferential: scoreDifferential(
      round.adjustedGrossScore,
      round.courseRating,
      round.slopeRating
    )
  }))
}

export function formatImportedHandicapRoundsText(rounds: ImportedHandicapRoundInput[]) {
  return rounds
    .map(
      (round) =>
        `${round.date}, ${round.grossScore}, ${round.adjustedGrossScore}, ${round.courseRating}, ${round.slopeRating}, ${round.coursePar}`
    )
    .join('\n')
}

export function getImportedHandicapCourseTee(
  courses: ImportedHandicapCourseOption[],
  courseId: string,
  teeColor: TeeColor,
  gender: Gender
) {
  const course = courses.find((candidate) => candidate.id === courseId)
  if (!course) {
    return null
  }

  const tee =
    course.tees.find((candidate) => candidate.color === teeColor && candidate.gender === gender) ??
    course.tees.find((candidate) => candidate.color === 'white' && candidate.gender === gender) ??
    course.tees.find((candidate) => candidate.color === teeColor && candidate.gender === 'man') ??
    course.tees.find((candidate) => candidate.color === 'white' && candidate.gender === 'man') ??
    course.tees[0]

  if (!tee) {
    return null
  }

  return {
    courseId: course.id,
    courseName: course.name,
    teeColor: tee.color,
    gender: tee.gender,
    nineHolePar: tee.nineHolePar,
    nineHoleRating: tee.nineHoleRating,
    nineHoleSlope: tee.nineHoleSlope
  }
}

export function matchImportedHandicapRoundToCourse(
  round: ImportedHandicapRoundInput,
  courses: ImportedHandicapCourseOption[]
): ImportedHandicapRoundMatch | null {
  const candidates = courses.flatMap((course) =>
    course.tees
      .filter(
        (tee) =>
          tee.nineHolePar === round.coursePar &&
          tee.nineHoleSlope === round.slopeRating &&
          Math.abs(tee.nineHoleRating - round.courseRating) <= 0.05
      )
      .map((tee) => ({
        courseId: course.id,
        teeColor: tee.color,
        ratingDelta: Math.abs(tee.nineHoleRating - round.courseRating)
      }))
  )

  if (candidates.length === 0) {
    return null
  }

  candidates.sort((left, right) => left.ratingDelta - right.ratingDelta)
  return {
    courseId: candidates[0].courseId,
    teeColor: candidates[0].teeColor
  }
}

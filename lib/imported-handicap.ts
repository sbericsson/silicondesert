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

function parseNumber(value: string) {
  const parsed = Number(value.trim())
  return Number.isFinite(parsed) ? parsed : null
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
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
    return {
      rounds: [] as ImportedHandicapRoundInput[],
      error: 'Enter at most 20 prior handicap rounds.'
    }
  }

  const rounds: ImportedHandicapRoundInput[] = []
  const duplicateKeys = new Set<string>()

  for (const [index, line] of lines.entries()) {
    const fields = line.split(',').map((field) => field.trim())
    if (fields.length !== 5 && fields.length !== 6) {
      return {
        rounds: [] as ImportedHandicapRoundInput[],
        error:
          `Line ${index + 1} must be ` +
          '`YYYY-MM-DD, gross, rating, slope, par` or `YYYY-MM-DD, gross, adjusted, rating, slope, par`.'
      }
    }

    const [date, grossValue, thirdValue, fourthValue, fifthValue, sixthValue] = fields
    if (!isIsoDate(date)) {
      return {
        rounds: [] as ImportedHandicapRoundInput[],
        error: `Line ${index + 1} must start with a date like 2026-03-31.`
      }
    }

    const grossScore = parseNumber(grossValue)
    const adjustedGrossScore = fields.length === 6 ? parseNumber(thirdValue) : grossScore
    const courseRating = parseNumber(fields.length === 6 ? fourthValue : thirdValue)
    const slopeRating = parseNumber(fields.length === 6 ? fifthValue : fourthValue)
    const coursePar = parseNumber(fields.length === 6 ? sixthValue ?? '' : fifthValue)

    if (
      grossScore === null ||
      adjustedGrossScore === null ||
      courseRating === null ||
      slopeRating === null ||
      coursePar === null
    ) {
      return {
        rounds: [] as ImportedHandicapRoundInput[],
        error: `Line ${index + 1} has an invalid numeric value.`
      }
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
      return {
        rounds: [] as ImportedHandicapRoundInput[],
        error: `Line ${index + 1} must use positive whole numbers for gross, adjusted, slope, and par.`
      }
    }

    if (adjustedGrossScore > grossScore) {
      return {
        rounds: [] as ImportedHandicapRoundInput[],
        error: `Line ${index + 1} cannot have adjusted gross higher than gross.`
      }
    }

    const duplicateKey = `${date}:${grossScore}`
    if (duplicateKeys.has(duplicateKey)) {
      return {
        rounds: [] as ImportedHandicapRoundInput[],
        error: `Line ${index + 1} duplicates another round with the same date and gross score.`
      }
    }

    duplicateKeys.add(duplicateKey)
    rounds.push({
      date,
      grossScore,
      adjustedGrossScore,
      courseRating,
      slopeRating,
      coursePar
    })
  }

  rounds.sort((a, b) => a.date.localeCompare(b.date))
  return { rounds }
}

export function validateImportedHandicapRounds(rounds: unknown[]) {
  if (rounds.length > 20) {
    return {
      rounds: [] as ImportedHandicapRoundInput[],
      error: 'Enter at most 20 prior handicap rounds.'
    }
  }

  const normalized: ImportedHandicapRoundInput[] = []
  const duplicateKeys = new Set<string>()

  for (const [index, round] of rounds.entries()) {
    if (!round || typeof round !== 'object') {
      return {
        rounds: [] as ImportedHandicapRoundInput[],
        error: `Imported round ${index + 1} is invalid.`
      }
    }

    const candidate = round as Record<string, unknown>
    const date = typeof candidate.date === 'string' ? candidate.date.trim() : ''
    const grossScore =
      typeof candidate.grossScore === 'number' ? candidate.grossScore : null
    const adjustedGrossScore =
      typeof candidate.adjustedGrossScore === 'number' ? candidate.adjustedGrossScore : null
    const courseRating =
      typeof candidate.courseRating === 'number' ? candidate.courseRating : null
    const slopeRating =
      typeof candidate.slopeRating === 'number' ? candidate.slopeRating : null
    const coursePar =
      typeof candidate.coursePar === 'number' ? candidate.coursePar : null

    if (!isIsoDate(date)) {
      return {
        rounds: [] as ImportedHandicapRoundInput[],
        error: `Imported round ${index + 1} is missing a valid date.`
      }
    }

    if (
      grossScore === null ||
      adjustedGrossScore === null ||
      courseRating === null ||
      slopeRating === null ||
      coursePar === null ||
      !Number.isInteger(grossScore) ||
      !Number.isInteger(adjustedGrossScore) ||
      !Number.isFinite(courseRating) ||
      !Number.isInteger(slopeRating) ||
      !Number.isInteger(coursePar) ||
      grossScore < 1 ||
      adjustedGrossScore < 1 ||
      slopeRating < 1 ||
      coursePar < 1
    ) {
      return {
        rounds: [] as ImportedHandicapRoundInput[],
        error: `Imported round ${index + 1} has invalid score or course values.`
      }
    }

    if (adjustedGrossScore > grossScore) {
      return {
        rounds: [] as ImportedHandicapRoundInput[],
        error: `Imported round ${index + 1} cannot have adjusted gross above gross.`
      }
    }

    const duplicateKey = `${date}:${grossScore}`
    if (duplicateKeys.has(duplicateKey)) {
      return {
        rounds: [] as ImportedHandicapRoundInput[],
        error: `Imported round ${index + 1} duplicates another round with the same date and gross score.`
      }
    }

    duplicateKeys.add(duplicateKey)
    normalized.push({
      date,
      grossScore,
      adjustedGrossScore,
      courseRating,
      slopeRating,
      coursePar
    })
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

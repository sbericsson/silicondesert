export function roundToTenth(value: number) {
  return Math.round(value * 10) / 10
}

export function strokesReceivedOnHole(courseHandicap: number, strokeIndex: number) {
  if (courseHandicap < strokeIndex) {
    return 0
  }

  return Math.floor((courseHandicap - strokeIndex) / 9) + 1
}

export function netDoubleBogey(par: number, strokesReceived: number) {
  return par + 2 + strokesReceived
}

export function applyESC(grossScore: number, par: number, strokesReceived: number) {
  return Math.min(grossScore, netDoubleBogey(par, strokesReceived))
}

export function scoreDifferential(
  adjustedGrossScore: number,
  courseRating: number,
  slopeRating: number
) {
  const raw = ((adjustedGrossScore - courseRating) * 113) / slopeRating
  return roundToTenth(raw)
}

// League rule: for 1-3 rounds we establish an initial handicap using the
// lowest differential with the same -2.0 adjustment as the 3-round WHS case.
// After that, follow the standard WHS Rule 5.2a table.
// [max score count, differentials to use, adjustment]
const WHS_TABLE: Array<[number, number, number]> = [
  [3, 1, -2.0],
  [4, 1, -1.0],
  [5, 1, 0],
  [6, 2, -1.0],
  [8, 2, 0],
  [11, 3, 0],
  [14, 4, 0],
  [16, 5, 0],
  [18, 6, 0],
  [19, 7, 0],
  [20, 8, 0],
]

export function handicapIndex(differentials: number[]) {
  if (differentials.length === 0) {
    return null
  }

  const recent = differentials.slice(-20)
  const row = WHS_TABLE.find(([maxCount]) => recent.length <= maxCount)
  if (!row) return null

  const [, useCount, adjustment] = row
  const best = [...recent].sort((a, b) => a - b).slice(0, useCount)
  const average = best.reduce((sum, value) => sum + value, 0) / best.length

  return roundToTenth(average + adjustment)
}

export function handicapIndexFromRecords(records: Array<{ courseDifferential: number }>) {
  return handicapIndex(records.map((record) => record.courseDifferential))
}

export function courseHandicap(
  handicapIndexValue: number,
  slopeRating: number,
  courseRating: number,
  coursePar: number
) {
  const value = (handicapIndexValue * slopeRating) / 113 + (courseRating - coursePar)
  return Math.round(value)
}

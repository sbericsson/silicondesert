export function roundToTenth(value: number) {
  return Math.round(value * 10) / 10
}

export function strokesReceivedOnHole(courseHandicap: number, strokeIndex: number): 0 | 1 | 2 {
  const firstPass = courseHandicap >= strokeIndex ? 1 : 0
  const secondPass = courseHandicap >= strokeIndex + 9 ? 1 : 0

  return (firstPass + secondPass) as 0 | 1 | 2
}

export function netDoubleBogey(par: number, strokesReceived: 0 | 1 | 2) {
  return par + 2 + strokesReceived
}

export function applyESC(grossScore: number, par: number, strokesReceived: 0 | 1 | 2) {
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

const WHS_LOOKUP: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 2,
  5: 2,
  6: 2,
  7: 3,
  8: 3,
  9: 4,
  10: 4,
  11: 4,
  12: 5,
  13: 5,
  14: 5,
  15: 6,
  16: 6,
  17: 7,
  18: 7,
  19: 8,
  20: 8
}

export function handicapIndex(differentials: number[]) {
  if (differentials.length === 0) {
    return null
  }

  const recent = differentials.slice(-20)
  const useCount = WHS_LOOKUP[Math.min(recent.length, 20)]
  const best = [...recent].sort((a, b) => a - b).slice(0, useCount)
  const average = best.reduce((sum, value) => sum + value, 0) / best.length

  return roundToTenth(average * 0.96)
}

export function courseHandicap(
  handicapIndexValue: number,
  slopeRating: number,
  courseRating: number,
  coursePar: number
) {
  const fullEighteen = (handicapIndexValue * slopeRating) / 113 + (courseRating - coursePar)
  return Math.round(fullEighteen / 2)
}

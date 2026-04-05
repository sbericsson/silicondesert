import { describe, expect, it } from 'vitest'
import {
  applyESC,
  courseHandicap,
  handicapIndex,
  scoreDifferential,
  strokesReceivedOnHole
} from '@/lib/handicap'

describe('handicap helpers', () => {
  it('computes strokes received on a hole', () => {
    expect(strokesReceivedOnHole(5, 7)).toBe(0)
    expect(strokesReceivedOnHole(5, 3)).toBe(1)
    expect(strokesReceivedOnHole(15, 5)).toBe(2)
    expect(strokesReceivedOnHole(20, 2)).toBe(3)
  })

  it('applies ESC net double bogey cap', () => {
    expect(applyESC(9, 4, 1)).toBe(7)
  })

  it('computes score differential to one decimal place', () => {
    expect(scoreDifferential(42, 35.2, 128)).toBe(6)
  })

  it('computes handicap index from recent rounds', () => {
    // League rule: 1-3 scores all use the 3-score initial-handicap treatment.
    expect(handicapIndex([5.0])).toBe(3.0)
    expect(handicapIndex([5.0, 8.0])).toBe(3.0)
    // 3 scores: lowest 1 differential, -2.0 adjustment (WHS Rule 5.2a)
    expect(handicapIndex([5.0, 8.0, 6.0])).toBe(3.0)
    // 6 scores: average of lowest 2, -1.0 adjustment
    expect(handicapIndex([5.0, 8.0, 6.0, 7.0, 9.0, 4.0])).toBe(3.5)
    // zero scores: no index
    expect(handicapIndex([])).toBeNull()
  })

  it('computes nine-hole course handicap from a nine-hole handicap index', () => {
    expect(courseHandicap(14.2, 128, 35.2, 36)).toBe(15)
  })
})

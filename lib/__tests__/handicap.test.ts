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
  })

  it('applies ESC net double bogey cap', () => {
    expect(applyESC(9, 4, 1)).toBe(7)
  })

  it('computes score differential to one decimal place', () => {
    expect(scoreDifferential(42, 35.2, 128)).toBe(6)
  })

  it('computes handicap index from recent rounds', () => {
    expect(handicapIndex([5.0, 8.0, 6.0])).toBe(5.3)
  })

  it('computes nine-hole course handicap', () => {
    expect(courseHandicap(14.2, 128, 35.2, 36)).toBe(7)
  })
})

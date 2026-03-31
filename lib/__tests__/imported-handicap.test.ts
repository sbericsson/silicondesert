import { describe, expect, it } from 'vitest'
import {
  formatImportedHandicapRoundsText,
  parseImportedHandicapRoundsText,
  validateImportedHandicapRounds
} from '@/lib/imported-handicap'

describe('imported handicap helpers', () => {
  it('parses 5-column rounds by treating gross as adjusted', () => {
    const result = parseImportedHandicapRoundsText('2025-10-03, 41, 34.9, 119, 36')

    expect(result.error).toBeUndefined()
    expect(result.rounds).toEqual([
      {
        date: '2025-10-03',
        grossScore: 41,
        adjustedGrossScore: 41,
        courseRating: 34.9,
        slopeRating: 119,
        coursePar: 36
      }
    ])
  })

  it('parses 6-column rounds with explicit adjusted scores', () => {
    const result = parseImportedHandicapRoundsText('2025-10-03, 41, 39, 34.9, 119, 36')

    expect(result.error).toBeUndefined()
    expect(result.rounds[0]?.adjustedGrossScore).toBe(39)
  })

  it('rejects more than 20 imported rounds', () => {
    const lines = Array.from({ length: 21 }, (_, index) => `2025-10-${String(index + 1).padStart(2, '0')}, 41, 34.9, 119, 36`).join('\n')
    const result = parseImportedHandicapRoundsText(lines)

    expect(result.error).toContain('at most 20')
  })

  it('formats imported rounds back to editable text', () => {
    expect(
      formatImportedHandicapRoundsText([
        {
          date: '2025-10-03',
          grossScore: 41,
          adjustedGrossScore: 39,
          courseRating: 34.9,
          slopeRating: 119,
          coursePar: 36
        }
      ])
    ).toBe('2025-10-03, 41, 39, 34.9, 119, 36')
  })

  it('validates structured imported rounds for the API', () => {
    const result = validateImportedHandicapRounds([
      {
        date: '2025-10-03',
        grossScore: 41,
        adjustedGrossScore: 39,
        courseRating: 34.9,
        slopeRating: 119,
        coursePar: 36
      }
    ])

    expect(result.error).toBeUndefined()
    expect(result.rounds).toHaveLength(1)
  })
})

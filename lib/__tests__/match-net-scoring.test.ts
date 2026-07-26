import { describe, expect, it } from 'vitest'
import {
  calculateMatchOutcomeFromGrossScores,
  formatPopHoles,
  getPopHoles
} from '@/lib/match-net-scoring'

describe('getPopHoles', () => {
  // Stroke index runs opposite to hole number so the tests prove pops follow
  // the index rather than just taking the first N holes.
  const holes = Array.from({ length: 9 }, (_, index) => ({
    holeNumber: index + 1,
    strokeIndex: 9 - index,
    womenStrokeIndex: index + 1
  }))

  it('returns nothing when the match is even', () => {
    expect(getPopHoles({ popDifference: 0, holes, anyWoman: false })).toEqual([])
  })

  it('allocates pops to the hardest holes by stroke index', () => {
    const popHoles = getPopHoles({ popDifference: 3, holes, anyWoman: false })

    expect(popHoles).toEqual([
      { holeNumber: 7, strokes: 1 },
      { holeNumber: 8, strokes: 1 },
      { holeNumber: 9, strokes: 1 }
    ])
  })

  it('uses the women stroke index when either player is a woman', () => {
    const popHoles = getPopHoles({ popDifference: 3, holes, anyWoman: true })

    expect(popHoles.map((hole) => hole.holeNumber)).toEqual([1, 2, 3])
  })

  it('gives a second stroke on the hardest holes past nine pops', () => {
    const popHoles = getPopHoles({ popDifference: 12, holes, anyWoman: true })

    expect(popHoles).toHaveLength(9)
    expect(popHoles.filter((hole) => hole.strokes === 2).map((hole) => hole.holeNumber)).toEqual([
      1, 2, 3
    ])
    expect(popHoles.reduce((total, hole) => total + hole.strokes, 0)).toBe(12)
  })

  it('skips holes with no course data', () => {
    expect(getPopHoles({ popDifference: 4, holes: [], anyWoman: false })).toEqual([])
  })
})

describe('formatPopHoles', () => {
  it('returns an empty string when there are no pop holes', () => {
    expect(formatPopHoles([])).toBe('')
  })

  it('uses the singular for a single hole', () => {
    expect(formatPopHoles([{ holeNumber: 4, strokes: 1 }])).toBe('on hole 4')
  })

  it('lists evenly allocated holes without stroke counts', () => {
    expect(
      formatPopHoles([
        { holeNumber: 1, strokes: 1 },
        { holeNumber: 3, strokes: 1 },
        { holeNumber: 6, strokes: 1 }
      ])
    ).toBe('on holes 1, 3, 6')
  })

  it('calls out the double-stroke holes separately', () => {
    expect(
      formatPopHoles([
        { holeNumber: 1, strokes: 2 },
        { holeNumber: 2, strokes: 2 },
        { holeNumber: 3, strokes: 1 }
      ])
    ).toBe('on holes 1, 2 (2 each) and hole 3 (1 each)')
  })
})

describe('calculateMatchOutcomeFromGrossScores', () => {
  it('recomputes stroke and match-play winners from stored gross scores', () => {
    const holes = Array.from({ length: 9 }, (_, index) => ({
      holeNumber: index + 1,
      strokeIndex: index + 1,
      player1GrossScore: index < 2 ? 5 : 4,
      player2GrossScore: 4
    }))

    expect(
      calculateMatchOutcomeFromGrossScores({
        player1Id: 'p1',
        player2Id: 'p2',
        player1PlayingHandicap: 8,
        player2PlayingHandicap: 8,
        player2ScorecardOnly: false,
        holes
      })
    ).toEqual({
      player1NetTotal: 38,
      player2NetTotal: 36,
      strokeWinnerId: 'p2',
      matchPlayLeadBy: 2,
      matchPlayHolesRemaining: 1,
      matchPlayWinnerId: 'p2'
    })

    expect(
      calculateMatchOutcomeFromGrossScores({
        player1Id: 'p1',
        player2Id: 'p2',
        player1PlayingHandicap: 10,
        player2PlayingHandicap: 8,
        player2ScorecardOnly: false,
        holes
      })
    ).toEqual({
      player1NetTotal: 36,
      player2NetTotal: 36,
      strokeWinnerId: null,
      matchPlayLeadBy: 0,
      matchPlayHolesRemaining: 0,
      matchPlayWinnerId: null
    })
  })

  it('keeps stroke play unset until both scorecards are complete', () => {
    const holes = Array.from({ length: 9 }, (_, index) => ({
      holeNumber: index + 1,
      strokeIndex: index + 1,
      player1GrossScore: index < 2 ? 4 : null,
      player2GrossScore: index < 2 ? 5 : null
    }))

    expect(
      calculateMatchOutcomeFromGrossScores({
        player1Id: 'p1',
        player2Id: 'p2',
        player1PlayingHandicap: 8,
        player2PlayingHandicap: 8,
        player2ScorecardOnly: false,
        holes
      })
    ).toEqual({
      player1NetTotal: null,
      player2NetTotal: null,
      strokeWinnerId: null,
      matchPlayLeadBy: 2,
      matchPlayHolesRemaining: 7,
      matchPlayWinnerId: 'p1'
    })
  })

  it('uses gross totals, not adjusted totals, to decide the stroke winner', () => {
    const holes = Array.from({ length: 9 }, (_, index) => ({
      holeNumber: index + 1,
      strokeIndex: index + 1,
      player1GrossScore: 4,
      player2GrossScore: 5
    }))

    expect(
      calculateMatchOutcomeFromGrossScores({
        player1Id: 'tom',
        player2Id: 'mike',
        player1PlayingHandicap: 4,
        player2PlayingHandicap: 10,
        player2ScorecardOnly: false,
        holes
      })
    ).toMatchObject({
      player1NetTotal: 36,
      player2NetTotal: 39,
      strokeWinnerId: 'tom'
    })
  })

  it('lets the reference scorecard win stroke in scorecard-only matches', () => {
    const holes = Array.from({ length: 9 }, (_, index) => ({
      holeNumber: index + 1,
      strokeIndex: index + 1,
      player1GrossScore: index === 0 ? 6 : 5,
      player2GrossScore: 4
    }))

    expect(
      calculateMatchOutcomeFromGrossScores({
        player1Id: 'p1',
        player2Id: 'reference',
        player1PlayingHandicap: 12,
        player2PlayingHandicap: 4,
        player2ScorecardOnly: true,
        holes
      })
    ).toMatchObject({
      player1NetTotal: 38,
      player2NetTotal: 36,
      strokeWinnerId: 'reference'
    })
  })
})

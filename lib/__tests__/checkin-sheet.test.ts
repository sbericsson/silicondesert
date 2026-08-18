import { describe, expect, it } from 'vitest'
import {
  buildCheckInSheetRow,
  createSurnameResolver,
  fitOpponents,
  formatSheetDate,
  sortOpponents
} from '@/lib/checkin-sheet'

describe('createSurnameResolver', () => {
  it('uses the bare surname when it is unique in the league', () => {
    const resolve = createSurnameResolver(['Stein Ericsson', 'Bob Below', 'Mike Clay'])

    expect(resolve('Bob Below')).toBe('Below')
    expect(resolve('Mike Clay')).toBe('Clay')
  })

  it('adds a first initial only for shared surnames', () => {
    const resolve = createSurnameResolver([
      'Marshall Hudson',
      'Sandy Hudson',
      'Mike Clay'
    ])

    expect(resolve('Marshall Hudson')).toBe('M.Hudson')
    expect(resolve('Sandy Hudson')).toBe('S.Hudson')
    expect(resolve('Mike Clay')).toBe('Clay')
  })

  it('keeps multi-word surnames intact', () => {
    const resolve = createSurnameResolver(['Lowell Vande Kamp', 'Michael Del Col'])

    expect(resolve('Lowell Vande Kamp')).toBe('Vande Kamp')
    expect(resolve('Michael Del Col')).toBe('Del Col')
  })
})

describe('sortOpponents', () => {
  it('puts repeat pairings first, most repeated first, then one-timers A-Z', () => {
    const sorted = sortOpponents([
      { name: 'Wagner', count: 1 },
      { name: 'Clay', count: 2 },
      { name: 'Below', count: 1 },
      { name: 'Higgins', count: 3 }
    ])

    expect(sorted.map((opponent) => opponent.name)).toEqual([
      'Higgins',
      'Clay',
      'Below',
      'Wagner'
    ])
  })
})

describe('fitOpponents', () => {
  it('keeps everything when the row has room', () => {
    const opponents = [
      { name: 'Clay', count: 1 },
      { name: 'Below', count: 1 }
    ]

    expect(fitOpponents(opponents)).toEqual({ shown: opponents, hidden: 0 })
  })

  it('truncates to the budget and reports the remainder', () => {
    const opponents = [
      { name: 'Aldecoa', count: 1 },
      { name: 'Camomile', count: 1 },
      { name: 'Pestalozzi', count: 1 },
      { name: 'Rodriguez', count: 1 },
      { name: 'Wozniak', count: 1 }
    ]

    const { shown, hidden } = fitOpponents(opponents, 20)

    expect(shown.map((opponent) => opponent.name)).toEqual(['Aldecoa', 'Camomile'])
    expect(hidden).toBe(3)
  })

  // Repeats are the reason the column exists, so truncation must never be
  // allowed to hide one behind a one-time opponent.
  it('never drops a repeat when the list is pre-sorted', () => {
    const opponents = sortOpponents([
      { name: 'Aldecoa', count: 1 },
      { name: 'Camomile', count: 1 },
      { name: 'Wozniak', count: 2 }
    ])

    const { shown } = fitOpponents(opponents, 14)

    expect(shown.map((opponent) => opponent.name)).toEqual(['Wozniak'])
  })
})

describe('formatSheetDate', () => {
  it('formats in Phoenix time so a UTC-stored Friday does not slip a day', () => {
    expect(formatSheetDate(new Date('2026-04-24T12:00:00Z'))).toBe('Friday, April 24, 2026')
  })
})

describe('buildCheckInSheetRow', () => {
  // Real Oakwood Palms and Ironwood Front 9 numbers from prisma/seed.ts.
  const courses = [
    {
      nineHolePar: 36,
      nineHoleRating: 33.7,
      nineHoleSlope: 118,
      tees: [
        { color: 'white' as const, gender: 'man' as const, nineHolePar: 36, nineHoleRating: 33.7, nineHoleSlope: 118 },
        { color: 'silver' as const, gender: 'woman' as const, nineHolePar: 36, nineHoleRating: 32.9, nineHoleSlope: 112 }
      ]
    },
    {
      nineHolePar: 34,
      nineHoleRating: 30.65,
      nineHoleSlope: 99,
      tees: [
        { color: 'white' as const, gender: 'man' as const, nineHolePar: 34, nineHoleRating: 30.65, nineHoleSlope: 99 },
        { color: 'silver' as const, gender: 'woman' as const, nineHolePar: 34, nineHoleRating: 29.65, nineHoleSlope: 92 }
      ]
    }
  ]

  const basePlayer = {
    id: 'p1',
    name: 'Stein Ericsson',
    gender: 'man' as const,
    defaultTeeColor: null,
    seedHandicap: null,
    handicapRecords: [],
    seasonTeeChoices: [{ seasonId: 's1', teeColor: 'white' as const }],
    venueMemberships: [{ venue: 'Oakwood' }]
  }

  it('computes a course handicap per course from the player tee', () => {
    // A 7.4 index off the men's white tee: 7.4*118/113 + (33.7-36) = 5.4 -> 5
    // and 7.4*99/113 + (30.65-34) = 3.1 -> 3
    const row = buildCheckInSheetRow(
      { ...basePlayer, seedHandicap: 7.4 },
      courses,
      's1',
      'Oakwood'
    )

    expect(row.courseHandicaps).toEqual([5, 3])
    expect(row.indexLabel).toBe('7.4')
    expect(row.teeLetter).toBe('W')
  })

  it('uses the women tee row for a woman on the same tee colour', () => {
    const row = buildCheckInSheetRow(
      {
        ...basePlayer,
        gender: 'woman',
        seedHandicap: 7.4,
        seasonTeeChoices: [{ seasonId: 's1', teeColor: 'silver' }]
      },
      courses,
      's1',
      'Oakwood'
    )

    // 7.4*112/113 + (32.9-36) = 4.2 -> 4 ; 7.4*92/113 + (29.65-34) = 1.7 -> 2
    expect(row.courseHandicaps).toEqual([4, 2])
    expect(row.teeLetter).toBe('S')
  })

  it('prints NH with no course handicaps when there is no index at all', () => {
    const row = buildCheckInSheetRow(basePlayer, courses, 's1', 'Oakwood')

    expect(row.index).toBeNull()
    expect(row.indexLabel).toBe('NH')
    expect(row.courseHandicaps).toEqual([null, null])
  })

  it('falls back to the seed handicap and flags it as estimated', () => {
    const row = buildCheckInSheetRow(
      { ...basePlayer, seedHandicap: 12 },
      courses,
      's1',
      'Oakwood'
    )

    expect(row.isEstimated).toBe(true)
    expect(row.indexLabel).toBe('12.0')
  })

  it('prefers a real record over the seed handicap', () => {
    const row = buildCheckInSheetRow(
      { ...basePlayer, seedHandicap: 12, handicapRecords: [{ courseDifferential: 9.4 }] },
      courses,
      's1',
      'Oakwood'
    )

    expect(row.isEstimated).toBe(false)
    // single differential, WHS 1-3 round rule applies -2.0
    expect(row.indexLabel).toBe('7.4')
  })

  it('marks a player without the week venue as a guest', () => {
    const row = buildCheckInSheetRow(basePlayer, courses, 's1', 'Ironwood')

    expect(row.isMember).toBe(false)
  })

  it('marks a player with the week venue as a member', () => {
    expect(buildCheckInSheetRow(basePlayer, courses, 's1', 'Oakwood').isMember).toBe(true)
  })

  // No course on the week means no venue, so we cannot claim anyone is a member.
  it('treats everyone as a guest when the week has no venue', () => {
    expect(buildCheckInSheetRow(basePlayer, courses, 's1', null).isMember).toBe(false)
  })

  it('sorts the opponents it is handed', () => {
    const row = buildCheckInSheetRow(basePlayer, courses, 's1', 'Oakwood', [
      { name: 'Wagner', count: 1 },
      { name: 'Clay', count: 2 }
    ])

    expect(row.opponents.map((opponent) => opponent.name)).toEqual(['Clay', 'Wagner'])
  })
})

describe('buildCheckInSheetRow venue set', () => {
  const courses = [
    {
      nineHolePar: 36,
      nineHoleRating: 33.7,
      nineHoleSlope: 118,
      tees: [
        { color: 'white' as const, gender: 'man' as const, nineHolePar: 36, nineHoleRating: 33.7, nineHoleSlope: 118 }
      ]
    }
  ]

  // Regression guard: the row must expose EVERY club the player belongs to.
  // The membership editor replaces the whole set on save, so a row that only
  // knew about today's venue would silently wipe the player's other clubs.
  it('carries every venue the player belongs to, not just today.s', () => {
    const row = buildCheckInSheetRow(
      {
        id: 'p1',
        name: 'Stein Ericsson',
        gender: 'man',
        defaultTeeColor: null,
        seedHandicap: 7.4,
        handicapRecords: [],
        seasonTeeChoices: [],
        venueMemberships: [{ venue: 'Oakwood' }, { venue: 'Ironwood' }]
      },
      courses,
      's1',
      'Oakwood'
    )

    expect(row.isMember).toBe(true)
    expect(row.venues).toEqual(['Oakwood', 'Ironwood'])
  })
})

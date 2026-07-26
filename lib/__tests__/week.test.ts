import { beforeEach, describe, expect, it, vi } from 'vitest'

const { findFirstMock } = vi.hoisted(() => ({
  findFirstMock: vi.fn()
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    week: {
      findFirst: findFirstMock
    }
  }
}))

import { buildOpponentCounts, getNextScheduledWeekRecord, isWeekOverdue } from '@/lib/week'

describe('week helpers', () => {
  beforeEach(() => {
    findFirstMock.mockReset()
    process.env.DATABASE_URL = 'postgres://example.test/silicondesert'
  })

  it('treats prior Phoenix dates as overdue', () => {
    expect(isWeekOverdue(new Date('2026-04-10T00:00:00-07:00'), '2026-04-15')).toBe(true)
    expect(isWeekOverdue(new Date('2026-04-15T00:00:00-07:00'), '2026-04-15')).toBe(false)
  })

  it('selects the earliest open week without filtering out past dates', async () => {
    findFirstMock.mockResolvedValueOnce(null)

    await getNextScheduledWeekRecord()

    expect(findFirstMock).toHaveBeenCalledTimes(1)

    const [query] = findFirstMock.mock.calls[0] ?? []
    expect(query).toMatchObject({
      include: {
        season: true
      },
      orderBy: {
        date: 'asc'
      },
      where: {
        startedAt: null,
        completedAt: null,
        locked: false,
        matches: {
          none: {}
        },
        attendance: {
          none: {
            present: true
          }
        }
      }
    })
    expect(query.where).not.toHaveProperty('date')
  })
})

describe('buildOpponentCounts', () => {
  // Mirrors Summer 2026 week 3: match 8 is Martin's live match against Tom,
  // match 9 is the threesome where Peter plays Martin's reference scorecard.
  const liveMatch = {
    player1Id: 'martin',
    player2Id: 'tom',
    player2ScorecardOnly: false,
    player1: { name: 'Martin Aldecoa' },
    player2: { name: 'Tom Sleasman' }
  }
  const referenceMatch = {
    player1Id: 'peter',
    player2Id: 'martin',
    player2ScorecardOnly: true,
    player1: { name: 'Peter Pestalozzi' },
    player2: { name: 'Martin Aldecoa' }
  }

  it('records both sides of a live match', () => {
    const { opponentCountsByPlayerId } = buildOpponentCounts([liveMatch])

    expect(opponentCountsByPlayerId.get('martin')?.get('Tom Sleasman')).toBe(1)
    expect(opponentCountsByPlayerId.get('tom')?.get('Martin Aldecoa')).toBe(1)
  })

  it('records a reference-scorecard opponent for the scorecard player only', () => {
    const { opponentCountsByPlayerId } = buildOpponentCounts([liveMatch, referenceMatch])

    expect(opponentCountsByPlayerId.get('peter')?.get('Martin Aldecoa')).toBe(1)
    expect(opponentCountsByPlayerId.get('martin')?.has('Peter Pestalozzi')).toBe(false)
    expect(Array.from(opponentCountsByPlayerId.get('martin')?.keys() ?? [])).toEqual(['Tom Sleasman'])
  })

  it('exposes reference opponents for initials disambiguation', () => {
    const { allOpponentNames } = buildOpponentCounts([referenceMatch])

    expect(Array.from(allOpponentNames)).toEqual(['Martin Aldecoa'])
  })

  it('counts a reference-scorecard pair as a repeat for warning purposes', () => {
    const { repeatCounts } = buildOpponentCounts([liveMatch, referenceMatch])

    expect(repeatCounts.get(['peter', 'martin'].sort().join(':'))).toBe(1)
    expect(repeatCounts.get(['martin', 'tom'].sort().join(':'))).toBe(1)
  })

  it('counts repeat pairings across weeks', () => {
    const { opponentCountsByPlayerId } = buildOpponentCounts([
      liveMatch,
      referenceMatch,
      referenceMatch
    ])

    expect(opponentCountsByPlayerId.get('peter')?.get('Martin Aldecoa')).toBe(2)
  })
})

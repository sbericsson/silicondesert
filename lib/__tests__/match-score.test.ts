import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  matchFindFirstMock,
  transactionMock,
  holeScoreFindManyMock,
  holeScoreFindUniqueMock,
  holeScoreUpsertMock,
  matchUpdateMock,
  handicapRecordUpsertMock,
  auditLogCreateMock,
  nextPendingMatchFindFirstMock,
  recomputeUsedInIndexMock
} = vi.hoisted(() => ({
  matchFindFirstMock: vi.fn(),
  transactionMock: vi.fn(),
  holeScoreFindManyMock: vi.fn(),
  holeScoreFindUniqueMock: vi.fn(),
  holeScoreUpsertMock: vi.fn(),
  matchUpdateMock: vi.fn(),
  handicapRecordUpsertMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
  nextPendingMatchFindFirstMock: vi.fn(),
  recomputeUsedInIndexMock: vi.fn()
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    match: {
      findFirst: (...args: unknown[]) => {
        const [query] = args

        if (
          query &&
          typeof query === 'object' &&
          'where' in query &&
          query.where &&
          typeof query.where === 'object' &&
          'createdAt' in query.where
        ) {
          return nextPendingMatchFindFirstMock(...args)
        }

        return matchFindFirstMock(...args)
      }
    },
    holeScore: {
      findMany: holeScoreFindManyMock
    },
    $transaction: transactionMock
  }
}))

vi.mock('@/lib/handicap-records', () => ({
  recomputeUsedInIndex: recomputeUsedInIndexMock
}))

import { getMatchScorePageData, submitMatchScores } from '@/lib/match-score'

function buildScores(scores: number[]) {
  return scores.map((grossScore, index) => ({
    holeNumber: index + 1,
    grossScore
  }))
}

describe('submitMatchScores', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = 'postgres://example.test/silicondesert'

    matchFindFirstMock.mockReset()
    transactionMock.mockReset()
    holeScoreFindManyMock.mockReset()
    holeScoreFindUniqueMock.mockReset()
    holeScoreUpsertMock.mockReset()
    matchUpdateMock.mockReset()
    handicapRecordUpsertMock.mockReset()
    auditLogCreateMock.mockReset()
    nextPendingMatchFindFirstMock.mockReset()
    recomputeUsedInIndexMock.mockReset()

    holeScoreFindUniqueMock.mockResolvedValue(null)
    holeScoreUpsertMock.mockResolvedValue(null)
    matchUpdateMock.mockResolvedValue(null)
    handicapRecordUpsertMock.mockResolvedValue(null)
    auditLogCreateMock.mockResolvedValue(null)
    recomputeUsedInIndexMock.mockResolvedValue(undefined)
    nextPendingMatchFindFirstMock.mockResolvedValue(null)
    holeScoreFindManyMock.mockResolvedValue([])

    transactionMock.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        holeScore: {
          findUnique: holeScoreFindUniqueMock,
          upsert: holeScoreUpsertMock
        },
        match: {
          update: matchUpdateMock
        },
        handicapRecord: {
          upsert: handicapRecordUpsertMock
        },
        auditLog: {
          create: auditLogCreateMock
        }
      })
    )
  })

  it('recalculates and persists the edited match outcome', async () => {
    const matchRecord = {
      id: 'match-1',
      weekId: 'week-1',
      player1Id: 'p1',
      player2Id: 'p2',
      player1HandicapIndex: 0,
      player2HandicapIndex: 0,
      player1PlayingHandicap: 0,
      player2PlayingHandicap: 0,
      player1TeeOverrideColor: null,
      player2TeeOverrideColor: null,
      player2ScorecardOnly: false,
      locked: true,
      createdAt: new Date('2026-04-10T17:00:00.000Z'),
      week: {
        season: {
          id: 'season-1',
          archivedAt: null
        },
        date: new Date('2026-04-10T00:00:00.000Z'),
        handicapMode: 'index',
        locked: true,
        attendance: [
          { playerId: 'p1', present: true },
          { playerId: 'p2', present: true }
        ],
        course: {
          nineHolePar: 36,
          nineHoleRating: 36,
          nineHoleSlope: 113,
          tees: [
            {
              color: 'blue',
              gender: 'man',
              nineHolePar: 36,
              nineHoleRating: 36,
              nineHoleSlope: 113
            }
          ],
          holes: Array.from({ length: 9 }, (_, index) => ({
            holeNumber: index + 1,
            par: 4,
            strokeIndex: index + 1
          }))
        }
      },
      player1: {
        id: 'p1',
        name: 'Player One',
        gender: 'man',
        defaultTeeColor: 'blue',
        seedHandicap: 0,
        seasonTeeChoices: [],
        handicapRecords: [
          {
            weekId: 'previous-week',
            date: new Date('2026-04-03T00:00:00.000Z'),
            courseDifferential: 0
          }
        ]
      },
      player2: {
        id: 'p2',
        name: 'Player Two',
        gender: 'man',
        defaultTeeColor: 'blue',
        seedHandicap: 0,
        seasonTeeChoices: [],
        handicapRecords: [
          {
            weekId: 'previous-week',
            date: new Date('2026-04-03T00:00:00.000Z'),
            courseDifferential: 0
          }
        ]
      }
    }

    matchFindFirstMock.mockResolvedValueOnce(matchRecord).mockResolvedValueOnce(null)

    const result = await submitMatchScores({
      weekId: 'week-1',
      matchId: 'match-1',
      player1Scores: buildScores([4, 4, 4, 4, 4, 4, 4, 4, 4]),
      player2Scores: buildScores([5, 5, 5, 5, 5, 5, 5, 5, 5])
    })

    expect(matchUpdateMock).toHaveBeenCalledWith({
      where: { id: 'match-1' },
      data: {
        strokeWinnerId: 'p1',
        matchPlayLeadBy: 5,
        matchPlayHolesRemaining: 4,
        matchPlayWinnerId: 'p1'
      }
    })

    expect(result.match).toEqual({
      id: 'match-1',
      strokeWinnerId: 'p1',
      matchPlayLeadBy: 5,
      matchPlayHolesRemaining: 4,
      matchPlayWinnerId: 'p1'
    })
    expect(result.pointsSummary.player1Points).toBe(5)
    expect(result.pointsSummary.player2Points).toBe(1)
    expect(holeScoreUpsertMock).toHaveBeenCalledTimes(18)
    expect(handicapRecordUpsertMock).toHaveBeenCalledTimes(2)
    expect(recomputeUsedInIndexMock).toHaveBeenCalledTimes(2)
  })

  it('uses rounded handicap index strokes for adjusted gross instead of course handicap', async () => {
    const matchRecord = {
      id: 'match-1',
      weekId: 'week-1',
      player1Id: 'p1',
      player2Id: 'p2',
      player1HandicapIndex: 12,
      player2HandicapIndex: 12,
      player1PlayingHandicap: 12,
      player2PlayingHandicap: 12,
      player1TeeOverrideColor: null,
      player2TeeOverrideColor: null,
      player2ScorecardOnly: false,
      locked: true,
      createdAt: new Date('2026-04-10T17:00:00.000Z'),
      week: {
        season: {
          id: 'season-1',
          archivedAt: null
        },
        date: new Date('2026-04-10T00:00:00.000Z'),
        handicapMode: 'index',
        locked: true,
        attendance: [
          { playerId: 'p1', present: true },
          { playerId: 'p2', present: true }
        ],
        course: {
          nineHolePar: 36,
          nineHoleRating: 36,
          nineHoleSlope: 150,
          tees: [
            {
              color: 'blue',
              gender: 'man',
              nineHolePar: 36,
              nineHoleRating: 36,
              nineHoleSlope: 150
            }
          ],
          holes: Array.from({ length: 9 }, (_, index) => ({
            holeNumber: index + 1,
            par: 4,
            strokeIndex: index + 1
          }))
        }
      },
      player1: {
        id: 'p1',
        name: 'Player One',
        gender: 'man',
        defaultTeeColor: 'blue',
        seedHandicap: 0,
        seasonTeeChoices: [],
        handicapRecords: [
          {
            weekId: 'previous-week',
            date: new Date('2026-04-03T00:00:00.000Z'),
            courseDifferential: 14
          }
        ]
      },
      player2: {
        id: 'p2',
        name: 'Player Two',
        gender: 'man',
        defaultTeeColor: 'blue',
        seedHandicap: 0,
        seasonTeeChoices: [],
        handicapRecords: [
          {
            weekId: 'previous-week',
            date: new Date('2026-04-03T00:00:00.000Z'),
            courseDifferential: 14
          }
        ]
      }
    }

    matchFindFirstMock.mockResolvedValueOnce(matchRecord).mockResolvedValueOnce(null)

    await submitMatchScores({
      weekId: 'week-1',
      matchId: 'match-1',
      player1Scores: buildScores([4, 4, 4, 8, 4, 4, 4, 4, 4]),
      player2Scores: buildScores([4, 4, 4, 8, 4, 4, 4, 4, 4])
    })

    expect(handicapRecordUpsertMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        update: expect.objectContaining({
          adjustedGrossScore: 39,
          courseDifferential: 2.3
        }),
        create: expect.objectContaining({
          adjustedGrossScore: 39,
          courseDifferential: 2.3
        })
      })
    )
  })

  it('scores a first-time player from a provisional first-round handicap', async () => {
    const matchRecord = {
      id: 'match-1',
      weekId: 'week-1',
      player1Id: 'p1',
      player2Id: 'p2',
      player1HandicapIndex: 0,
      player2HandicapIndex: 0,
      player1PlayingHandicap: 0,
      player2PlayingHandicap: 0,
      player1TeeOverrideColor: null,
      player2TeeOverrideColor: null,
      player2ScorecardOnly: false,
      locked: true,
      createdAt: new Date('2026-04-10T17:00:00.000Z'),
      week: {
        season: {
          id: 'season-1',
          archivedAt: null
        },
        date: new Date('2026-04-10T00:00:00.000Z'),
        handicapMode: 'index',
        locked: true,
        attendance: [
          { playerId: 'p1', present: true },
          { playerId: 'p2', present: true }
        ],
        course: {
          nineHolePar: 36,
          nineHoleRating: 36,
          nineHoleSlope: 113,
          tees: [
            {
              color: 'blue',
              gender: 'man',
              nineHolePar: 36,
              nineHoleRating: 36,
              nineHoleSlope: 113
            }
          ],
          holes: [1, 5, 4, 8, 9, 7, 6, 2, 3].map((strokeIndex, index) => ({
            holeNumber: index + 1,
            par: 4,
            strokeIndex
          }))
        }
      },
      player1: {
        id: 'p1',
        name: 'First Timer',
        gender: 'man',
        defaultTeeColor: 'blue',
        seedHandicap: 0,
        seasonTeeChoices: [],
        handicapRecords: [
          {
            weekId: 'week-1',
            date: new Date('2026-04-10T00:00:00.000Z'),
            courseDifferential: 18
          },
          {
            weekId: 'week-2',
            date: new Date('2026-04-17T00:00:00.000Z'),
            courseDifferential: 16
          }
        ]
      },
      player2: {
        id: 'p2',
        name: 'Scratch Player',
        gender: 'man',
        defaultTeeColor: 'blue',
        seedHandicap: 0,
        seasonTeeChoices: [],
        handicapRecords: [
          {
            weekId: 'previous-week',
            date: new Date('2026-04-03T00:00:00.000Z'),
            courseDifferential: 0
          }
        ]
      }
    }

    matchFindFirstMock.mockResolvedValueOnce(matchRecord).mockResolvedValueOnce(null)

    const result = await submitMatchScores({
      weekId: 'week-1',
      matchId: 'match-1',
      player1Scores: buildScores([7, 7, 6, 6, 6, 6, 6, 6, 6]),
      player2Scores: buildScores([4, 5, 5, 5, 5, 5, 5, 5, 5])
    })

    expect(matchUpdateMock).toHaveBeenCalledWith({
      where: { id: 'match-1' },
      data: {
        player1HandicapIndex: 18,
        player1PlayingHandicap: 18,
        strokeWinnerId: 'p1',
        matchPlayLeadBy: 4,
        matchPlayHolesRemaining: 2,
        matchPlayWinnerId: 'p1'
      }
    })

    expect(result.match).toEqual({
      id: 'match-1',
      strokeWinnerId: 'p1',
      matchPlayLeadBy: 4,
      matchPlayHolesRemaining: 2,
      matchPlayWinnerId: 'p1'
    })
    expect(result.pointsSummary.player1Points).toBe(5)
    expect(result.pointsSummary.player2Points).toBe(1)
  })

  it('uses provisional rounded index strokes for first-round adjusted gross', async () => {
    const matchRecord = {
      id: 'match-1',
      weekId: 'week-1',
      player1Id: 'p1',
      player2Id: 'p2',
      player1HandicapIndex: 0,
      player2HandicapIndex: 0,
      player1PlayingHandicap: 0,
      player2PlayingHandicap: 0,
      player1TeeOverrideColor: null,
      player2TeeOverrideColor: null,
      player2ScorecardOnly: false,
      locked: true,
      createdAt: new Date('2026-04-10T17:00:00.000Z'),
      week: {
        season: {
          id: 'season-1',
          archivedAt: null
        },
        date: new Date('2026-04-10T00:00:00.000Z'),
        handicapMode: 'index',
        locked: true,
        attendance: [
          { playerId: 'p1', present: true },
          { playerId: 'p2', present: true }
        ],
        course: {
          nineHolePar: 36,
          nineHoleRating: 36,
          nineHoleSlope: 113,
          tees: [
            {
              color: 'blue',
              gender: 'man',
              nineHolePar: 36,
              nineHoleRating: 36,
              nineHoleSlope: 113
            }
          ],
          holes: Array.from({ length: 9 }, (_, index) => ({
            holeNumber: index + 1,
            par: 4,
            strokeIndex: index + 1
          }))
        }
      },
      player1: {
        id: 'p1',
        name: 'First Timer One',
        gender: 'man',
        defaultTeeColor: 'blue',
        seedHandicap: 0,
        seasonTeeChoices: [],
        handicapRecords: []
      },
      player2: {
        id: 'p2',
        name: 'First Timer Two',
        gender: 'man',
        defaultTeeColor: 'blue',
        seedHandicap: 0,
        seasonTeeChoices: [],
        handicapRecords: []
      }
    }

    matchFindFirstMock.mockResolvedValueOnce(matchRecord).mockResolvedValueOnce(null)

    await submitMatchScores({
      weekId: 'week-1',
      matchId: 'match-1',
      player1Scores: buildScores([12, 6, 6, 6, 6, 6, 6, 6, 6]),
      player2Scores: buildScores([12, 6, 6, 6, 6, 6, 6, 6, 6])
    })

    expect(matchUpdateMock).toHaveBeenCalledWith({
      where: { id: 'match-1' },
      data: {
        player1HandicapIndex: 22,
        player1PlayingHandicap: 22,
        player2HandicapIndex: 22,
        player2PlayingHandicap: 22,
        strokeWinnerId: null,
        matchPlayLeadBy: 0,
        matchPlayHolesRemaining: 0,
        matchPlayWinnerId: null
      }
    })
    expect(handicapRecordUpsertMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        update: expect.objectContaining({
          adjustedGrossScore: 57,
          courseDifferential: 21
        }),
        create: expect.objectContaining({
          adjustedGrossScore: 57,
          courseDifferential: 21
        })
      })
    )
  })

  it('displays first-round adjusted gross from back-calculated handicap on historical edits', async () => {
    const matchRecord = {
      id: 'match-1',
      weekId: 'week-1',
      player1Id: 'p1',
      player2Id: 'p2',
      player1HandicapIndex: 0,
      player2HandicapIndex: 0,
      player1PlayingHandicap: 0,
      player2PlayingHandicap: 0,
      player1TeeOverrideColor: null,
      player2TeeOverrideColor: null,
      matchPlayLeadBy: 3,
      matchPlayHolesRemaining: 2,
      matchPlayWinnerId: 'p2',
      player2ScorecardOnly: false,
      locked: true,
      createdAt: new Date('2026-04-10T17:00:00.000Z'),
      week: {
        id: 'week-1',
        weekNumber: 1,
        ctpHoleNumber: null,
        completedAt: new Date('2026-04-12T00:00:00.000Z'),
        season: {
          id: 'season-1',
          name: 'Spring 2026',
          archivedAt: null
        },
        date: new Date('2026-04-10T00:00:00.000Z'),
        handicapMode: 'index',
        locked: true,
        attendance: [
          { playerId: 'p1', present: true },
          { playerId: 'p2', present: true }
        ],
        course: {
          name: 'Test Course',
          nineHolePar: 36,
          nineHoleRating: 36,
          nineHoleSlope: 113,
          tees: [
            {
              color: 'blue',
              gender: 'man',
              nineHolePar: 36,
              nineHoleRating: 36,
              nineHoleSlope: 113
            }
          ],
          holes: [1, 5, 4, 8, 9, 7, 6, 2, 3].map((strokeIndex, index) => ({
            holeNumber: index + 1,
            par: 4,
            strokeIndex
          }))
        }
      },
      player1: {
        id: 'p1',
        name: 'Rebecca McCarter',
        gender: 'man',
        defaultTeeColor: 'blue',
        seedHandicap: 0,
        seasonTeeChoices: [],
        handicapRecords: [
          {
            weekId: 'week-1',
            date: new Date('2026-04-10T00:00:00.000Z'),
            courseDifferential: 8
          },
          {
            weekId: 'week-2',
            date: new Date('2026-04-17T00:00:00.000Z'),
            courseDifferential: 9
          }
        ]
      },
      player2: {
        id: 'p2',
        name: 'Chris Thornburg',
        gender: 'man',
        defaultTeeColor: 'blue',
        seedHandicap: 0,
        seasonTeeChoices: [],
        handicapRecords: [
          {
            weekId: 'week-1',
            date: new Date('2026-04-10T00:00:00.000Z'),
            courseDifferential: 12
          },
          {
            weekId: 'week-2',
            date: new Date('2026-04-17T00:00:00.000Z'),
            courseDifferential: 11
          }
        ]
      }
    }

    matchFindFirstMock.mockResolvedValueOnce(matchRecord).mockResolvedValueOnce(null)
    holeScoreFindManyMock.mockResolvedValue(
      [
        ...buildScores([5, 5, 5, 5, 5, 5, 7, 4, 5]).map((score) => ({
          ...score,
          playerId: 'p1',
          adjustedScore: score.holeNumber === 7 ? 6 : score.grossScore
        })),
        ...buildScores([5, 6, 6, 6, 6, 6, 6, 5, 9]).map((score) => ({
          ...score,
          playerId: 'p2',
          adjustedScore: score.holeNumber === 9 ? 6 : score.grossScore
        }))
      ]
    )

    const result = await getMatchScorePageData('week-1', 'match-1')

    expect(result?.rows.find((row) => row.holeNumber === 7)?.player1Adj).toBe(7)
    expect(result?.rows.find((row) => row.holeNumber === 9)?.player2Adj).toBe(8)
  })
})

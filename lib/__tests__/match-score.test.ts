import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  matchFindFirstMock,
  transactionMock,
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
    $transaction: transactionMock
  }
}))

vi.mock('@/lib/handicap-records', () => ({
  recomputeUsedInIndex: recomputeUsedInIndexMock
}))

import { submitMatchScores } from '@/lib/match-score'

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
        handicapRecords: []
      },
      player2: {
        id: 'p2',
        name: 'Player Two',
        gender: 'man',
        defaultTeeColor: 'blue',
        seedHandicap: 0,
        seasonTeeChoices: [],
        handicapRecords: []
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
})

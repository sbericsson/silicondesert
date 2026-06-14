import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'

export const HANDICAP_RECORDS_INCLUDE = {
  where: { countsForHandicap: true },
  orderBy: { date: 'desc' as const },
  take: 20
} satisfies Prisma.Player$handicapRecordsArgs

const WHS_LOOKUP: Record<number, number> = {
  1: 1,
  2: 1,
  3: 1,
  4: 1,
  5: 1,
  6: 2,
  7: 2,
  8: 2,
  9: 3,
  10: 3,
  11: 3,
  12: 4,
  13: 4,
  14: 4,
  15: 5,
  16: 5,
  17: 6,
  18: 6,
  19: 7,
  20: 8
}

interface HandicapRecordTx {
  handicapRecord: {
    findMany: typeof prisma.handicapRecord.findMany
    updateMany: typeof prisma.handicapRecord.updateMany
  }
}

export async function recomputeUsedInIndex(tx: HandicapRecordTx, playerId: string) {
  const records = await tx.handicapRecord.findMany({
    where: { playerId, ...HANDICAP_RECORDS_INCLUDE.where },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }]
  })

  const recent = records.slice(-20)
  const useCount = WHS_LOOKUP[Math.min(recent.length, 20)] ?? 0
  const selectedIds = new Set(
    [...recent]
      .sort((a, b) => {
        if (a.courseDifferential !== b.courseDifferential) {
          return a.courseDifferential - b.courseDifferential
        }

        return a.date.getTime() - b.date.getTime()
      })
      .slice(0, useCount)
      .map((record) => record.id)
  )

  const selectedIdList = [...selectedIds]

  await Promise.all([
    tx.handicapRecord.updateMany({
      where: {
        playerId,
        id: {
          in: selectedIdList
        }
      },
      data: { usedInIndex: true }
    }),
    tx.handicapRecord.updateMany({
      where: {
        playerId,
        id: {
          notIn: selectedIdList
        }
      },
      data: { usedInIndex: false }
    })
  ])
}

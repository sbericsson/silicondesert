import { prisma } from '@/lib/db'

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

interface HandicapRecordTx {
  handicapRecord: {
    findMany: typeof prisma.handicapRecord.findMany
    updateMany: typeof prisma.handicapRecord.updateMany
  }
}

export async function recomputeUsedInIndex(tx: HandicapRecordTx, playerId: string) {
  const records = await tx.handicapRecord.findMany({
    where: { playerId },
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

  await tx.handicapRecord.updateMany({
    where: { playerId },
    data: { usedInIndex: false }
  })

  if (selectedIds.size > 0) {
    await tx.handicapRecord.updateMany({
      where: {
        id: {
          in: [...selectedIds]
        }
      },
      data: { usedInIndex: true }
    })
  }
}

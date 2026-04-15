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

import { getNextScheduledWeekRecord, isWeekOverdue } from '@/lib/week'

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

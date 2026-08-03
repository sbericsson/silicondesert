import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { findManyMock, findUniqueMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  findUniqueMock: vi.fn()
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    week: {
      findMany: findManyMock,
      findUnique: findUniqueMock
    }
  }
}))

import { resolvePublicWeekRouteParam } from '@/lib/public-week-route'

const originalDatabaseUrl = process.env.DATABASE_URL

describe('resolvePublicWeekRouteParam', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = 'postgresql://test'
    findManyMock.mockReset()
    findUniqueMock.mockReset()
  })

  afterAll(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl
    }
  })

  it('resolves a date slug without exposing the internal week ID', async () => {
    const date = new Date('2026-07-31T07:00:00.000Z')
    findManyMock.mockResolvedValue([{ id: 'internal-week-id', date }])

    await expect(resolvePublicWeekRouteParam('2026-07-31')).resolves.toEqual({
      id: 'internal-week-id',
      date,
      dateSlug: '2026-07-31',
      publicPath: '/public/weeks/2026-07-31'
    })
    expect(findUniqueMock).not.toHaveBeenCalled()
  })

  it('resolves an existing opaque ID to its canonical dated path', async () => {
    const date = new Date('2026-07-31T07:00:00.000Z')
    findUniqueMock.mockResolvedValue({ id: 'legacy-id', date })

    await expect(resolvePublicWeekRouteParam('legacy-id')).resolves.toMatchObject({
      id: 'legacy-id',
      dateSlug: '2026-07-31',
      publicPath: '/public/weeks/2026-07-31'
    })
    expect(findManyMock).not.toHaveBeenCalled()
  })

  it('refuses an ambiguous calendar date', async () => {
    findManyMock.mockResolvedValue([
      { id: 'spring-week', date: new Date('2026-07-31T07:00:00.000Z') },
      { id: 'summer-week', date: new Date('2026-07-31T12:00:00.000Z') }
    ])

    await expect(resolvePublicWeekRouteParam('2026-07-31')).resolves.toBeNull()
  })
})

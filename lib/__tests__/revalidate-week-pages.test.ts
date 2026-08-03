import { describe, expect, it, vi } from 'vitest'

const revalidatePathMock = vi.hoisted(() => vi.fn())

vi.mock('next/cache', () => ({
  revalidatePath: revalidatePathMock
}))

import { revalidateWeekPages } from '@/lib/revalidate-week-pages'

describe('revalidateWeekPages', () => {
  it('revalidates commissioner and public score-dependent pages', () => {
    revalidatePathMock.mockReset()

    revalidateWeekPages('week-123')

    expect(revalidatePathMock).toHaveBeenCalledTimes(7)
    expect(revalidatePathMock).toHaveBeenNthCalledWith(1, '/history')
    expect(revalidatePathMock).toHaveBeenNthCalledWith(2, '/public/week')
    expect(revalidatePathMock).toHaveBeenNthCalledWith(3, '/public/standings')
    expect(revalidatePathMock).toHaveBeenNthCalledWith(4, '/public/schedule')
    expect(revalidatePathMock).toHaveBeenNthCalledWith(5, '/public/weeks/[id]', 'page')
    expect(revalidatePathMock).toHaveBeenNthCalledWith(6, '/public/weeks/[id]/print', 'page')
    expect(revalidatePathMock).toHaveBeenNthCalledWith(7, '/public/weeks/[id]/matches/[matchId]', 'page')
  })
})

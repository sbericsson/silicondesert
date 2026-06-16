import { describe, expect, it } from 'vitest'
import { getWeeklyTrailingPlayerId } from '@/lib/week-commissioner'

describe('getWeeklyTrailingPlayerId', () => {
  it('prefers the configured default trailing player when checked in', () => {
    expect(
      getWeeklyTrailingPlayerId(
        [
          { playerId: 'jack' },
          { playerId: 'trailing' },
          { playerId: 'kelly' }
        ],
        'kelly',
        'trailing'
      )
    ).toBe('trailing')
  })

  it('uses the selected weekly commissioner when the default trailing player is absent', () => {
    expect(
      getWeeklyTrailingPlayerId(
        [
          { playerId: 'jack' },
          { playerId: 'kelly' }
        ],
        'kelly',
        'trailing'
      )
    ).toBe('kelly')
  })

  it('returns null when neither the default nor selected commissioner is checked in', () => {
    expect(
      getWeeklyTrailingPlayerId(
        [{ playerId: 'jack' }],
        'kelly',
        'trailing'
      )
    ).toBeNull()
  })

  it('uses the selected weekly commissioner when no default trailing player is configured', () => {
    expect(
      getWeeklyTrailingPlayerId(
        [{ playerId: 'kelly' }],
        'kelly',
        null
      )
    ).toBe('kelly')
  })

  it('falls back to Peter Pestalozzi by name when no default trailing player is configured', () => {
    expect(
      getWeeklyTrailingPlayerId(
        [
          { playerId: 'kelly', player: { name: 'Kelly Fogg' } },
          { playerId: 'peter', player: { name: 'Peter Pestalozzi' } }
        ],
        'kelly',
        null
      )
    ).toBe('peter')
  })
})

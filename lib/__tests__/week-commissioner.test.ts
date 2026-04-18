import { describe, expect, it } from 'vitest'
import { getWeeklyTrailingPlayerId } from '@/lib/week-commissioner'

describe('getWeeklyTrailingPlayerId', () => {
  it('prefers Peter when he is checked in', () => {
    expect(
      getWeeklyTrailingPlayerId(
        [
          { playerId: 'jack', player: { name: 'Jack Higgins' } },
          { playerId: 'peter', player: { name: 'Peter Pestalozzi' } },
          { playerId: 'kelly', player: { name: 'Kelly Fogg' } }
        ],
        'kelly'
      )
    ).toBe('peter')
  })

  it('uses the selected weekly commissioner when Peter is absent', () => {
    expect(
      getWeeklyTrailingPlayerId(
        [
          { playerId: 'jack', player: { name: 'Jack Higgins' } },
          { playerId: 'kelly', player: { name: 'Kelly Fogg' } }
        ],
        'kelly'
      )
    ).toBe('kelly')
  })

  it('returns null when neither Peter nor the selected commissioner is checked in', () => {
    expect(
      getWeeklyTrailingPlayerId(
        [{ playerId: 'jack', player: { name: 'Jack Higgins' } }],
        'kelly'
      )
    ).toBeNull()
  })
})

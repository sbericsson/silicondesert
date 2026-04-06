import { describe, expect, it } from 'vitest'
import { generatePairings } from '@/lib/matchmaking'

describe('generatePairings', () => {
  it('returns disjoint matches for an even player count', () => {
    const result = generatePairings(
      [
        { id: 'a', name: 'A', handicapIndex: 5, checkInOrder: 1 },
        { id: 'b', name: 'B', handicapIndex: 6, checkInOrder: 2 },
        { id: 'c', name: 'C', handicapIndex: 15, checkInOrder: 3 },
        { id: 'd', name: 'D', handicapIndex: 16, checkInOrder: 4 }
      ],
      []
    )

    const ids = new Set(result.matches.flatMap((match) => [match.player1.id, match.player2.id]))
    expect(ids.size).toBe(4)
    expect(result.threesome).toBeNull()
  })

  it('creates a threesome for an odd player count with the last arrival as pivot', () => {
    const result = generatePairings(
      [
        { id: 'a', name: 'A', handicapIndex: 5, checkInOrder: 1 },
        { id: 'b', name: 'B', handicapIndex: 6, checkInOrder: 2 },
        { id: 'c', name: 'C', handicapIndex: 7, checkInOrder: 3 },
        { id: 'd', name: 'D', handicapIndex: 8, checkInOrder: 4 },
        { id: 'e', name: 'E', handicapIndex: 9, checkInOrder: 5 }
      ],
      []
    )

    expect(result.threesome?.pivot.id).toBe('e')
  })

  it('keeps Peter Pestalozzi in the final standard pairing when checked in', () => {
    const result = generatePairings(
      [
        { id: 'a', name: 'A', handicapIndex: 5, checkInOrder: 1 },
        { id: 'b', name: 'B', handicapIndex: 6, checkInOrder: 2 },
        { id: 'peter', name: 'Peter Pestalozzi', handicapIndex: 7, checkInOrder: 3 },
        { id: 'd', name: 'D', handicapIndex: 8, checkInOrder: 4 }
      ],
      [],
      { trailingPlayerId: 'peter' }
    )

    expect(result.threesome).toBeNull()
    expect(result.matches.at(-1)?.player1.id).toBe('peter')
  })

  it('keeps Peter Pestalozzi as the threesome pivot when checked in with an odd group', () => {
    const result = generatePairings(
      [
        { id: 'a', name: 'A', handicapIndex: 5, checkInOrder: 1 },
        { id: 'b', name: 'B', handicapIndex: 6, checkInOrder: 2 },
        { id: 'c', name: 'C', handicapIndex: 7, checkInOrder: 3 },
        { id: 'd', name: 'D', handicapIndex: 8, checkInOrder: 4 },
        { id: 'peter', name: 'Peter Pestalozzi', handicapIndex: 9, checkInOrder: 5 }
      ],
      [],
      { trailingPlayerId: 'peter' }
    )

    expect(result.threesome?.pivot.id).toBe('peter')
  })

  it('uses the closer live opponent as the reference scorecard in a Peter threesome', () => {
    const result = generatePairings(
      [
        { id: 'jack', name: 'Jack Higgins', handicapIndex: 9.2, checkInOrder: 1 },
        { id: 'kristen', name: 'Kristen Amen', handicapIndex: 17.3, checkInOrder: 2 },
        { id: 'peter', name: 'Peter Pestalozzi', handicapIndex: 0.8, checkInOrder: 3 }
      ],
      [],
      { trailingPlayerId: 'peter' }
    )

    expect(result.threesome?.pivot.id).toBe('peter')
    expect(result.threesome?.matchA.player2.id).toBe('jack')
    expect(result.threesome?.matchBRef.player.id).toBe('kristen')
    expect(result.threesome?.matchBRef.referencePlayer.id).toBe('jack')
  })
})

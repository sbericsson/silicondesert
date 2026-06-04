import { describe, expect, it } from 'vitest'
import { buildPairingFlags, generatePairings } from '@/lib/matchmaking'

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

  it('spreads standard matches instead of sending the lowest handicap group first', () => {
    const result = generatePairings(
      [
        { id: 'a', name: 'A', handicapIndex: 1, checkInOrder: 1 },
        { id: 'b', name: 'B', handicapIndex: 2, checkInOrder: 2 },
        { id: 'c', name: 'C', handicapIndex: 3, checkInOrder: 3 },
        { id: 'd', name: 'D', handicapIndex: 4, checkInOrder: 4 },
        { id: 'e', name: 'E', handicapIndex: 5, checkInOrder: 5 },
        { id: 'f', name: 'F', handicapIndex: 6, checkInOrder: 6 },
        { id: 'g', name: 'G', handicapIndex: 7, checkInOrder: 7 },
        { id: 'h', name: 'H', handicapIndex: 8, checkInOrder: 8 }
      ],
      []
    )

    const averageHandicaps = result.matches.map(
      (match) => (match.player1.handicapIndex + match.player2.handicapIndex) / 2
    )

    expect(averageHandicaps).toEqual([3.5, 5.5, 1.5, 7.5])
  })

  it('orders early-bird matches before standard matches', () => {
    const result = generatePairings(
      [
        { id: 'a', name: 'A', handicapIndex: 1, checkInOrder: 1, earlyBirdRequested: true },
        { id: 'b', name: 'B', handicapIndex: 2, checkInOrder: 2 },
        { id: 'c', name: 'C', handicapIndex: 3, checkInOrder: 3 },
        { id: 'd', name: 'D', handicapIndex: 4, checkInOrder: 4 },
        { id: 'e', name: 'E', handicapIndex: 5, checkInOrder: 5 },
        { id: 'f', name: 'F', handicapIndex: 6, checkInOrder: 6 },
        { id: 'g', name: 'G', handicapIndex: 7, checkInOrder: 7 },
        { id: 'h', name: 'H', handicapIndex: 8, checkInOrder: 8 }
      ],
      []
    )

    expect(result.groups[0]).toMatchObject({
      type: 'match',
      match: {
        player1: { id: 'a' },
        player2: { id: 'b' }
      }
    })
  })

  it('spreads early-bird players across more early groups', () => {
    const result = generatePairings(
      [
        { id: 'a', name: 'A', handicapIndex: 1, checkInOrder: 1, earlyBirdRequested: true },
        { id: 'b', name: 'B', handicapIndex: 2, checkInOrder: 2, earlyBirdRequested: true },
        { id: 'c', name: 'C', handicapIndex: 3, checkInOrder: 3, earlyBirdRequested: true },
        { id: 'd', name: 'D', handicapIndex: 4, checkInOrder: 4 },
        { id: 'e', name: 'E', handicapIndex: 5, checkInOrder: 5 },
        { id: 'f', name: 'F', handicapIndex: 6, checkInOrder: 6 },
        { id: 'g', name: 'G', handicapIndex: 7, checkInOrder: 7 },
        { id: 'h', name: 'H', handicapIndex: 8, checkInOrder: 8 }
      ],
      []
    )

    const earlyCounts = result.groups.map((group) => {
      if (group.type === 'threesome') {
        return 0
      }

      return Number(Boolean(group.match.player1.earlyBirdRequested)) +
        Number(Boolean(group.match.player2.earlyBirdRequested))
    })

    expect(earlyCounts).toEqual([1, 1, 1, 0])
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

  it('keeps the trailing player group last even when that player requests early', () => {
    const result = generatePairings(
      [
        { id: 'a', name: 'A', handicapIndex: 1, checkInOrder: 1, earlyBirdRequested: true },
        { id: 'b', name: 'B', handicapIndex: 2, checkInOrder: 2 },
        { id: 'c', name: 'C', handicapIndex: 3, checkInOrder: 3 },
        { id: 'd', name: 'D', handicapIndex: 4, checkInOrder: 4 },
        {
          id: 'peter',
          name: 'Peter Pestalozzi',
          handicapIndex: 5,
          checkInOrder: 5,
          earlyBirdRequested: true
        },
        { id: 'f', name: 'F', handicapIndex: 6, checkInOrder: 6 }
      ],
      [],
      { trailingPlayerId: 'peter' }
    )

    expect(result.groups.at(-1)).toMatchObject({
      type: 'match',
      match: {
        player1: { id: 'peter' }
      }
    })
  })

  it('weights Peter Pestalozzi toward a stronger final standard opponent', () => {
    const result = generatePairings(
      [
        { id: 'peter', name: 'Peter Pestalozzi', handicapIndex: 0, checkInOrder: 1 },
        { id: 'strong', name: 'Strong Player', handicapIndex: 4, checkInOrder: 2 },
        { id: 'a', name: 'A', handicapIndex: 6, checkInOrder: 3 },
        { id: 'b', name: 'B', handicapIndex: 7, checkInOrder: 4 },
        { id: 'c', name: 'C', handicapIndex: 8, checkInOrder: 5 },
        { id: 'wayne', name: 'Wayne Davis', handicapIndex: 12, checkInOrder: 6 }
      ],
      [],
      { trailingPlayerId: 'peter' }
    )

    expect(result.matches.at(-1)).toMatchObject({
      player1: { id: 'peter' },
      player2: { id: 'strong' }
    })
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

  it('reserves a stronger live opponent for a Peter Pestalozzi threesome', () => {
    const result = generatePairings(
      [
        { id: 'strong', name: 'Strong Player', handicapIndex: 2, checkInOrder: 1 },
        { id: 'strong-peer', name: 'Strong Peer', handicapIndex: 3, checkInOrder: 2 },
        { id: 'wayne', name: 'Wayne Davis', handicapIndex: 14, checkInOrder: 3 },
        { id: 'wayne-peer', name: 'Wayne Peer', handicapIndex: 15, checkInOrder: 4 },
        { id: 'peter', name: 'Peter Pestalozzi', handicapIndex: 0, checkInOrder: 5 }
      ],
      [],
      { trailingPlayerId: 'peter' }
    )

    expect(result.threesome?.matchA.player1.id).toBe('peter')
    expect(result.threesome?.matchA.player2.id).toBe('strong')
    expect(result.threesome?.matchBRef.player.id).toBe('strong-peer')
  })

  it('can order an early-bird threesome before standard matches', () => {
    const result = generatePairings(
      [
        { id: 'a', name: 'A', handicapIndex: 1, checkInOrder: 1 },
        { id: 'b', name: 'B', handicapIndex: 2, checkInOrder: 2 },
        { id: 'c', name: 'C', handicapIndex: 3, checkInOrder: 3 },
        { id: 'd', name: 'D', handicapIndex: 4, checkInOrder: 4 },
        { id: 'e', name: 'E', handicapIndex: 5, checkInOrder: 5, earlyBirdRequested: true }
      ],
      []
    )

    expect(result.groups[0]).toMatchObject({
      type: 'threesome',
      threesome: {
        pivot: { id: 'e' }
      }
    })
  })
})

describe('buildPairingFlags', () => {
  it('flags repeat pairings from prior season matches', () => {
    const flags = buildPairingFlags(
      [
        {
          player1: { id: 'a', name: 'A', handicapIndex: 5, checkInOrder: 1 },
          player2: { id: 'b', name: 'B', handicapIndex: 7, checkInOrder: 2 }
        }
      ],
      [
        { player1Id: 'b', player2Id: 'a' },
        { player1Id: 'c', player2Id: 'd' }
      ]
    )

    expect(flags).toContainEqual({
      player1Id: 'a',
      player2Id: 'b',
      type: 'repeat',
      detail: 'Played 1× this season'
    })
  })

  it('flags large handicap gaps', () => {
    const flags = buildPairingFlags(
      [
        {
          player1: { id: 'a', name: 'A', handicapIndex: 5, checkInOrder: 1 },
          player2: { id: 'b', name: 'B', handicapIndex: 12.5, checkInOrder: 2 }
        }
      ],
      []
    )

    expect(flags).toContainEqual({
      player1Id: 'a',
      player2Id: 'b',
      type: 'gap',
      detail: 'Gap: 7.5'
    })
  })
})

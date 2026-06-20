import { describe, expect, it } from 'vitest'
import { buildPairingFlags, generatePairings, generatePositioningPairings } from '@/lib/matchmaking'

const rankedPlayer = (id: string) => ({ id, name: id, handicapIndex: 10, checkInOrder: 0 })

function hasPair(
  matches: Array<{ player1: { id: string }; player2: { id: string } }>,
  player1Id: string,
  player2Id: string
) {
  return matches.some(
    (match) =>
      new Set([match.player1.id, match.player2.id]).size === 2 &&
      [match.player1.id, match.player2.id].includes(player1Id) &&
      [match.player1.id, match.player2.id].includes(player2Id)
  )
}

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

  it('uses check-in order as the standard group ordering tiebreaker', () => {
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

    const averageHandicaps = result.groups.map((group) =>
      group.type === 'match'
        ? (group.match.player1.handicapIndex + group.match.player2.handicapIndex) / 2
        : 0
    )

    expect(averageHandicaps).toEqual([1.5, 3.5, 5.5, 7.5])
  })

  it('keeps later arrivals below earlier standard groups when selecting the next pairing', () => {
    const result = generatePairings(
      [
        { id: 'early-a', name: 'Early A', handicapIndex: 1, checkInOrder: 1 },
        { id: 'early-b', name: 'Early B', handicapIndex: 2, checkInOrder: 2 },
        { id: 'middle-a', name: 'Middle A', handicapIndex: 3, checkInOrder: 3 },
        { id: 'middle-b', name: 'Middle B', handicapIndex: 4, checkInOrder: 4 },
        { id: 'late-a', name: 'Late A', handicapIndex: 5, checkInOrder: 5 },
        { id: 'late-b', name: 'Late B', handicapIndex: 6, checkInOrder: 6 }
      ],
      []
    )

    expect(result.groups[0]).toMatchObject({
      type: 'match',
      match: {
        player1: { id: 'early-a' },
        player2: { id: 'early-b' }
      }
    })
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

  it('orders all early-bird groups before standard-only groups', () => {
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

    expect(earlyCounts).toEqual([2, 1, 0, 0])
  })

  it('allows early-bird players to pair together when they are the best fit', () => {
    const result = generatePairings(
      [
        { id: 'early-a', name: 'Early A', handicapIndex: 1, checkInOrder: 1, earlyBirdRequested: true },
        { id: 'early-b', name: 'Early B', handicapIndex: 2, checkInOrder: 2, earlyBirdRequested: true },
        { id: 'high-a', name: 'High A', handicapIndex: 20, checkInOrder: 3 },
        { id: 'high-b', name: 'High B', handicapIndex: 21, checkInOrder: 4 }
      ],
      []
    )

    expect(result.groups[0]).toMatchObject({
      type: 'match',
      match: {
        player1: { id: 'early-a' },
        player2: { id: 'early-b' }
      }
    })
  })

  it('uses repeat history when choosing an early-bird opponent', () => {
    const result = generatePairings(
      [
        { id: 'early-a', name: 'Early A', handicapIndex: 1, checkInOrder: 1, earlyBirdRequested: true },
        { id: 'early-b', name: 'Early B', handicapIndex: 2, checkInOrder: 2, earlyBirdRequested: true },
        { id: 'standard-a', name: 'Standard A', handicapIndex: 4, checkInOrder: 3 },
        { id: 'standard-b', name: 'Standard B', handicapIndex: 5, checkInOrder: 4 }
      ],
      [{ player1Id: 'early-a', player2Id: 'early-b' }]
    )

    expect(result.groups[0]).toMatchObject({
      type: 'match',
      match: {
        player1: { id: 'early-a' },
        player2: { id: 'standard-a' }
      }
    })
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

  it('keeps Default Trailing in the final standard pairing when checked in', () => {
    const result = generatePairings(
      [
        { id: 'a', name: 'A', handicapIndex: 5, checkInOrder: 1 },
        { id: 'b', name: 'B', handicapIndex: 6, checkInOrder: 2 },
        { id: 'trailing', name: 'Default Trailing', handicapIndex: 7, checkInOrder: 3 },
        { id: 'd', name: 'D', handicapIndex: 8, checkInOrder: 4 }
      ],
      [],
      { trailingPlayerId: 'trailing' }
    )

    expect(result.threesome).toBeNull()
    expect(result.matches.at(-1)?.player1.id).toBe('trailing')
  })

  it('keeps the trailing player group last when that player did not request early', () => {
    const result = generatePairings(
      [
        { id: 'a', name: 'A', handicapIndex: 1, checkInOrder: 1, earlyBirdRequested: true },
        { id: 'b', name: 'B', handicapIndex: 2, checkInOrder: 2 },
        { id: 'c', name: 'C', handicapIndex: 3, checkInOrder: 3 },
        { id: 'd', name: 'D', handicapIndex: 4, checkInOrder: 4 },
        {
          id: 'trailing',
          name: 'Default Trailing',
          handicapIndex: 5,
          checkInOrder: 5
        },
        { id: 'f', name: 'F', handicapIndex: 6, checkInOrder: 6 }
      ],
      [],
      { trailingPlayerId: 'trailing' }
    )

    expect(result.groups.at(-1)).toMatchObject({
      type: 'match',
      match: {
        player1: { id: 'trailing' }
      }
    })
  })

  it('weights Default Trailing toward a stronger final standard opponent', () => {
    const result = generatePairings(
      [
        { id: 'trailing', name: 'Default Trailing', handicapIndex: 0, checkInOrder: 1 },
        { id: 'strong', name: 'Strong Player', handicapIndex: 4, checkInOrder: 2 },
        { id: 'a', name: 'A', handicapIndex: 6, checkInOrder: 3 },
        { id: 'b', name: 'B', handicapIndex: 7, checkInOrder: 4 },
        { id: 'c', name: 'C', handicapIndex: 8, checkInOrder: 5 },
        { id: 'wayne', name: 'Wayne Davis', handicapIndex: 12, checkInOrder: 6 }
      ],
      [],
      { trailingPlayerId: 'trailing' }
    )

    expect(result.matches.at(-1)).toMatchObject({
      player1: { id: 'trailing' },
      player2: { id: 'strong' }
    })
  })

  it('keeps Default Trailing as the threesome pivot when checked in with an odd group', () => {
    const result = generatePairings(
      [
        { id: 'a', name: 'A', handicapIndex: 5, checkInOrder: 1 },
        { id: 'b', name: 'B', handicapIndex: 6, checkInOrder: 2 },
        { id: 'c', name: 'C', handicapIndex: 7, checkInOrder: 3 },
        { id: 'd', name: 'D', handicapIndex: 8, checkInOrder: 4 },
        { id: 'trailing', name: 'Default Trailing', handicapIndex: 9, checkInOrder: 5 }
      ],
      [],
      { trailingPlayerId: 'trailing' }
    )

    expect(result.threesome?.pivot.id).toBe('trailing')
  })

  it('uses the closer live opponent as the reference scorecard in a default trailing player threesome', () => {
    const result = generatePairings(
      [
        { id: 'jack', name: 'Jack Higgins', handicapIndex: 9.2, checkInOrder: 1 },
        { id: 'kristen', name: 'Kristen Amen', handicapIndex: 17.3, checkInOrder: 2 },
        { id: 'trailing', name: 'Default Trailing', handicapIndex: 0.8, checkInOrder: 3 }
      ],
      [],
      { trailingPlayerId: 'trailing' }
    )

    expect(result.threesome?.pivot.id).toBe('trailing')
    expect(result.threesome?.matchA.player2.id).toBe('jack')
    expect(result.threesome?.matchBRef.player.id).toBe('kristen')
    expect(result.threesome?.matchBRef.referencePlayer.id).toBe('jack')
  })

  it('reserves a stronger live opponent for a Default Trailing threesome', () => {
    const result = generatePairings(
      [
        { id: 'strong', name: 'Strong Player', handicapIndex: 2, checkInOrder: 1 },
        { id: 'strong-peer', name: 'Strong Peer', handicapIndex: 3, checkInOrder: 2 },
        { id: 'wayne', name: 'Wayne Davis', handicapIndex: 14, checkInOrder: 3 },
        { id: 'wayne-peer', name: 'Wayne Peer', handicapIndex: 15, checkInOrder: 4 },
        { id: 'trailing', name: 'Default Trailing', handicapIndex: 0, checkInOrder: 5 }
      ],
      [],
      { trailingPlayerId: 'trailing' }
    )

    expect(result.threesome?.matchA.player1.id).toBe('trailing')
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

  it('does not strand a repeat pairing when a lower total-cost arrangement exists', () => {
    const result = generatePairings(
      [
        { id: 'gary', name: 'Gary Clinton', handicapIndex: 11, checkInOrder: 1 },
        { id: 'mike', name: 'Mike Clay', handicapIndex: 9, checkInOrder: 2 },
        { id: 'john', name: 'John Callahan', handicapIndex: 6, checkInOrder: 3 },
        { id: 'natasha', name: 'Natasha Ericsson', handicapIndex: 18, checkInOrder: 4 },
        { id: 'stein', name: 'Stein Ericsson', handicapIndex: 8, checkInOrder: 5 },
        { id: 'frank', name: 'Frank Gillern', handicapIndex: 8, checkInOrder: 6 },
        { id: 'stephen', name: 'Stephen Hart', handicapIndex: 7, checkInOrder: 7 },
        { id: 'jack', name: 'Jack Higgins', handicapIndex: 10, checkInOrder: 8 },
        { id: 'teri', name: 'Teri Hoeft', handicapIndex: 2, checkInOrder: 9 },
        { id: 'will', name: 'Will Hooke', handicapIndex: 2, checkInOrder: 10 },
        { id: 'ken', name: 'Ken Kimball', handicapIndex: 12, checkInOrder: 11 },
        { id: 'jim', name: 'Jim Sopko', handicapIndex: 14, checkInOrder: 12 },
        { id: 'tom', name: 'Tom Sleasman', handicapIndex: 4, checkInOrder: 13 },
        { id: 'chris', name: 'Chris Wozniak', handicapIndex: 12, checkInOrder: 14 },
        { id: 'trailing', name: 'Default Trailing', handicapIndex: 1, checkInOrder: 15 },
        { id: 'lisa', name: 'Lisa Aubuchon', handicapIndex: 12, checkInOrder: 16 }
      ],
      [{ player1Id: 'chris', player2Id: 'jim' }]
    )

    expect(hasPair(result.matches, 'chris', 'jim')).toBe(false)
    expect(result.flags).not.toContainEqual(
      expect.objectContaining({
        type: 'repeat'
      })
    )
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

describe('generatePositioningPairings', () => {
  it('pairs players adjacently in rank order for an even count', () => {
    const result = generatePositioningPairings(
      ['1', '2', '3', '4'].map(rankedPlayer),
      []
    )

    expect(result.threesome).toBeNull()
    expect(result.matches.map((match) => [match.player1.id, match.player2.id])).toEqual([
      ['1', '2'],
      ['3', '4']
    ])
    expect(result.groups).toHaveLength(2)
  })

  it('forms the threesome from the three lowest-ranked players for an odd count', () => {
    const result = generatePositioningPairings(
      ['1', '2', '3', '4', '5'].map(rankedPlayer),
      []
    )

    expect(result.matches.map((match) => [match.player1.id, match.player2.id])).toEqual([['1', '2']])
    expect(result.threesome).not.toBeNull()
    expect(result.threesome?.matchA.player1.id).toBe('3')
    expect(result.threesome?.matchA.player2.id).toBe('4')
    expect(result.threesome?.matchBRef.player.id).toBe('5')
    expect(result.threesome?.matchBRef.referencePlayer.id).toBe('4')
    expect(result.groups).toHaveLength(2)
  })

  it('keeps the trailing player in the final positioning match for an even count', () => {
    const result = generatePositioningPairings(
      ['1', 'trailing', '2', '3', '4', '5'].map(rankedPlayer),
      [],
      { trailingPlayerId: 'trailing' }
    )

    expect(result.threesome).toBeNull()
    expect(result.matches.at(-1)).toMatchObject({
      player1: { id: 'trailing' },
      player2: { id: '5' }
    })
    expect(result.groups.at(-1)).toMatchObject({
      type: 'match',
      match: {
        player1: { id: 'trailing' },
        player2: { id: '5' }
      }
    })
  })

  it('keeps the trailing player as the final positioning threesome pivot for an odd count', () => {
    const result = generatePositioningPairings(
      ['1', 'trailing', '2', '3', '4'].map(rankedPlayer),
      [],
      { trailingPlayerId: 'trailing' }
    )

    expect(result.matches.map((match) => [match.player1.id, match.player2.id])).toEqual([['1', '2']])
    expect(result.threesome?.pivot.id).toBe('trailing')
    expect(result.threesome?.matchA.player1.id).toBe('trailing')
    expect(result.threesome?.matchA.player2.id).toBe('3')
    expect(result.threesome?.matchBRef.player.id).toBe('4')
    expect(result.groups.at(-1)).toMatchObject({
      type: 'threesome',
      threesome: {
        pivot: { id: 'trailing' }
      }
    })
  })

  it('treats exactly three players as a single threesome', () => {
    const result = generatePositioningPairings(['1', '2', '3'].map(rankedPlayer), [])

    expect(result.matches).toHaveLength(0)
    expect(result.threesome?.matchA.player1.id).toBe('1')
    expect(result.threesome?.matchA.player2.id).toBe('2')
    expect(result.threesome?.matchBRef.player.id).toBe('3')
  })
})

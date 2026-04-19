import { describe, expect, it } from 'vitest'
import { comparePlayerNamesByLastName, getPlayerSortKey } from '@/lib/player-sort'

describe('player sort helpers', () => {
  it('sorts by last name before first name', () => {
    const names = ['Judy Wente', 'John Adams', 'Amy Wente', 'Bob Clark']

    expect([...names].sort(comparePlayerNamesByLastName)).toEqual([
      'John Adams',
      'Bob Clark',
      'Amy Wente',
      'Judy Wente'
    ])
  })

  it('keeps surname prefixes attached to the sort key', () => {
    expect(getPlayerSortKey('Ludwig van Beethoven')).toContain('van beethoven')
  })
})

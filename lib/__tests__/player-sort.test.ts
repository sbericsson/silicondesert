import { describe, expect, it } from 'vitest'
import { comparePlayerNamesByLastName, getPlayerSortKey, getPlayerSurname } from '@/lib/player-sort'

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
    expect(getPlayerSortKey('Lowell Vande Kamp')).toContain('vande kamp')
  })

  it('extracts the full surname, keeping compound-name prefixes attached', () => {
    expect(getPlayerSurname('Lowell Vande Kamp')).toBe('Vande Kamp')
    expect(getPlayerSurname('Ludwig van Beethoven')).toBe('van Beethoven')
    expect(getPlayerSurname('Bob Clark')).toBe('Clark')
    expect(getPlayerSurname('Cher')).toBe('Cher')
  })

  it('keeps a given name that happens to match a surname prefix as the given name', () => {
    expect(getPlayerSurname('Van Morrison')).toBe('Morrison')
    expect(getPlayerSortKey('Van Morrison')).toContain('morrison|van|')
  })
})

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

  it('keeps a trailing suffix attached to the surname instead of treating it as the surname', () => {
    expect(getPlayerSurname('Bob Clark Jr')).toBe('Clark Jr')
    expect(getPlayerSurname('Lowell Vande Kamp Jr')).toBe('Vande Kamp Jr')
    expect(getPlayerSurname('Ludwig van Beethoven III')).toBe('van Beethoven III')
    expect(getPlayerSortKey('Lowell Vande Kamp Jr')).toContain('vande kamp jr|lowell|')
  })

  it('does not treat a suffix-like second word as a suffix on a two-word name', () => {
    expect(getPlayerSurname('Bob Jr')).toBe('Jr')
    expect(getPlayerSortKey('Bob Jr')).toContain('jr|bob|')
  })

  it('walks past multiple chained surname prefixes', () => {
    expect(getPlayerSurname('Karl Von Der Berg')).toBe('Von Der Berg')
    expect(getPlayerSortKey('Karl Von Der Berg')).toContain('von der berg|karl|')
  })

  it('recognizes every suffix in SURNAME_SUFFIXES', () => {
    expect(getPlayerSurname('Bob Clark Sr')).toBe('Clark Sr')
    expect(getPlayerSurname('Bob Clark Sr.')).toBe('Clark Sr.')
    expect(getPlayerSurname('Bob Clark Jr.')).toBe('Clark Jr.')
    expect(getPlayerSurname('Bob Clark II')).toBe('Clark II')
    expect(getPlayerSurname('Bob Clark IV')).toBe('Clark IV')
  })
})

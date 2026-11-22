import { describe, expect, it } from 'vitest'
import { parseScoreEntry } from '../score-entry-input'

describe('score entry input', () => {
  it.each(['', ' ', '0', '21', '-1', '1.5', '1e1', '2x', 'Infinity', '99999999999999999999'])('excludes invalid entry %j from scoring', (value) => {
    expect(parseScoreEntry(value)).toBeNull()
  })

  it('accepts every server-supported score and leading zeros', () => {
    for (let score = 1; score <= 20; score++) {
      expect(parseScoreEntry(String(score))).toBe(score)
    }
    expect(parseScoreEntry('04')).toBe(4)
  })
})

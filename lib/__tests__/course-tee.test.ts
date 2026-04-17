import { describe, expect, it } from 'vitest'
import { getPlayerMatchTeeColor } from '@/lib/course-tee'

describe('getPlayerMatchTeeColor', () => {
  it('uses the match override when one is present', () => {
    expect(
      getPlayerMatchTeeColor(
        [{ seasonId: 'spring-2026', teeColor: 'blue' }],
        'spring-2026',
        'man',
        'white',
        'silver'
      )
    ).toBe('silver')
  })

  it('falls back to the season tee choice when there is no override', () => {
    expect(
      getPlayerMatchTeeColor(
        [{ seasonId: 'spring-2026', teeColor: 'blue' }],
        'spring-2026',
        'man',
        'white',
        null
      )
    ).toBe('blue')
  })
})

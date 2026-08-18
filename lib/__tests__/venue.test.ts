import { describe, expect, it } from 'vitest'
import { getCourseVenue } from '@/lib/venue'

describe('getCourseVenue', () => {
  it('takes the club half of a nine-hole course name', () => {
    expect(getCourseVenue('Oakwood - Palms')).toBe('Oakwood')
    expect(getCourseVenue('Ironwood - Front 9')).toBe('Ironwood')
  })

  it('keeps the whole name when there is no nine suffix', () => {
    expect(getCourseVenue('Papago')).toBe('Papago')
  })

  it('normalizes stray whitespace', () => {
    expect(getCourseVenue('  Oakwood   -   Lakes ')).toBe('Oakwood')
  })

  it('does not split on a hyphen that is part of the club name', () => {
    expect(getCourseVenue('Wigwam-Litchfield')).toBe('Wigwam-Litchfield')
  })
})




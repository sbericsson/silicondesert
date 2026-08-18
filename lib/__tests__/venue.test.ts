import { describe, expect, it } from 'vitest'
import {
  getCourseVenue,
  getVenuesFromCourses,
  isPlayerVenueMember,
  normalizeVenueMemberships
} from '@/lib/venue'

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

describe('getVenuesFromCourses', () => {
  it('collapses the rotation to unique clubs in alphabetical order', () => {
    const courses = [
      { name: 'Oakwood - Palms' },
      { name: 'Oakwood - Sonoran' },
      { name: 'Ironwood - Front 9' },
      { name: 'Oakwood - Lakes' },
      { name: 'Ironwood - Back 9' }
    ]

    expect(getVenuesFromCourses(courses)).toEqual(['Ironwood', 'Oakwood'])
  })
})

describe('isPlayerVenueMember', () => {
  it('matches on the venue the league is playing', () => {
    const memberships = [{ venue: 'Oakwood' }]

    expect(isPlayerVenueMember(memberships, 'Oakwood')).toBe(true)
    expect(isPlayerVenueMember(memberships, 'Ironwood')).toBe(false)
    expect(isPlayerVenueMember([], 'Oakwood')).toBe(false)
  })
})

describe('normalizeVenueMemberships', () => {
  it('rejects a non-array payload', () => {
    expect(normalizeVenueMemberships('Oakwood').error).toBe('Venue memberships must be an array')
    expect(normalizeVenueMemberships(undefined).error).toBeTruthy()
  })

  it('rejects entries that are not non-empty strings', () => {
    expect(normalizeVenueMemberships(['Oakwood', '']).error).toBe(
      'Each venue membership must be a non-empty string'
    )
    expect(normalizeVenueMemberships(['Oakwood', 42]).error).toBeTruthy()
  })

  it('trims and de-duplicates', () => {
    expect(normalizeVenueMemberships([' Oakwood ', 'Oakwood', 'Ironwood']).venues).toEqual([
      'Oakwood',
      'Ironwood'
    ])
  })

  // Clearing every membership is how the editor turns a member into a guest.
  it('accepts an empty array as "member of nothing"', () => {
    expect(normalizeVenueMemberships([]).venues).toEqual([])
  })
})

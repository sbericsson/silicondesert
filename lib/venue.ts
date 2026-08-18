/**
 * Course rows in this app are individual nines ("Oakwood - Palms",
 * "Ironwood - Front 9"), but course membership is sold by the club, not the
 * nine: a player who belongs to Oakwood is a member on Palms, Sonoran and
 * Lakes alike. Venue is the club half of the course name, and it is what
 * membership (and therefore the guest fee) is keyed on.
 */
const VENUE_SEPARATOR = ' - '

export function getCourseVenue(courseName: string) {
  const trimmed = courseName.trim().replace(/\s+/g, ' ')
  const separatorIndex = trimmed.indexOf(VENUE_SEPARATOR)

  if (separatorIndex === -1) {
    return trimmed
  }

  return trimmed.slice(0, separatorIndex)
}

export function getVenuesFromCourses(courses: Array<{ name: string }>) {
  const venues: string[] = []

  for (const course of courses) {
    const venue = getCourseVenue(course.name)
    if (venue.length > 0 && !venues.includes(venue)) {
      venues.push(venue)
    }
  }

  return venues.sort((a, b) => a.localeCompare(b, 'en-US'))
}

export function isPlayerVenueMember(memberships: Array<{ venue: string }>, venue: string) {
  return memberships.some((membership) => membership.venue === venue)
}

/**
 * Validates the `venueMemberships` payload from the player PATCH endpoint.
 * Kept here (rather than inline in the route) so the parsing rules are unit
 * tested the same way the rest of the venue logic is.
 */
export function normalizeVenueMemberships(
  value: unknown
): { error: string; venues?: undefined } | { error?: undefined; venues: string[] } {
  if (!Array.isArray(value)) {
    return { error: 'Venue memberships must be an array' }
  }

  const venues = value.flatMap((venue) =>
    typeof venue === 'string' && venue.trim().length > 0 ? [venue.trim()] : []
  )

  if (venues.length !== value.length) {
    return { error: 'Each venue membership must be a non-empty string' }
  }

  return { venues: Array.from(new Set(venues)) }
}

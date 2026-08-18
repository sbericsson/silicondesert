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




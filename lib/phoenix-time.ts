const PHOENIX_TIME_ZONE = 'America/Phoenix'

export function getPhoenixDateParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: PHOENIX_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short'
  })

  const parts = formatter.formatToParts(date)
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]))

  return {
    year: lookup.year,
    month: lookup.month,
    day: lookup.day,
    weekday: lookup.weekday,
    isoDate: `${lookup.year}-${lookup.month}-${lookup.day}`
  }
}

export function isPhoenixFriday(date = new Date()) {
  return getPhoenixDateParts(date).weekday === 'Fri'
}

export function formatPhoenixLongDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: PHOENIX_TIME_ZONE,
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  }).format(date)
}

export function formatPhoenixTimestamp(date: Date): string {
  return date.toLocaleString('en-US', {
    timeZone: PHOENIX_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

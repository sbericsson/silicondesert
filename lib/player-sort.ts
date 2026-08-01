const SURNAME_PREFIXES = new Set([
  'da',
  'de',
  'del',
  'della',
  'der',
  'di',
  'du',
  'la',
  'le',
  'st',
  'st.',
  'van',
  'vande',
  'von'
])

const SURNAME_SUFFIXES = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv'])

function getSurnameStartIndex(parts: string[]) {
  let surnameStartIndex = parts.length - 1

  // Never consume the first word: every name here is "given name(s) + surname",
  // so if the given name itself happens to match a prefix (e.g. "Van Morrison"),
  // it must stay the given name rather than being folded into the surname.
  while (surnameStartIndex > 1) {
    const candidate = parts[surnameStartIndex - 1]?.toLocaleLowerCase('en-US') ?? ''
    if (!SURNAME_PREFIXES.has(candidate)) {
      break
    }

    surnameStartIndex -= 1
  }

  return surnameStartIndex
}

// Splits "given name(s) + surname (+ suffix)" into its given/surname word
// groups, keeping a trailing suffix like "Jr" attached to the surname instead
// of letting the prefix scan mistake it for the surname itself.
function splitPlayerName(parts: string[]) {
  const lastWord = parts[parts.length - 1]?.toLocaleLowerCase('en-US') ?? ''
  const hasSuffix = parts.length > 2 && SURNAME_SUFFIXES.has(lastWord)
  const suffix = hasSuffix ? parts[parts.length - 1] : null
  const nameParts = hasSuffix ? parts.slice(0, -1) : parts

  const surnameStartIndex = getSurnameStartIndex(nameParts)
  const givenParts = nameParts.slice(0, surnameStartIndex)
  const surnameParts = nameParts.slice(surnameStartIndex)

  if (suffix) {
    surnameParts.push(suffix)
  }

  return { givenParts, surnameParts }
}

export function getPlayerSurname(name: string) {
  const normalized = name.trim().replace(/\s+/g, ' ')
  const parts = normalized.split(' ')

  if (parts.length <= 1) {
    return normalized
  }

  return splitPlayerName(parts).surnameParts.join(' ')
}

export function getPlayerSortKey(name: string) {
  const normalized = name.trim().replace(/\s+/g, ' ')
  const parts = normalized.split(' ')

  if (parts.length <= 1) {
    return normalized.toLocaleLowerCase()
  }

  const { givenParts, surnameParts } = splitPlayerName(parts)
  const surname = surnameParts.join(' ')
  const givenNames = givenParts.join(' ')

  return `${surname.toLocaleLowerCase('en-US')}|${givenNames.toLocaleLowerCase('en-US')}|${normalized.toLocaleLowerCase('en-US')}`
}

export function comparePlayerNamesByLastName(a: string, b: string) {
  return getPlayerSortKey(a).localeCompare(getPlayerSortKey(b), 'en-US')
}

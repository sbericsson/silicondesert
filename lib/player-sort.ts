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

export function getPlayerSurname(name: string) {
  const normalized = name.trim().replace(/\s+/g, ' ')
  const parts = normalized.split(' ')

  if (parts.length <= 1) {
    return normalized
  }

  return parts.slice(getSurnameStartIndex(parts)).join(' ')
}

export function getPlayerSortKey(name: string) {
  const normalized = name.trim().replace(/\s+/g, ' ')
  const parts = normalized.split(' ')

  if (parts.length <= 1) {
    return normalized.toLocaleLowerCase()
  }

  const surnameStartIndex = getSurnameStartIndex(parts)
  const surname = parts.slice(surnameStartIndex).join(' ')
  const givenNames = parts.slice(0, surnameStartIndex).join(' ')

  return `${surname.toLocaleLowerCase('en-US')}|${givenNames.toLocaleLowerCase('en-US')}|${normalized.toLocaleLowerCase('en-US')}`
}

export function comparePlayerNamesByLastName(a: string, b: string) {
  return getPlayerSortKey(a).localeCompare(getPlayerSortKey(b), 'en-US')
}

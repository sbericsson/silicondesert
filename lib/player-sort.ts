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
  'von'
])

export function getPlayerSortKey(name: string) {
  const normalized = name.trim().replace(/\s+/g, ' ')
  const parts = normalized.split(' ')

  if (parts.length <= 1) {
    return normalized.toLocaleLowerCase()
  }

  let surnameStartIndex = parts.length - 1

  while (surnameStartIndex > 0) {
    const candidate = parts[surnameStartIndex - 1]?.toLocaleLowerCase('en-US') ?? ''
    if (!SURNAME_PREFIXES.has(candidate)) {
      break
    }

    surnameStartIndex -= 1
  }

  const surname = parts.slice(surnameStartIndex).join(' ')
  const givenNames = parts.slice(0, surnameStartIndex).join(' ')

  return `${surname.toLocaleLowerCase('en-US')}|${givenNames.toLocaleLowerCase('en-US')}|${normalized.toLocaleLowerCase('en-US')}`
}

export function comparePlayerNamesByLastName(a: string, b: string) {
  return getPlayerSortKey(a).localeCompare(getPlayerSortKey(b), 'en-US')
}

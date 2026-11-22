const ALLOWED_RETURN_PREFIXES = ['/week', '/history']

// Backslashes and control characters are rewritten or stripped by browser URL
// parsing (`/\evil`, `/\t/evil` both become `//evil`), so they never belong in
// a return path.
const UNSAFE_CHARACTERS = /[\\\u0000-\u001f\u007f]/

function hasAllowedPrefix(path: string) {
  return ALLOWED_RETURN_PREFIXES.some((prefix) => {
    if (!path.startsWith(prefix)) {
      return false
    }

    const next = path.charAt(prefix.length)
    return next === '' || next === '/' || next === '?' || next === '#'
  })
}

export function getSafeReturnPath(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  if (!value.startsWith('/') || value.startsWith('//') || UNSAFE_CHARACTERS.test(value)) {
    return null
  }

  return hasAllowedPrefix(value) ? value : null
}

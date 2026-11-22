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

// Only a value the URL parser leaves exactly as written is accepted, so dot
// segments (`/week/../admin`, `/week/%2e%2e/admin`) cannot step outside the
// allowed prefixes after the browser resolves them.
const PARSE_BASE = 'http://return-path.invalid'

function isCanonicalPath(value: string) {
  try {
    const url = new URL(value, PARSE_BASE)
    return url.origin === PARSE_BASE && `${url.pathname}${url.search}${url.hash}` === value
  } catch {
    return false
  }
}

export function getSafeReturnPath(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  if (!value.startsWith('/') || value.startsWith('//') || UNSAFE_CHARACTERS.test(value)) {
    return null
  }

  return isCanonicalPath(value) && hasAllowedPrefix(value) ? value : null
}

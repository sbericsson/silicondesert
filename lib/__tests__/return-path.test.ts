import { describe, expect, it } from 'vitest'
import { getSafeReturnPath } from '@/lib/return-path'

describe('getSafeReturnPath', () => {
  it.each([
    ['/week', '/week'],
    ['/history', '/history'],
    ['/history/abc/compare', '/history/abc/compare'],
    ['/week?tab=scores', '/week?tab=scores'],
    ['/week#match-1', '/week#match-1']
  ])('accepts %j', (value, expected) => {
    expect(getSafeReturnPath(value)).toBe(expected)
  })

  it.each([
    ['protocol-relative', '//evil.example'],
    ['protocol-relative with path', '//evil.example/week'],
    ['backslash after slash', '/\\evil.example'],
    ['backslash inside path', '/week\\..\\..\\evil'],
    ['tab that browsers strip', '/\t/evil.example'],
    ['newline', '/week\n'],
    ['absolute URL', 'https://evil.example'],
    ['javascript URL', 'javascript:alert(1)'],
    ['relative path', 'week'],
    ['unlisted prefix', '/admin'],
    ['prefix lookalike', '/weekly'],
    ['dot segments out of the prefix', '/week/../admin'],
    ['encoded dot segments', '/week/%2e%2e/admin'],
    ['single dot segment', '/history/./../admin'],
    ['dot segments into a double slash', '/week/..//evil.example'],
    ['empty string', ''],
    ['array value', ['/week', '/history']],
    ['undefined', undefined],
    ['null', null]
  ])('rejects %s', (_label, value) => {
    expect(getSafeReturnPath(value)).toBeNull()
  })
})

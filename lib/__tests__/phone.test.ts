import { describe, expect, it } from 'vitest'
import { formatUsPhoneInput, formatUsPhoneNumber, normalizeUsPhoneNumber } from '@/lib/phone'

describe('phone helpers', () => {
  it('normalizes a plain 10-digit US number', () => {
    expect(normalizeUsPhoneNumber('6025551212')).toBe('6025551212')
  })

  it('accepts a leading country code and strips it', () => {
    expect(normalizeUsPhoneNumber('+1 (602) 555-1212')).toBe('6025551212')
  })

  it('rejects invalid US phone lengths', () => {
    expect(normalizeUsPhoneNumber('5551212')).toBeNull()
  })

  it('formats stored numbers for display', () => {
    expect(formatUsPhoneNumber('6025551212')).toBe('(602) 555-1212')
  })

  it('formats partially typed values for input', () => {
    expect(formatUsPhoneInput('6025551212')).toBe('(602) 555-1212')
  })
})

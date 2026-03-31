export function normalizeUsPhoneNumber(value: string | null | undefined) {
  if (!value) {
    return null
  }

  const digits = value.replace(/\D/g, '')

  if (digits.length === 0) {
    return null
  }

  if (digits.length === 10) {
    return digits
  }

  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.slice(1)
  }

  return null
}

export function formatUsPhoneNumber(value: string | null | undefined) {
  const normalized = normalizeUsPhoneNumber(value)
  if (!normalized) {
    return null
  }

  const areaCode = normalized.slice(0, 3)
  const prefix = normalized.slice(3, 6)
  const lineNumber = normalized.slice(6)
  return `(${areaCode}) ${prefix}-${lineNumber}`
}

export function formatUsPhoneInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 10)

  if (digits.length <= 3) {
    return digits
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}

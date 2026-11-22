/** Parse one raw score entry without changing what the user typed. */
export function parseScoreEntry(value: string): number | null {
  if (!/^\d+$/.test(value)) return null

  const score = Number(value)
  return Number.isSafeInteger(score) && score >= 1 && score <= 20 ? score : null
}

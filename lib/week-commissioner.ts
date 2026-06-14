type CheckedInPlayer = {
  playerId: string
}

export function getWeeklyTrailingPlayerId(
  attendance: CheckedInPlayer[],
  commissionerPlayerId: string | null,
  defaultTrailingPlayerId: string | null
) {
  if (
    defaultTrailingPlayerId &&
    attendance.some((entry) => entry.playerId === defaultTrailingPlayerId)
  ) {
    return defaultTrailingPlayerId
  }

  if (!commissionerPlayerId) {
    return null
  }

  return attendance.find((entry) => entry.playerId === commissionerPlayerId)?.playerId ?? null
}

export const FALLBACK_DEFAULT_TRAILING_PLAYER_NAME = 'Peter Pestalozzi'

type CheckedInPlayer = {
  playerId: string
  player?: {
    name: string
  }
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

  const fallbackDefaultTrailingPlayer = attendance.find(
    (entry) => entry.player?.name === FALLBACK_DEFAULT_TRAILING_PLAYER_NAME
  )
  if (fallbackDefaultTrailingPlayer) {
    return fallbackDefaultTrailingPlayer.playerId
  }

  if (!commissionerPlayerId) {
    return null
  }

  return attendance.find((entry) => entry.playerId === commissionerPlayerId)?.playerId ?? null
}

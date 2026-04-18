export const DEFAULT_TRAILING_PLAYER_NAME = 'Peter Pestalozzi'

type CheckedInPlayer = {
  playerId: string
  player: {
    name: string
  }
}

export function getWeeklyTrailingPlayerId(
  attendance: CheckedInPlayer[],
  commissionerPlayerId: string | null
) {
  const defaultTrailingPlayer = attendance.find(
    (entry) => entry.player.name === DEFAULT_TRAILING_PLAYER_NAME
  )

  if (defaultTrailingPlayer) {
    return defaultTrailingPlayer.playerId
  }

  if (!commissionerPlayerId) {
    return null
  }

  return attendance.find((entry) => entry.playerId === commissionerPlayerId)?.playerId ?? null
}

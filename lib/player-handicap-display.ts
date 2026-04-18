import { handicapIndexFromRecords } from '@/lib/handicap'

type PlayerHandicapSource = {
  seedHandicap: number | null
  handicapRecords: Array<{ courseDifferential: number }>
}

export function getPlayerHandicapDisplay(player: PlayerHandicapSource) {
  if (player.handicapRecords.length === 0 && player.seedHandicap !== null) {
    return { kind: 'EST' as const, value: player.seedHandicap.toFixed(1) }
  }

  if (player.handicapRecords.length === 0) {
    return { kind: 'NEW' as const, value: null }
  }

  const value = handicapIndexFromRecords(player.handicapRecords)

  return { kind: 'HCP' as const, value: value?.toFixed(1) ?? null }
}

export function getPlayerHandicapInlineLabel(player: PlayerHandicapSource) {
  const display = getPlayerHandicapDisplay(player)

  return display.value ?? display.kind
}

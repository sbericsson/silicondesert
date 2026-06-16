export type WeekStatusTone = 'accent' | 'warning' | 'neutral'

export type WeekStatusInfo = { label: string; tone: WeekStatusTone }

export const STATUS_CHIP_CLASSES: Record<WeekStatusTone, string> = {
  accent: 'bg-accent-dim text-accent-text',
  warning: 'bg-warning-dim text-warning-text',
  neutral: 'bg-surface-base text-text-secondary'
}

export const STATUS_DOT_CLASSES: Record<WeekStatusTone, string> = {
  accent: 'bg-accent',
  warning: 'bg-warning',
  neutral: 'bg-text-muted'
}

export function getWeekStatusChip(params: {
  locked: boolean
  allScoresComplete: boolean
}): WeekStatusInfo {
  if (params.allScoresComplete) return { label: 'Final', tone: 'accent' }
  if (params.locked) return { label: 'In progress', tone: 'warning' }
  return { label: 'Upcoming', tone: 'neutral' }
}

export function getScheduleWeekStatusTone(status: string): WeekStatusTone {
  if (status === 'Final' || status === 'Completed') return 'accent'
  if (status === 'In progress' || status === 'Today') return 'warning'
  return 'neutral'
}

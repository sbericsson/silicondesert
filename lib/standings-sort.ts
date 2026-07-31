// Shared by the commissioner comparison page (server) and the public print view
// (client). Lives outside lib/public-standings.ts on purpose: that module imports
// prisma, so a 'use client' component cannot pull from it.
export type SeasonSortKey = 'overallPoints' | 'summerPoints' | 'springPoints'

export function getSeasonSortValueClass(columnKey: SeasonSortKey, sortKey: SeasonSortKey) {
  return columnKey === sortKey ? 'font-semibold' : ''
}

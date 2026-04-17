import { prisma } from '@/lib/db'
import { getPlayerHandicapDisplay } from '@/lib/player-handicap-display'

function getPlayerSortKey(name: string) {
  const normalized = name.trim().replace(/\s+/g, ' ')
  const parts = normalized.split(' ')
  const lastName = parts.at(-1) ?? normalized
  const firstNames = parts.slice(0, -1).join(' ')
  return `${lastName.toLocaleLowerCase()}|${firstNames.toLocaleLowerCase()}|${normalized.toLocaleLowerCase()}`
}

export async function getRosterPageData() {
  if (!process.env.DATABASE_URL) {
    return {
      settings: {
        publicRosterEnabled: false
      },
      players: [],
      courses: [],
      seasons: []
    }
  }

  const [players, seasons, courses, commissioner] = await Promise.all([
    prisma.player.findMany({
      include: {
        handicapRecords: {
          orderBy: { date: 'desc' },
          take: 20
        },
        seasonTeeChoices: true
      },
      orderBy: { name: 'asc' }
    }),
    prisma.season.findMany({
      include: {
        weeks: {
          orderBy: { date: 'asc' },
          select: {
            id: true,
            date: true,
            locked: true,
            _count: {
              select: {
                attendance: true,
                matches: true,
                holeScores: true,
                handicapRecords: true
              }
            }
          }
        }
      },
      orderBy: { startDate: 'asc' }
    }),
    prisma.course.findMany({
      include: {
        tees: {
          orderBy: { color: 'asc' }
        },
        holes: {
          orderBy: { holeNumber: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    }),
    prisma.commissioner.findFirst({
      select: {
        publicRosterEnabled: true
      }
    })
  ])

  return {
    settings: {
      publicRosterEnabled: commissioner?.publicRosterEnabled ?? false
    },
    players: [...players]
      .sort((left, right) => {
        if (left.active !== right.active) {
          return left.active ? -1 : 1
        }

        return getPlayerSortKey(left.name).localeCompare(getPlayerSortKey(right.name))
      })
      .map((player) => ({
      id: player.id,
      name: player.name,
      gender: player.gender,
      defaultTeeColor: player.defaultTeeColor,
      email: player.email,
      cellPhone: player.cellPhone,
      active: player.active,
      seedHandicap: player.seedHandicap,
      seasonTeeChoices: player.seasonTeeChoices.map((choice) => ({
        seasonId: choice.seasonId,
        teeColor: choice.teeColor
      })),
      importedHandicapRounds: player.handicapRecords
        .filter((record) => record.isImported && record.weekId === null)
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .map((record) => ({
          date: record.date.toISOString().slice(0, 10),
          grossScore: record.grossScore,
          adjustedGrossScore: record.adjustedGrossScore,
          courseRating: record.courseRating,
          slopeRating: record.slopeRating,
          coursePar: record.coursePar
      })),
      handicap: getPlayerHandicapDisplay(player)
    })),
    courses: courses.map((course) => ({
      id: course.id,
      name: course.name,
      nineHolePar: course.nineHolePar,
      nineHoleRating: course.nineHoleRating,
      nineHoleSlope: course.nineHoleSlope,
      tees: course.tees.map((tee) => ({
        color: tee.color,
        gender: tee.gender,
        nineHolePar: tee.nineHolePar,
        nineHoleRating: tee.nineHoleRating,
        nineHoleSlope: tee.nineHoleSlope
      })),
      holes: course.holes.map((hole) => ({
        holeNumber: hole.holeNumber,
        par: hole.par,
        strokeIndex: hole.strokeIndex
      }))
    })),
    seasons: seasons.map((season) => ({
      id: season.id,
      name: season.name,
      type: season.type,
      weekCount: season.weeks.length,
      startDate: season.startDate.toISOString().slice(0, 10),
      endDate: season.endDate.toISOString().slice(0, 10),
      weekDates: season.weeks.map((week) => week.date.toISOString().slice(0, 10)),
      archivedAt: season.archivedAt?.toISOString() ?? null,
      hasWeekActivity: season.weeks.some(
        (week) =>
          week.locked ||
          week._count.attendance > 0 ||
          week._count.matches > 0 ||
          week._count.holeScores > 0 ||
          week._count.handicapRecords > 0
      )
    }))
  }
}

import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getPhoenixDateParts } from '@/lib/phoenix-time'
import { getPlayerHandicapDisplay } from '@/lib/player-handicap-display'
import {
  getCourseTee,
  getDefaultTeeColorForGender,
  getPlayerMatchTeeColor,
  getPlayerSeasonTeeColor
} from '@/lib/course-tee'
import { getHandicapModeLabel, getPlayerHandicapIndexValue, getPlayingHandicap } from '@/lib/playing-handicap'

function phoenixStartOfDay(isoDate: string) {
  return new Date(`${isoDate}T00:00:00-07:00`)
}

export function isWeekOverdue(date: Date, isoDate: string) {
  return date < phoenixStartOfDay(isoDate)
}

function getActiveWeekWhere() {
  return {
    season: {
      is: {
        archivedAt: null
      }
    },
    completedAt: null,
    OR: [
      {
        startedAt: {
          not: null
        }
      },
      {
        locked: true
      },
      {
        matches: {
          some: {}
        }
      },
      {
        attendance: {
          some: {
            present: true
          }
        }
      }
    ]
  } satisfies Prisma.WeekWhereInput
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date)
}

function compareNamesByLastName(a: string, b: string) {
  const aParts = a.trim().split(/\s+/)
  const bParts = b.trim().split(/\s+/)
  const aLast = aParts[aParts.length - 1]?.toLocaleLowerCase('en-US') ?? ''
  const bLast = bParts[bParts.length - 1]?.toLocaleLowerCase('en-US') ?? ''

  if (aLast !== bLast) {
    return aLast.localeCompare(bLast, 'en-US')
  }

  return a.localeCompare(b, 'en-US')
}

export function pickActiveSeason<T extends {
  id: string
  weeks: Array<{ matches: Array<{ matchPlayLeadBy: number | null }> }>
}>(seasons: T[], currentSeasonId: string | null | undefined): T | null {
  return (
    (currentSeasonId ? seasons.find((s) => s.id === currentSeasonId) : null) ??
    [...seasons]
      .reverse()
      .find((s) => s.weeks.some((w) => w.matches.some((m) => m.matchPlayLeadBy !== null))) ??
    seasons.at(-1) ??
    null
  )
}

export async function getCurrentWeekRecord() {
  if (!process.env.DATABASE_URL) {
    return null
  }

  return prisma.week.findFirst({
    where: getActiveWeekWhere(),
    include: {
      season: true,
      ctpWinner: {
        select: {
          name: true
        }
      },
      longestPuttWinner: {
        select: {
          name: true
        }
      },
      course: {
        include: {
          tees: true,
          holes: {
            orderBy: { holeNumber: 'asc' }
          }
        }
      },
      attendance: {
        include: {
          player: {
            include: {
              handicapRecords: {
                orderBy: { date: 'desc' },
                take: 20
              },
              seasonTeeChoices: true
            }
          }
        },
        orderBy: [{ present: 'desc' }, { checkedInAt: 'asc' }]
      },
      matches: {
        include: {
          player1: {
            include: {
              handicapRecords: {
                orderBy: { date: 'desc' },
                take: 20
              },
              seasonTeeChoices: true
            }
          },
          player2: {
            include: {
              handicapRecords: {
                orderBy: { date: 'desc' },
                take: 20
              },
              seasonTeeChoices: true
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      }
    },
    orderBy: [{ startedAt: 'desc' }, { date: 'asc' }]
  })
}

export async function getNextScheduledWeekRecord() {
  if (!process.env.DATABASE_URL) {
    return null
  }

  const baseWhere = {
    season: {
      is: {
        archivedAt: null
      }
    },
    startedAt: null,
    completedAt: null,
    locked: false,
    matches: {
      none: {}
    },
    attendance: {
      none: {
        present: true
      }
    }
  } satisfies Prisma.WeekWhereInput

  return prisma.week.findFirst({
    where: baseWhere,
    include: {
      season: true
    },
    orderBy: { date: 'asc' }
  })
}

export async function getCurrentWeekPageData() {
  if (!process.env.DATABASE_URL) {
    return {
      currentWeek: null,
      upcomingWeek: null,
      attendance: [],
      courses: [],
      presentCount: 0,
      totalPlayers: 0
    }
  }

  const { isoDate } = getPhoenixDateParts()

  const [currentWeek, upcomingWeek, players, courses] = await Promise.all([
    getCurrentWeekRecord(),
    getNextScheduledWeekRecord(),
    prisma.player.findMany({
      where: { active: true },
      include: {
        handicapRecords: {
          orderBy: { date: 'desc' },
          take: 20
        },
        seasonTeeChoices: true
      },
      orderBy: { name: 'asc' }
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
    })
  ])

  const attendanceByPlayerId = new Map(
    (currentWeek?.attendance ?? []).map((entry) => [entry.playerId, entry])
  )

  const attendance = players.map((player) => {
    const status = attendanceByPlayerId.get(player.id)
    const handicap = getPlayerHandicapDisplay(player)

    return {
      playerId: player.id,
      name: player.name,
      present: status?.present ?? false,
      ctpPoolPaid: status?.ctpPoolPaid ?? false,
      longestPuttPoolPaid: status?.longestPuttPoolPaid ?? false,
      checkedInAt: status?.checkedInAt?.toISOString() ?? null,
      teeColor: currentWeek
        ? getPlayerSeasonTeeColor(
            player.seasonTeeChoices,
            currentWeek.seasonId,
            player.gender,
            player.defaultTeeColor
          )
        : getDefaultTeeColorForGender(player.gender),
      handicap
    }
  }).sort((a, b) => compareNamesByLastName(a.name, b.name))

  return {
    currentWeek: currentWeek
      ? {
          id: currentWeek.id,
          weekNumber: currentWeek.weekNumber,
          seasonName: currentWeek.season.name,
          dateLabel: formatDate(currentWeek.date),
          startedAt: currentWeek.startedAt?.toISOString() ?? null,
          completedAt: currentWeek.completedAt?.toISOString() ?? null,
          handicapMode: currentWeek.handicapMode,
          handicapModeLabel: getHandicapModeLabel(currentWeek.handicapMode),
          courseId: currentWeek.courseId,
          courseName: currentWeek.course?.name ?? null,
          ctpHoleOptions:
            currentWeek.course?.holes.filter((hole) => hole.par === 3).map((hole) => hole.holeNumber) ?? [],
          ctpHoleNumber: currentWeek.ctpHoleNumber,
          longestPuttHoleNumber: currentWeek.longestPuttHoleNumber,
          ctpWinnerId: currentWeek.ctpWinnerId,
          ctpWinnerName: currentWeek.ctpWinner?.name ?? null,
          longestPuttWinnerId: currentWeek.longestPuttWinnerId,
          longestPuttWinnerName: currentWeek.longestPuttWinner?.name ?? null,
          locked: currentWeek.locked,
          matchCount: currentWeek.matches.length,
          matches: currentWeek.matches.map((match) => {
            const player1TeeColor = getPlayerSeasonTeeColor(
              match.player1.seasonTeeChoices,
              currentWeek.seasonId,
              match.player1.gender,
              match.player1.defaultTeeColor
            )
            const player2TeeColor = getPlayerSeasonTeeColor(
              match.player2.seasonTeeChoices,
              currentWeek.seasonId,
              match.player2.gender,
              match.player2.defaultTeeColor
            )
            const player1ResolvedTeeColor = getPlayerMatchTeeColor(
              match.player1.seasonTeeChoices,
              currentWeek.seasonId,
              match.player1.gender,
              match.player1.defaultTeeColor,
              match.player1TeeOverrideColor
            )
            const player2ResolvedTeeColor = getPlayerMatchTeeColor(
              match.player2.seasonTeeChoices,
              currentWeek.seasonId,
              match.player2.gender,
              match.player2.defaultTeeColor,
              match.player2TeeOverrideColor
            )
            const player1Tee = currentWeek.course
              ? getCourseTee(currentWeek.course.tees, player1ResolvedTeeColor, match.player1.gender, {
                  color: 'white',
                  gender: 'man',
                  nineHolePar: currentWeek.course.nineHolePar,
                  nineHoleRating: currentWeek.course.nineHoleRating,
                  nineHoleSlope: currentWeek.course.nineHoleSlope
                })
              : null
            const player2Tee = currentWeek.course
              ? getCourseTee(currentWeek.course.tees, player2ResolvedTeeColor, match.player2.gender, {
                  color: 'white',
                  gender: 'man',
                  nineHolePar: currentWeek.course.nineHolePar,
                  nineHoleRating: currentWeek.course.nineHoleRating,
                  nineHoleSlope: currentWeek.course.nineHoleSlope
                })
              : null
            const player1EffectiveIndex =
              match.player1HandicapIndex ?? getPlayerHandicapIndexValue(match.player1)
            const player2EffectiveIndex =
              match.player2HandicapIndex ?? getPlayerHandicapIndexValue(match.player2)
            const player1PlayingHandicap =
              match.player1PlayingHandicap ??
              getPlayingHandicap(currentWeek.handicapMode, player1EffectiveIndex, player1Tee)
            const player2PlayingHandicap =
              match.player2PlayingHandicap ??
              getPlayingHandicap(currentWeek.handicapMode, player2EffectiveIndex, player2Tee)
            const popDifference = Math.abs(player1PlayingHandicap - player2PlayingHandicap)
            const popRecipientId =
              popDifference === 0
                ? null
                : player1PlayingHandicap > player2PlayingHandicap
                  ? match.player1.id
                  : match.player2.id

            return {
              id: match.id,
              player1Id: match.player1.id,
              player2Id: match.player2.id,
              player1Name: match.player1.name,
              player2Name: match.player2.name,
              player1TeeColor: player1ResolvedTeeColor,
              player2TeeColor: player2ResolvedTeeColor,
              player1SeasonTeeColor: player1TeeColor,
              player2SeasonTeeColor: player2TeeColor,
              player1TeeOverrideColor: match.player1TeeOverrideColor,
              player2TeeOverrideColor: match.player2TeeOverrideColor,
              player1DisplayHandicapIndex: Number(player1EffectiveIndex.toFixed(1)),
              player2DisplayHandicapIndex: Number(player2EffectiveIndex.toFixed(1)),
              player1PlayingHandicap,
              player2PlayingHandicap,
              popDifference,
              popRecipientId,
              player2ScorecardOnly: match.player2ScorecardOnly,
              locked: match.locked,
              scoreComplete: match.matchPlayLeadBy !== null
            }
          })
        }
      : null,
    upcomingWeek: upcomingWeek
      ? {
          id: upcomingWeek.id,
          weekNumber: upcomingWeek.weekNumber,
          seasonName: upcomingWeek.season.name,
          dateLabel: formatDate(upcomingWeek.date),
          isOverdue: isWeekOverdue(upcomingWeek.date, isoDate)
        }
      : null,
    attendance,
    courses: courses.map((course) => ({
      id: course.id,
      name: course.name,
      tees: course.tees.map((tee) => ({
        color: tee.color,
        rating: tee.nineHoleRating,
        slope: tee.nineHoleSlope
      })),
      holes: course.holes.map((hole) => ({
        holeNumber: hole.holeNumber,
        par: hole.par
      }))
    })),
    presentCount: attendance.filter((entry) => entry.present).length,
    totalPlayers: players.length
  }
}

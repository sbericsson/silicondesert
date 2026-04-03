import { prisma } from '@/lib/db'
import { courseHandicap, handicapIndex } from '@/lib/handicap'
import { getPhoenixDateParts } from '@/lib/phoenix-time'
import { getCourseTee, getPlayerSeasonTeeColor } from '@/lib/course-tee'

function phoenixStartOfDay(isoDate: string) {
  return new Date(`${isoDate}T00:00:00-07:00`)
}

function phoenixEndOfDay(isoDate: string) {
  return new Date(`${isoDate}T23:59:59.999-07:00`)
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Phoenix',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(date)
}

function getPlayerDisplayHandicap(player: {
  seedHandicap: number | null
  handicapRecords: Array<{ courseDifferential: number }>
}) {
  if (player.handicapRecords.length === 0 && player.seedHandicap !== null) {
    return { kind: 'EST' as const, value: player.seedHandicap.toFixed(1) }
  }

  if (player.handicapRecords.length < 3) {
    return { kind: 'PRO' as const, value: null }
  }

  const value = handicapIndex(player.handicapRecords.map((record) => record.courseDifferential))

  return { kind: 'HCP' as const, value: value?.toFixed(1) ?? null }
}

function getPlayerPairingHandicap(player: {
  seedHandicap: number | null
  handicapRecords: Array<{ courseDifferential: number }>
}) {
  return handicapIndex(player.handicapRecords.map((record) => record.courseDifferential)) ?? player.seedHandicap ?? 0
}

export async function getCurrentWeekRecord() {
  if (!process.env.DATABASE_URL) {
    return null
  }

  const { isoDate } = getPhoenixDateParts()

  return prisma.week.findFirst({
    where: {
      season: {
        is: {
          archivedAt: null
        }
      },
      date: {
        gte: phoenixStartOfDay(isoDate),
        lte: phoenixEndOfDay(isoDate)
      }
    },
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
          tees: true
        }
      },
      attendance: {
        include: {
          player: {
            include: {
              handicapRecords: {
                orderBy: { date: 'asc' },
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
                orderBy: { date: 'asc' },
                take: 20
              },
              seasonTeeChoices: true
            }
          },
          player2: {
            include: {
              handicapRecords: {
                orderBy: { date: 'asc' },
                take: 20
              },
              seasonTeeChoices: true
            }
          }
        },
        orderBy: { createdAt: 'asc' }
      }
    }
  })
}

export async function getNextScheduledWeekRecord() {
  if (!process.env.DATABASE_URL) {
    return null
  }

  const { isoDate } = getPhoenixDateParts()

  return prisma.week.findFirst({
    where: {
      season: {
        is: {
          archivedAt: null
        }
      },
      date: {
        gt: phoenixEndOfDay(isoDate)
      }
    },
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

  const [currentWeek, upcomingWeek, players, courses] = await Promise.all([
    getCurrentWeekRecord(),
    getNextScheduledWeekRecord(),
    prisma.player.findMany({
      where: { active: true },
      include: {
        handicapRecords: {
          orderBy: { date: 'asc' },
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
    const handicap = getPlayerDisplayHandicap(player)

    return {
      playerId: player.id,
      name: player.name,
      present: status?.present ?? false,
      checkedInAt: status?.checkedInAt?.toISOString() ?? null,
      teeColor:
        currentWeek ? getPlayerSeasonTeeColor(player.seasonTeeChoices, currentWeek.seasonId) : 'white',
      handicap
    }
  })

  return {
    currentWeek: currentWeek
      ? {
          id: currentWeek.id,
          weekNumber: currentWeek.weekNumber,
          seasonName: currentWeek.season.name,
          dateLabel: formatDate(currentWeek.date),
          courseId: currentWeek.courseId,
          courseName: currentWeek.course?.name ?? null,
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
              currentWeek.seasonId
            )
            const player2TeeColor = getPlayerSeasonTeeColor(
              match.player2.seasonTeeChoices,
              currentWeek.seasonId
            )
            const player1Tee = currentWeek.course
              ? getCourseTee(currentWeek.course.tees, player1TeeColor, match.player1.gender, {
                  color: 'white',
                  gender: 'man',
                  nineHolePar: currentWeek.course.nineHolePar,
                  nineHoleRating: currentWeek.course.nineHoleRating,
                  nineHoleSlope: currentWeek.course.nineHoleSlope
                })
              : null
            const player2Tee = currentWeek.course
              ? getCourseTee(currentWeek.course.tees, player2TeeColor, match.player2.gender, {
                  color: 'white',
                  gender: 'man',
                  nineHolePar: currentWeek.course.nineHolePar,
                  nineHoleRating: currentWeek.course.nineHoleRating,
                  nineHoleSlope: currentWeek.course.nineHoleSlope
                })
              : null
            const player1EffectiveIndex =
              match.player1HandicapIndex ?? getPlayerPairingHandicap(match.player1)
            const player2EffectiveIndex =
              match.player2HandicapIndex ?? getPlayerPairingHandicap(match.player2)
            const player1PlayingHandicap =
              currentWeek.course && player1Tee
                ? courseHandicap(
                    player1EffectiveIndex,
                    player1Tee.nineHoleSlope,
                    player1Tee.nineHoleRating,
                    player1Tee.nineHolePar
                  )
                : Math.round(player1EffectiveIndex)
            const player2PlayingHandicap =
              currentWeek.course && player2Tee
                ? courseHandicap(
                    player2EffectiveIndex,
                    player2Tee.nineHoleSlope,
                    player2Tee.nineHoleRating,
                    player2Tee.nineHolePar
                  )
                : Math.round(player2EffectiveIndex)
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
              player1TeeColor,
              player2TeeColor,
              player1DisplayHandicap: Math.round(player1EffectiveIndex),
              player2DisplayHandicap: Math.round(player2EffectiveIndex),
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
          dateLabel: formatDate(upcomingWeek.date)
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
      }))
    })),
    presentCount: attendance.filter((entry) => entry.present).length,
    totalPlayers: players.length
  }
}

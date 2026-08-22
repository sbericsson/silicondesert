import type { Gender, TeeColor } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getCourseDefaultTeeFallback, getCourseTee, getPlayerSeasonTeeColor } from '@/lib/course-tee'
import { courseHandicap, exactHandicapIndexFromRecords } from '@/lib/handicap'
import { HANDICAP_RECORDS_INCLUDE } from '@/lib/handicap-records'
import { comparePlayerNamesByLastName } from '@/lib/player-sort'
import { getCourseVenue } from '@/lib/venue'
import {
  buildOpponentCounts,
  createInitialsResolver,
  getCurrentWeekRecord,
  getNextScheduledWeekRecord
} from '@/lib/week'

export const TEE_LETTER: Record<TeeColor, string> = {
  blue: 'B',
  white: 'W',
  yellow: 'Y',
  silver: 'S'
}

export interface CheckInSheetCourse {
  id: string
  name: string
  venue: string
  nineLabel: string
  isToday: boolean
}

export interface CheckInSheetOpponent {
  name: string
  count: number
}

export interface CheckInSheetRow {
  playerId: string
  name: string
  isMember: boolean
  index: number | null
  indexLabel: string
  isEstimated: boolean
  teeColor: TeeColor
  teeLetter: string
  courseHandicaps: Array<number | null>
  opponents: CheckInSheetOpponent[]
}

export interface CheckInSheetData {
  hasWeek: boolean
  weekId: string | null
  weekNumber: number | null
  dateLabel: string
  courseName: string | null
  venue: string | null
  seasonName: string | null
  courses: CheckInSheetCourse[]
  rows: CheckInSheetRow[]
  guestCount: number
  playerCount: number
}

const EMPTY_SHEET: CheckInSheetData = {
  hasWeek: false,
  weekId: null,
  weekNumber: null,
  dateLabel: '',
  courseName: null,
  venue: null,
  seasonName: null,
  courses: [],
  rows: [],
  guestCount: 0,
  playerCount: 0
}

// Repeats first (they are the reason this column exists), then the remaining
// one-time opponents alphabetically.
export function sortOpponents(opponents: CheckInSheetOpponent[]) {
  return [...opponents].sort((a, b) => {
    const aRepeat = a.count >= 2
    const bRepeat = b.count >= 2

    if (aRepeat !== bRepeat) {
      return aRepeat ? -1 : 1
    }

    if (aRepeat && bRepeat && a.count !== b.count) {
      return b.count - a.count
    }

    return a.name.localeCompare(b.name, 'en-US')
  })
}

export function formatSheetDate(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Phoenix'
  }).format(date)
}

export interface SheetPlayerInput {
  id: string
  name: string
  gender: Gender
  defaultTeeColor: TeeColor | null
  seedHandicap: number | null
  handicapRecords: Array<{ courseDifferential: number }>
  seasonTeeChoices: Array<{ seasonId: string; teeColor: TeeColor }>
  courseMember: boolean
}

export interface SheetCourseInput {
  nineHolePar: number
  nineHoleRating: number
  nineHoleSlope: number
  tees: Array<{
    color: TeeColor
    gender: Gender
    nineHolePar: number
    nineHoleRating: number
    nineHoleSlope: number
  }>
}

/**
 * Builds one printed row. Pure on purpose: the handicap math, the no-index
 * fallback and the guest flag are the parts worth testing, and they must not
 * need a database to exercise.
 */
export function buildCheckInSheetRow(
  player: SheetPlayerInput,
  courses: SheetCourseInput[],
  seasonId: string,
  opponents: CheckInSheetOpponent[] = []
): CheckInSheetRow {
  const exactIndex = exactHandicapIndexFromRecords(player.handicapRecords)
  const isEstimated = exactIndex === null && player.seedHandicap !== null
  const index = exactIndex ?? player.seedHandicap ?? null

  const teeColor = getPlayerSeasonTeeColor(
    player.seasonTeeChoices,
    seasonId,
    player.gender,
    player.defaultTeeColor
  )

  const courseHandicaps = courses.map((course) => {
    if (index === null) {
      return null
    }

    const tee = getCourseTee(
      course.tees,
      teeColor,
      player.gender,
      getCourseDefaultTeeFallback(course)
    )

    return courseHandicap(index, tee.nineHoleSlope, tee.nineHoleRating, tee.nineHolePar)
  })

  return {
    playerId: player.id,
    name: player.name,
    isMember: player.courseMember,
    index,
    indexLabel: index === null ? 'NH' : index.toFixed(2),
    isEstimated,
    teeColor,
    teeLetter: TEE_LETTER[teeColor],
    courseHandicaps,
    opponents: sortOpponents(opponents)
  }
}

export async function getCheckInSheetData(weekId?: string): Promise<CheckInSheetData> {
  if (!process.env.DATABASE_URL) {
    return EMPTY_SHEET
  }

  const week = weekId
    ? await prisma.week.findUnique({
        where: { id: weekId },
        select: {
          id: true,
          seasonId: true,
          weekNumber: true,
          date: true,
          courseId: true,
          season: { select: { name: true } }
        }
      })
    : ((await getCurrentWeekRecord()) ?? (await getNextScheduledWeekRecord()))

  if (!week) {
    return EMPTY_SHEET
  }

  const [players, courses] = await Promise.all([
    prisma.player.findMany({
      where: { active: true },
      include: {
        handicapRecords: HANDICAP_RECORDS_INCLUDE,
        seasonTeeChoices: true
      }
    }),
    prisma.course.findMany({
      include: { tees: { orderBy: { color: 'asc' } } },
      orderBy: { name: 'asc' }
    })
  ])

  // Prior matches in this season, excluding the week being printed: the sheet
  // answers "who has this player already been paired with before today".
  const priorMatches = await prisma.match.findMany({
    where: {
      week: {
        seasonId: week.seasonId,
        id: { not: week.id },
        date: { lte: week.date }
      }
    },
    select: {
      player1Id: true,
      player2Id: true,
      player2ScorecardOnly: true,
      player1: { select: { name: true } },
      player2: { select: { name: true } }
    },
    orderBy: { createdAt: 'asc' }
  })

  const { opponentCountsByPlayerId, allOpponentNames } = buildOpponentCounts(priorMatches)
  // Initials, not surnames: the full season's opponents have to fit on one
  // printed line. This is the same resolver the week page uses, so a player
  // reads the same on screen and on paper.
  const resolveInitials = createInitialsResolver([
    ...players.map((player) => player.name),
    ...allOpponentNames
  ])

  // Group the rotation by club so the course-handicap columns read as
  // "Oakwood's three, then Ironwood's two" rather than interleaved.
  const sheetCourses = [...courses]
    .sort((a, b) => {
      const venueOrder = getCourseVenue(a.name).localeCompare(getCourseVenue(b.name), 'en-US')
      return venueOrder !== 0 ? venueOrder : a.name.localeCompare(b.name, 'en-US')
    })
    .map((course) => {
      const venue = getCourseVenue(course.name)
      const nineLabel = course.name.slice(venue.length).replace(/^\s*-\s*/, '').trim()

      return {
        course,
        sheet: {
          id: course.id,
          name: course.name,
          venue,
          nineLabel: nineLabel.length > 0 ? nineLabel : course.name,
          isToday: course.id === week.courseId
        } satisfies CheckInSheetCourse
      }
    })

  const todayCourse = sheetCourses.find((entry) => entry.sheet.isToday)?.course ?? null
  const todayVenue = todayCourse ? getCourseVenue(todayCourse.name) : null

  const rows: CheckInSheetRow[] = players
    .sort((a, b) => comparePlayerNamesByLastName(a.name, b.name))
    .map((player) =>
      buildCheckInSheetRow(
        player,
        sheetCourses.map(({ course }) => course),
        week.seasonId,
        [...(opponentCountsByPlayerId.get(player.id) ?? new Map<string, number>())].map(
          ([opponentName, count]) => ({ name: resolveInitials(opponentName), count })
        )
      )
    )

  return {
    hasWeek: true,
    weekId: week.id,
    weekNumber: week.weekNumber,
    dateLabel: formatSheetDate(week.date),
    courseName: todayCourse?.name ?? null,
    venue: todayVenue,
    seasonName: week.season?.name ?? null,
    courses: sheetCourses.map((entry) => entry.sheet),
    rows,
    guestCount: rows.filter((row) => !row.isMember).length,
    playerCount: rows.length
  }
}

// The opponent list is capped to a single printed line so every row keeps the
// same height and the page count stays predictable. Repeats are sorted first,
// so truncation only ever drops one-time opponents.
export const OPPONENT_CHAR_BUDGET = 44

export function fitOpponents(
  opponents: CheckInSheetOpponent[],
  budget = OPPONENT_CHAR_BUDGET
) {
  const shown: CheckInSheetOpponent[] = []
  let used = 0

  for (const opponent of opponents) {
    const cost = opponent.name.length + (opponent.count >= 2 ? 3 : 0) + 2

    if (used + cost > budget) {
      break
    }

    shown.push(opponent)
    used += cost
  }

  return { shown, hidden: opponents.length - shown.length }
}

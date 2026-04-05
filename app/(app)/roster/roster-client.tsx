'use client'

import type { FormEvent } from 'react'
import { startTransition, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Gender, TeeColor } from '@prisma/client'
import { formatUsPhoneInput, formatUsPhoneNumber } from '@/lib/phone'
import { getDefaultTeeColorForGender } from '@/lib/course-tee'
import {
  getImportedHandicapCourseTee,
  matchImportedHandicapRoundToCourse
} from '@/lib/imported-handicap'

const CUSTOM_COURSE_ID = '__custom__'

type ImportedRoundEditor = {
  id: string
  date: string
  courseId: string
  teeColor: TeeColor
  grossScore: string
  adjustedGrossScore: string
  courseRating: string
  slopeRating: string
  coursePar: string
}

type RosterPageData = {
  settings: {
    publicRosterEnabled: boolean
  }
  players: Array<{
    id: string
    name: string
    gender: Gender
    defaultTeeColor: TeeColor | null
    email: string | null
    cellPhone: string | null
    active: boolean
    seedHandicap: number | null
    seasonTeeChoices: Array<{
      seasonId: string
      teeColor: TeeColor
    }>
    importedHandicapRounds: Array<{
      date: string
      grossScore: number
      adjustedGrossScore: number
      courseRating: number
      slopeRating: number
      coursePar: number
    }>
    handicap: {
      kind: 'HCP' | 'NEW' | 'EST'
      value: string | null
    }
  }>
  courses: Array<{
    id: string
    name: string
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
    holes: Array<{
      holeNumber: number
      par: number
      strokeIndex: number
    }>
  }>
  seasons: Array<{
    id: string
    name: string
    type: 'spring' | 'summer'
    weekCount: number
    startDate: string
    endDate: string
    weekDates: string[]
    archivedAt: string | null
    hasWeekActivity: boolean
  }>
}

interface RosterClientProps {
  initialData: RosterPageData
}

function createEditorRoundId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createBlankImportedRound(
  courses: RosterPageData['courses'],
  gender: Gender
): ImportedRoundEditor {
  const defaultCourse = courses[0]
  const defaultTeeColor = getDefaultTeeColorForGender(gender)
  const defaultTee =
    defaultCourse?.tees.find((tee) => tee.color === defaultTeeColor && tee.gender === gender) ??
    defaultCourse?.tees.find((tee) => tee.color === 'white' && tee.gender === gender) ??
    defaultCourse?.tees.find((tee) => tee.gender === gender) ??
    defaultCourse?.tees.find((tee) => tee.color === defaultTeeColor) ??
    defaultCourse?.tees.find((tee) => tee.color === 'white') ??
    defaultCourse?.tees[0]

  return {
    id: createEditorRoundId(),
    date: '',
    courseId: defaultCourse?.id ?? CUSTOM_COURSE_ID,
    teeColor: defaultTee?.color ?? defaultTeeColor,
    grossScore: '',
    adjustedGrossScore: '',
    courseRating: '',
    slopeRating: '',
    coursePar: ''
  }
}

function importedRoundToEditorRound(
  round: RosterPageData['players'][number]['importedHandicapRounds'][number],
  courses: RosterPageData['courses'],
  gender: Gender
): ImportedRoundEditor {
  const match = matchImportedHandicapRoundToCourse(round, courses)

  return {
    id: createEditorRoundId(),
    date: round.date,
    courseId: match?.courseId ?? CUSTOM_COURSE_ID,
    teeColor: match?.teeColor ?? getDefaultTeeColorForGender(gender),
    grossScore: String(round.grossScore),
    adjustedGrossScore:
      round.adjustedGrossScore === round.grossScore ? '' : String(round.adjustedGrossScore),
    courseRating: match ? '' : String(round.courseRating),
    slopeRating: match ? '' : String(round.slopeRating),
    coursePar: match ? '' : String(round.coursePar)
  }
}

function isBlankImportedRound(round: ImportedRoundEditor) {
  return (
    !round.date.trim() &&
    !round.grossScore.trim() &&
    !round.adjustedGrossScore.trim() &&
    (round.courseId !== CUSTOM_COURSE_ID ||
      (!round.courseRating.trim() && !round.slopeRating.trim() && !round.coursePar.trim()))
  )
}

function getPlayerSortKey(name: string) {
  const normalized = name.trim().replace(/\s+/g, ' ')
  const parts = normalized.split(' ')
  const lastName = parts.at(-1) ?? normalized
  const firstNames = parts.slice(0, -1).join(' ')
  return `${lastName.toLocaleLowerCase()}|${firstNames.toLocaleLowerCase()}|${normalized.toLocaleLowerCase()}`
}

function sortPlayers(players: RosterPageData['players']) {
  return [...players].sort((left, right) => {
    if (left.active !== right.active) {
      return left.active ? -1 : 1
    }

    return getPlayerSortKey(left.name).localeCompare(getPlayerSortKey(right.name))
  })
}

export function RosterClient({ initialData }: RosterClientProps) {
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [playerName, setPlayerName] = useState('')
  const [playerGender, setPlayerGender] = useState<Gender>('man')
  const [playerEmail, setPlayerEmail] = useState('')
  const [playerCellPhone, setPlayerCellPhone] = useState('')
  const [playerSeedHandicap, setPlayerSeedHandicap] = useState('')
  const [playerDefaultTeeColor, setPlayerDefaultTeeColor] = useState<TeeColor>('blue')
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  const [editingPlayerName, setEditingPlayerName] = useState('')
  const [editingPlayerGender, setEditingPlayerGender] = useState<Gender>('man')
  const [editingPlayerDefaultTeeColor, setEditingPlayerDefaultTeeColor] = useState<TeeColor>('blue')
  const [editingPlayerEmail, setEditingPlayerEmail] = useState('')
  const [editingPlayerCellPhone, setEditingPlayerCellPhone] = useState('')
  const [editingPlayerSeedHandicap, setEditingPlayerSeedHandicap] = useState('')
  const [editingPlayerImportedRounds, setEditingPlayerImportedRounds] = useState<
    ImportedRoundEditor[]
  >([])
  const [editingPlayerRoundsExpanded, setEditingPlayerRoundsExpanded] = useState(false)
  const [editingPlayerSeasonTeeChoices, setEditingPlayerSeasonTeeChoices] = useState<
    Record<string, TeeColor>
  >({})
  const [seasonName, setSeasonName] = useState('')
  const [seasonType, setSeasonType] = useState<'spring' | 'summer'>('spring')
  const [seasonStartDate, setSeasonStartDate] = useState('')
  const [seasonWeekDates, setSeasonWeekDates] = useState<string[]>([])
  const [seasonDatePickerValue, setSeasonDatePickerValue] = useState('')
  const [seasonWeekCount, setSeasonWeekCount] = useState('8')
  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(null)
  const [editingSeasonName, setEditingSeasonName] = useState('')
  const [editingSeasonType, setEditingSeasonType] = useState<'spring' | 'summer'>('spring')
  const [editingSeasonStartDate, setEditingSeasonStartDate] = useState('')
  const [editingSeasonWeekDates, setEditingSeasonWeekDates] = useState<string[]>([])
  const [editingSeasonDatePickerValue, setEditingSeasonDatePickerValue] = useState('')
  const [editingSeasonWeekCount, setEditingSeasonWeekCount] = useState('8')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Course editor state
  type CourseEditorTee = { _key: string; color: TeeColor; gender: Gender; nineHolePar: string; nineHoleRating: string; nineHoleSlope: string }
  type CourseEditorHole = { holeNumber: number; par: string; strokeIndex: string }
  const [editingCourseId, setEditingCourseId] = useState<string | 'new' | null>(null)
  const [courseName, setCourseName] = useState('')
  const [courseNineHolePar, setCourseNineHolePar] = useState('36')
  const [courseNineHoleRating, setCourseNineHoleRating] = useState('')
  const [courseNineHoleSlope, setCourseNineHoleSlope] = useState('')
  const [courseTees, setCourseTees] = useState<CourseEditorTee[]>([])
  const [courseHoles, setCourseHoles] = useState<CourseEditorHole[]>(
    Array.from({ length: 9 }, (_, i) => ({ holeNumber: i + 1, par: '4', strokeIndex: String(i + 1) }))
  )
  const [confirmDeleteCourse, setConfirmDeleteCourse] = useState(false)

  useEffect(() => {
    setData(initialData)
  }, [initialData])

  async function refreshPage(successMessage: string) {
    setMessage(successMessage)
    startTransition(() => {
      router.refresh()
    })
  }

  function openCourseEditor(course?: RosterPageData['courses'][0]) {
    setConfirmDeleteCourse(false)
    setError(null)
    setMessage(null)
    if (!course) {
      setEditingCourseId('new')
      setCourseName('')
      setCourseNineHolePar('36')
      setCourseNineHoleRating('')
      setCourseNineHoleSlope('')
      setCourseTees([])
      setCourseHoles(Array.from({ length: 9 }, (_, i) => ({ holeNumber: i + 1, par: '4', strokeIndex: String(i + 1) })))
    } else {
      setEditingCourseId(course.id)
      setCourseName(course.name)
      setCourseNineHolePar(String(course.nineHolePar))
      setCourseNineHoleRating(String(course.nineHoleRating))
      setCourseNineHoleSlope(String(course.nineHoleSlope))
      setCourseTees(course.tees.map((tee) => ({
        _key: `${tee.color}-${tee.gender}`,
        color: tee.color,
        gender: tee.gender,
        nineHolePar: String(tee.nineHolePar),
        nineHoleRating: String(tee.nineHoleRating),
        nineHoleSlope: String(tee.nineHoleSlope)
      })))
      setCourseHoles(
        course.holes.length > 0
          ? course.holes.map((h) => ({ holeNumber: h.holeNumber, par: String(h.par), strokeIndex: String(h.strokeIndex) }))
          : Array.from({ length: 9 }, (_, i) => ({ holeNumber: i + 1, par: '4', strokeIndex: String(i + 1) }))
      )
    }
  }

  function addCourseTee() {
    const usedKeys = new Set(courseTees.map((t) => `${t.color}-${t.gender}`))
    const teeOptions: Array<{ color: TeeColor; gender: Gender }> = [
      { color: 'blue', gender: 'man' }, { color: 'blue', gender: 'woman' },
      { color: 'silver', gender: 'man' }, { color: 'silver', gender: 'woman' },
      { color: 'white', gender: 'man' }, { color: 'white', gender: 'woman' },
      { color: 'yellow', gender: 'man' }, { color: 'yellow', gender: 'woman' }
    ]
    const next = teeOptions.find((o) => !usedKeys.has(`${o.color}-${o.gender}`))
    if (!next) return
    setCourseTees((prev) => [...prev, { _key: `${next.color}-${next.gender}`, color: next.color, gender: next.gender, nineHolePar: '36', nineHoleRating: '', nineHoleSlope: '' }])
  }

  function updateCourseTee(index: number, field: string, value: string) {
    setCourseTees((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      if (field === 'color' || field === 'gender') {
        next[index]._key = `${next[index].color}-${next[index].gender}`
      }
      return next
    })
  }

  function removeCourseTee(index: number) {
    setCourseTees((prev) => prev.filter((_, i) => i !== index))
  }

  function updateCourseHole(holeNumber: number, field: 'par' | 'strokeIndex', value: string) {
    setCourseHoles((prev) => prev.map((h) => h.holeNumber === holeNumber ? { ...h, [field]: value } : h))
  }

  async function saveCourse() {
    if (!editingCourseId) return
    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    const payload = {
      name: courseName,
      nineHolePar: Number(courseNineHolePar) || 36,
      nineHoleRating: Number(courseNineHoleRating) || 36.0,
      nineHoleSlope: Number(courseNineHoleSlope) || 113,
      tees: courseTees.map((t) => ({ color: t.color, gender: t.gender, nineHolePar: Number(t.nineHolePar), nineHoleRating: Number(t.nineHoleRating), nineHoleSlope: Number(t.nineHoleSlope) })),
      holes: courseHoles.map((h) => ({ holeNumber: h.holeNumber, par: Number(h.par) || 4, strokeIndex: Number(h.strokeIndex) || h.holeNumber }))
    }

    const url = editingCourseId === 'new' ? '/api/courses' : `/api/courses/${editingCourseId}`
    const method = editingCourseId === 'new' ? 'POST' : 'PUT'

    const response = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    if (!response.ok) {
      const payload2 = await response.json().catch(() => null)
      setError(payload2?.error ?? 'Failed to save course')
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
    setEditingCourseId(null)
    await refreshPage(editingCourseId === 'new' ? 'Course created.' : 'Course updated.')
  }

  async function deleteCourse() {
    if (!editingCourseId || editingCourseId === 'new') return
    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    const response = await fetch(`/api/courses/${editingCourseId}`, { method: 'DELETE' })
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? 'Failed to delete course')
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
    setEditingCourseId(null)
    setConfirmDeleteCourse(false)
    await refreshPage('Course deleted.')
  }

  async function handlePublicRosterToggle(publicRosterEnabled: boolean) {
    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    const response = await fetch('/api/commissioner/settings', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ publicRosterEnabled })
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? 'Unable to update commissioner settings')
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
    await refreshPage(publicRosterEnabled ? 'Public roster enabled.' : 'Public roster hidden.')
  }

  async function handleCreatePlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    const response = await fetch('/api/players', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: playerName,
        gender: playerGender,
        defaultTeeColor: playerDefaultTeeColor,
        email: playerEmail,
        cellPhone: playerCellPhone,
        seedHandicap: playerSeedHandicap
      })
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? 'Unable to create player')
      setIsSubmitting(false)
      return
    }

    setPlayerName('')
    setPlayerGender('man')
    setPlayerDefaultTeeColor('blue')
    setPlayerEmail('')
    setPlayerCellPhone('')
    setPlayerSeedHandicap('')
    setIsSubmitting(false)
    await refreshPage('Player created.')
  }

  async function handleTogglePlayer(playerId: string, active: boolean) {
    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    const response = await fetch(`/api/players/${playerId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ active })
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? 'Unable to update player')
      setIsSubmitting(false)
      return
    }

    setData((current) => ({
      ...current,
      players: sortPlayers(
        current.players.map((player) => (player.id === playerId ? { ...player, active } : player))
      )
    }))
    setIsSubmitting(false)
    await refreshPage(active ? 'Player activated.' : 'Player deactivated.')
  }

  async function handleDeletePlayer(player: RosterPageData['players'][number]) {
    const confirmed = window.confirm(
      `Delete ${player.name}? This is only safe for players without league history.`
    )

    if (!confirmed) {
      return
    }

    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    const response = await fetch(`/api/players/${player.id}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? 'Unable to delete player')
      setIsSubmitting(false)
      return
    }

    if (editingPlayerId === player.id) {
      setEditingPlayerId(null)
      setEditingPlayerName('')
      setEditingPlayerGender('man')
      setEditingPlayerEmail('')
      setEditingPlayerCellPhone('')
      setEditingPlayerSeedHandicap('')
      setEditingPlayerImportedRounds([])
      setEditingPlayerRoundsExpanded(false)
      setEditingPlayerSeasonTeeChoices({})
    }

    setData((current) => ({
      ...current,
      players: current.players.filter((currentPlayer) => currentPlayer.id !== player.id)
    }))
    setIsSubmitting(false)
    await refreshPage('Player deleted.')
  }

  async function handleSavePlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingPlayerId) {
      return
    }

    setError(null)
    setMessage(null)

    const normalizedImportedRounds: Array<{
      date: string
      grossScore: number
      adjustedGrossScore: number
      courseRating: number
      slopeRating: number
      coursePar: number
    }> = []

    for (const [index, round] of editingPlayerImportedRounds
      .filter((candidate) => !isBlankImportedRound(candidate))
      .entries()) {
      if (!round.date) {
        setError(`Prior round ${index + 1} needs a date.`)
        return
      }

      const grossScore = Number(round.grossScore)
      const adjustedGrossScore = round.adjustedGrossScore ? Number(round.adjustedGrossScore) : grossScore

      if (!Number.isInteger(grossScore) || grossScore < 1) {
        setError(`Prior round ${index + 1} needs a whole-number gross score.`)
        return
      }

      if (!Number.isInteger(adjustedGrossScore) || adjustedGrossScore < 1) {
        setError(`Prior round ${index + 1} needs a whole-number adjusted score.`)
        return
      }

      if (adjustedGrossScore > grossScore) {
        setError(`Prior round ${index + 1} cannot have adjusted gross higher than gross.`)
        return
      }

      if (round.courseId !== CUSTOM_COURSE_ID) {
        const selectedTee = getImportedHandicapCourseTee(
          data.courses,
          round.courseId,
          round.teeColor,
          editingPlayerGender
        )

        if (!selectedTee) {
          setError(`Prior round ${index + 1} has an invalid course or tee.`)
          return
        }

        normalizedImportedRounds.push({
          date: round.date,
          grossScore,
          adjustedGrossScore,
          courseRating: selectedTee.nineHoleRating,
          slopeRating: selectedTee.nineHoleSlope,
          coursePar: selectedTee.nineHolePar
        })
        continue
      }

      const courseRating = Number(round.courseRating)
      const slopeRating = Number(round.slopeRating)
      const coursePar = Number(round.coursePar)

      if (!Number.isFinite(courseRating)) {
        setError(`Prior round ${index + 1} needs a numeric course rating.`)
        return
      }

      if (!Number.isInteger(slopeRating) || slopeRating < 1) {
        setError(`Prior round ${index + 1} needs a whole-number slope.`)
        return
      }

      if (!Number.isInteger(coursePar) || coursePar < 1) {
        setError(`Prior round ${index + 1} needs a whole-number par.`)
        return
      }

      normalizedImportedRounds.push({
        date: round.date,
        grossScore,
        adjustedGrossScore,
        courseRating,
        slopeRating,
        coursePar
      })
    }

    if (normalizedImportedRounds.length > 20) {
      setError('Enter at most 20 prior handicap rounds.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    const response = await fetch(`/api/players/${editingPlayerId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: editingPlayerName,
        gender: editingPlayerGender,
        defaultTeeColor: editingPlayerDefaultTeeColor,
        email: editingPlayerEmail,
        cellPhone: editingPlayerCellPhone,
        seedHandicap: editingPlayerSeedHandicap,
        importedHandicapRounds: normalizedImportedRounds,
        seasonTeeChoices: Object.entries(editingPlayerSeasonTeeChoices).map(([seasonId, teeColor]) => ({
          seasonId,
          teeColor
        }))
      })
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? 'Unable to save player')
      setIsSubmitting(false)
      return
    }

    closeEditingPlayer()
    setIsSubmitting(false)
    await refreshPage('Player updated.')
  }

  function closeEditingPlayer() {
    setEditingPlayerId(null)
    setEditingPlayerName('')
    setEditingPlayerGender('man')
    setEditingPlayerDefaultTeeColor('blue')
    setEditingPlayerEmail('')
    setEditingPlayerCellPhone('')
    setEditingPlayerSeedHandicap('')
    setEditingPlayerImportedRounds([])
    setEditingPlayerRoundsExpanded(false)
    setEditingPlayerSeasonTeeChoices({})
  }

  function beginEditingPlayer(player: RosterPageData['players'][number]) {
    setEditingPlayerId(player.id)
    setEditingPlayerName(player.name)
    setEditingPlayerGender(player.gender)
    setEditingPlayerDefaultTeeColor(
      player.defaultTeeColor ?? getDefaultTeeColorForGender(player.gender)
    )
    setEditingPlayerEmail(player.email ?? '')
    setEditingPlayerCellPhone(formatUsPhoneNumber(player.cellPhone) ?? '')
    setEditingPlayerSeedHandicap(player.seedHandicap?.toString() ?? '')
    setEditingPlayerImportedRounds(
      player.importedHandicapRounds.map((round) =>
        importedRoundToEditorRound(round, data.courses, player.gender)
      )
    )
    setEditingPlayerRoundsExpanded(player.importedHandicapRounds.length === 0)
    setEditingPlayerSeasonTeeChoices(
      Object.fromEntries(
        player.seasonTeeChoices.map((choice) => [choice.seasonId, choice.teeColor])
      )
    )
  }

  function addEditingPlayerImportedRound() {
    setEditingPlayerRoundsExpanded(true)
    setEditingPlayerImportedRounds((current) => [
      ...current,
      createBlankImportedRound(data.courses, editingPlayerGender)
    ])
  }

  function removeEditingPlayerImportedRound(roundId: string) {
    setEditingPlayerImportedRounds((current) => current.filter((round) => round.id !== roundId))
  }

  function updateEditingPlayerImportedRound(
    roundId: string,
    updates: Partial<ImportedRoundEditor>
  ) {
    setEditingPlayerImportedRounds((current) =>
      current.map((round) => (round.id === roundId ? { ...round, ...updates } : round))
    )
  }

  function updateEditingPlayerSeasonTeeChoice(seasonId: string, teeColor: TeeColor) {
    setEditingPlayerSeasonTeeChoices((current) => ({
      ...current,
      [seasonId]: teeColor
    }))
  }

  function handlePlayerCellPhoneChange(value: string) {
    setPlayerCellPhone(formatUsPhoneInput(value))
  }

  function handleEditingPlayerCellPhoneChange(value: string) {
    setEditingPlayerCellPhone(formatUsPhoneInput(value))
  }

  function buildWeeklyDates(startDate: string, weekCountValue: string) {
    const weeks = Number(weekCountValue)
    if (!startDate) {
      setError('Choose a season start date first.')
      return null
    }

    if (!Number.isInteger(weeks) || weeks < 1) {
      setError('Week count must be at least 1.')
      return null
    }

    const start = new Date(`${startDate}T00:00:00-07:00`)
    return Array.from({ length: weeks }, (_, index) => {
      const next = new Date(start)
      next.setDate(start.getDate() + index * 7)
      return next.toISOString().slice(0, 10)
    })
  }

  function addSeasonDate(date: string) {
    if (!date) {
      return
    }

    setSeasonWeekDates((current) => [...new Set([...current, date])].sort())
    setSeasonDatePickerValue('')
  }

  function removeSeasonDate(date: string) {
    setSeasonWeekDates((current) => current.filter((item) => item !== date))
  }

  function generateWeeklyDates() {
    const dates = buildWeeklyDates(seasonStartDate, seasonWeekCount)
    if (!dates) {
      return
    }

    setSeasonWeekDates(dates)
    setError(null)
  }

  function beginEditingSeason(season: RosterPageData['seasons'][number]) {
    setEditingSeasonId(season.id)
    setEditingSeasonName(season.name)
    setEditingSeasonType(season.type)
    setEditingSeasonStartDate(season.startDate)
    setEditingSeasonWeekDates(season.weekDates)
    setEditingSeasonDatePickerValue('')
    setEditingSeasonWeekCount(String(season.weekCount))
  }

  function addEditingSeasonDate(date: string) {
    if (!date) {
      return
    }

    setEditingSeasonWeekDates((current) => [...new Set([...current, date])].sort())
    setEditingSeasonDatePickerValue('')
  }

  function removeEditingSeasonDate(date: string) {
    setEditingSeasonWeekDates((current) => current.filter((item) => item !== date))
  }

  function generateEditingSeasonDates() {
    const dates = buildWeeklyDates(editingSeasonStartDate, editingSeasonWeekCount)
    if (!dates) {
      return
    }

    setEditingSeasonWeekDates(dates)
    setError(null)
  }

  async function handleCreateSeason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    const weekDates = [...seasonWeekDates]

    const response = await fetch('/api/seasons', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: seasonName,
        type: seasonType,
        startDate: seasonStartDate,
        weekDates
      })
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? 'Unable to create season')
      setIsSubmitting(false)
      return
    }

    setSeasonName('')
    setSeasonStartDate('')
    setSeasonWeekDates([])
    setSeasonDatePickerValue('')
    setIsSubmitting(false)
    await refreshPage('Season created.')
  }

  async function handleSaveSeason(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingSeasonId) {
      return
    }

    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    const response = await fetch(`/api/seasons/${editingSeasonId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(
        editingSeason?.hasWeekActivity
          ? {
              name: editingSeasonName,
              type: editingSeasonType
            }
          : {
              name: editingSeasonName,
              type: editingSeasonType,
              startDate: editingSeasonStartDate,
              weekDates: editingSeasonWeekDates
            }
      )
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? 'Unable to save season')
      setIsSubmitting(false)
      return
    }

    setEditingSeasonId(null)
    setEditingSeasonName('')
    setEditingSeasonType('spring')
    setEditingSeasonStartDate('')
    setEditingSeasonWeekDates([])
    setEditingSeasonDatePickerValue('')
    setEditingSeasonWeekCount('8')
    setIsSubmitting(false)
    await refreshPage('Season updated.')
  }

  async function handleSeasonArchiveToggle(
    season: RosterPageData['seasons'][number],
    archived: boolean
  ) {
    const confirmed = window.confirm(
      archived
        ? `Archive ${season.name}? It will remain visible in standings and history, but future edits will be blocked until restored.`
        : `Restore ${season.name}? This will make the season editable again.`
    )

    if (!confirmed) {
      return
    }

    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    const response = await fetch(`/api/seasons/${season.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ archived })
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? 'Unable to update season')
      setIsSubmitting(false)
      return
    }

    if (editingSeasonId === season.id && archived) {
      setEditingSeasonId(null)
    }

    setIsSubmitting(false)
    await refreshPage(archived ? 'Season archived.' : 'Season restored.')
  }

  async function handleDeleteSeason(season: RosterPageData['seasons'][number]) {
    const confirmed = window.confirm(
      `Delete ${season.name}? This permanently removes its weeks, matches, scores, and history.`
    )

    if (!confirmed) {
      return
    }

    setIsSubmitting(true)
    setError(null)
    setMessage(null)

    const response = await fetch(`/api/seasons/${season.id}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      setError(payload?.error ?? 'Unable to delete season')
      setIsSubmitting(false)
      return
    }

    if (editingSeasonId === season.id) {
      setEditingSeasonId(null)
    }

    setIsSubmitting(false)
    await refreshPage('Season deleted.')
  }

  const editingSeason = data.seasons.find((season) => season.id === editingSeasonId) ?? null

  return (
    <section className="space-y-4 px-4 py-6">
      <div className="rounded-xl border border-surface-border bg-surface-elevated p-4">
        <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
          Roster
        </p>
        <h2 className="font-condensed mt-2 text-2xl font-bold uppercase tracking-wide text-text-primary">Players and Admin</h2>
        <p className="mt-2 text-sm text-text-secondary">
          Add players, manage contact info, and create or maintain seasons with prebuilt Friday weeks.
        </p>
      </div>

      {message ? (
        <div className="rounded-md border border-accent bg-accent-dim px-4 py-3 text-sm text-accent-text">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-md border border-danger bg-danger-dim px-4 py-3 text-sm text-danger-text">
          {error}
        </div>
      ) : null}

      <section className="rounded-xl border border-surface-border bg-surface-elevated p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
              Public Roster
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              Control whether `/public/roster` is visible to league members and website visitors.
            </p>
          </div>
          <button
            type="button"
            className={`rounded-lg px-4 py-3 text-sm font-semibold ${
              data.settings.publicRosterEnabled
                ? 'bg-accent text-white'
                : 'bg-surface-sunken text-text-primary'
            } disabled:cursor-not-allowed disabled:opacity-70`}
            onClick={() => handlePublicRosterToggle(!data.settings.publicRosterEnabled)}
            disabled={isSubmitting}
          >
            {data.settings.publicRosterEnabled ? 'Disable Public Roster' : 'Enable Public Roster'}
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <form
          className="rounded-xl border border-surface-border bg-surface-elevated p-4"
          onSubmit={handleCreatePlayer}
        >
          <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
            Add Player
          </p>
          <div className="mt-4 space-y-3">
            <input
              className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              placeholder="Name"
              value={playerName}
              onChange={(event) => setPlayerName(event.target.value)}
            />
            <select
              className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              value={playerGender}
              onChange={(event) => {
                const nextGender = event.target.value as Gender
                setPlayerGender(nextGender)
                setPlayerDefaultTeeColor(getDefaultTeeColorForGender(nextGender))
              }}
            >
              <option value="man">Man</option>
              <option value="woman">Woman</option>
            </select>
            <select
              className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              value={playerDefaultTeeColor}
              onChange={(event) => setPlayerDefaultTeeColor(event.target.value as TeeColor)}
            >
              <option value="blue">Standard tee: Blue</option>
              <option value="white">Standard tee: White</option>
              <option value="yellow">Standard tee: Yellow</option>
              <option value="silver">Standard tee: Silver</option>
            </select>
            <input
              className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              placeholder="Email (optional)"
              value={playerEmail}
              onChange={(event) => setPlayerEmail(event.target.value)}
            />
            <input
              className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              inputMode="tel"
              placeholder="Cell phone (optional)"
              value={playerCellPhone}
              onChange={(event) => handlePlayerCellPhoneChange(event.target.value)}
            />
            <input
              className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              inputMode="decimal"
              placeholder="Seed handicap (optional)"
              value={playerSeedHandicap}
              onChange={(event) => setPlayerSeedHandicap(event.target.value)}
            />
            <button
              type="submit"
              className="font-condensed w-full rounded-lg bg-accent px-4 py-3 text-sm font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-disabled"
              disabled={isSubmitting}
            >
              Add Player
            </button>
          </div>
        </form>

        <form
          className="rounded-xl border border-surface-border bg-surface-elevated p-4"
          onSubmit={handleCreateSeason}
        >
          <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
            Create Season
          </p>
          <div className="mt-4 space-y-3">
            <input
              className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              placeholder="Spring 2026"
              value={seasonName}
              onChange={(event) => setSeasonName(event.target.value)}
            />
            <select
              className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              value={seasonType}
              onChange={(event) => setSeasonType(event.target.value as 'spring' | 'summer')}
            >
              <option value="spring">Spring</option>
              <option value="summer">Summer</option>
            </select>
            <div>
              <p className="mb-1.5 font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
                Start Date
              </p>
              <input
                className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
                type="date"
                value={seasonStartDate}
                onChange={(event) => setSeasonStartDate(event.target.value)}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_120px]">
              <input
                className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
                type="date"
                value={seasonDatePickerValue}
                onChange={(event) => setSeasonDatePickerValue(event.target.value)}
              />
              <button
                type="button"
                className="rounded-lg border border-surface-border bg-surface-sunken px-4 py-3 text-sm font-semibold text-text-primary"
                onClick={() => addSeasonDate(seasonDatePickerValue)}
              >
                Add Date
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-[120px_1fr]">
              <input
                className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
                inputMode="numeric"
                value={seasonWeekCount}
                onChange={(event) => setSeasonWeekCount(event.target.value)}
              />
              <button
                type="button"
                className="rounded-lg border border-surface-border bg-surface-sunken px-4 py-3 text-sm font-semibold text-text-primary"
                onClick={generateWeeklyDates}
              >
                Generate Weekly Dates
              </button>
            </div>
            <div className="rounded-lg border border-surface-border bg-surface-sunken p-3">
              <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
                Selected Week Dates
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {seasonWeekDates.length > 0 ? (
                  seasonWeekDates.map((date) => (
                    <button
                      key={date}
                      type="button"
                      className="rounded bg-accent-dim px-2 py-1 text-xs font-semibold text-accent-text"
                      onClick={() => removeSeasonDate(date)}
                    >
                      {date} ×
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-text-secondary">No dates selected yet.</p>
                )}
              </div>
            </div>
            <button
              type="submit"
              className="font-condensed w-full rounded-lg bg-accent px-4 py-3 text-sm font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-disabled"
              disabled={isSubmitting}
            >
              Create Season
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-surface-border bg-surface-elevated">
        <div className="border-b border-surface-border px-4 py-3">
          <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
            Players ({data.players.length})
          </p>
          <p className="mt-1 text-xs text-text-secondary">
            Active players are listed first, with inactive players grouped at the bottom.
          </p>
        </div>
        <div className="divide-y divide-surface-border">
          {data.players.map((player) => (
            <div key={player.id}>
              <div
                className={`flex items-center gap-3 px-4 py-3 ${
                  player.active ? '' : 'bg-surface-sunken/30'
                }`}
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-text-primary">{player.name}</p>
                    <span className="rounded bg-surface-sunken px-2 py-0.5 font-condensed text-[11px] font-semibold uppercase tracking-widest text-text-secondary">
                      {player.gender === 'man' ? 'Man' : 'Woman'}
                    </span>
                    {!player.active ? (
                      <span className="rounded bg-warning-dim px-2 py-0.5 font-condensed text-[11px] font-semibold uppercase tracking-widest text-warning-text">
                        Inactive
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    {player.email ?? 'No email'} · {formatUsPhoneNumber(player.cellPhone) ?? 'No cell'}{' '}
                    ·{' '}
                    {player.handicap.kind === 'HCP' ? player.handicap.value : player.handicap.kind}
                  </p>
                  <p className="mt-1 text-[11px] text-text-secondary">
                    {player.importedHandicapRounds.length > 0
                      ? `${player.importedHandicapRounds.length} imported handicap round${player.importedHandicapRounds.length === 1 ? '' : 's'}`
                      : 'No imported handicap history'}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-surface-sunken px-3 py-2 text-sm font-semibold text-text-primary"
                    onClick={() => beginEditingPlayer(player)}
                    disabled={isSubmitting}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                      player.active
                        ? 'bg-surface-sunken text-text-primary'
                        : 'bg-accent-dim text-accent-text'
                    }`}
                    onClick={() => handleTogglePlayer(player.id, !player.active)}
                    disabled={isSubmitting}
                  >
                    {player.active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-danger-dim px-3 py-2 text-sm font-semibold text-danger-text"
                    onClick={() => handleDeletePlayer(player)}
                    disabled={isSubmitting}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {editingPlayerId === player.id ? (
                <form
                  className="border-t border-surface-border bg-surface-base px-4 py-4"
                  onSubmit={handleSavePlayer}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
                        Edit Player
                      </p>
                      <p className="mt-1 text-sm text-text-secondary">
                        Update player profile, contact info, and seeded handicap.
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-sm text-text-secondary"
                      onClick={closeEditingPlayer}
                    >
                      Close
                    </button>
                  </div>
                  <div className="sticky top-4 z-10 mt-4 flex items-center justify-between gap-3 rounded-lg border border-surface-border bg-surface-elevated/95 px-4 py-3 shadow-sm backdrop-blur">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{editingPlayerName || player.name}</p>
                      <p className="text-xs text-text-secondary">
                        Save quick contact changes without scrolling through handicap history.
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-lg border border-surface-border bg-surface-sunken px-3 py-2 text-sm font-semibold text-text-primary disabled:cursor-not-allowed disabled:text-text-disabled"
                        onClick={closeEditingPlayer}
                        disabled={isSubmitting}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="font-condensed rounded-lg bg-accent px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-disabled"
                        disabled={isSubmitting}
                      >
                        Save Player
                      </button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <input
                      className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
                      placeholder="Name"
                      value={editingPlayerName}
                      onChange={(event) => setEditingPlayerName(event.target.value)}
                    />
                    <select
                      className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
                      value={editingPlayerGender}
                      onChange={(event) => {
                        const nextGender = event.target.value as Gender
                        setEditingPlayerGender(nextGender)
                        setEditingPlayerDefaultTeeColor(getDefaultTeeColorForGender(nextGender))
                      }}
                    >
                      <option value="man">Man</option>
                      <option value="woman">Woman</option>
                    </select>
                    <select
                      className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
                      value={editingPlayerDefaultTeeColor}
                      onChange={(event) =>
                        setEditingPlayerDefaultTeeColor(event.target.value as TeeColor)
                      }
                    >
                      <option value="blue">Standard tee: Blue</option>
                      <option value="white">Standard tee: White</option>
                      <option value="yellow">Standard tee: Yellow</option>
                      <option value="silver">Standard tee: Silver</option>
                    </select>
                    <input
                      className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
                      placeholder="Email"
                      value={editingPlayerEmail}
                      onChange={(event) => setEditingPlayerEmail(event.target.value)}
                    />
                    <input
                      className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
                      inputMode="tel"
                      placeholder="Cell phone"
                      value={editingPlayerCellPhone}
                      onChange={(event) => handleEditingPlayerCellPhoneChange(event.target.value)}
                    />
                    <input
                      className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
                      inputMode="decimal"
                      placeholder="Seed handicap"
                      value={editingPlayerSeedHandicap}
                      onChange={(event) => setEditingPlayerSeedHandicap(event.target.value)}
                    />
                  </div>
                  <div className="mt-4 rounded-lg border border-surface-border bg-surface-sunken p-3">
                    <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
                      Season Tee Choice
                    </p>
                    <div className="mt-3 space-y-3">
                      {data.seasons.length > 0 ? (
                        data.seasons.map((season) => (
                          <div key={season.id} className="grid gap-2 md:grid-cols-[1fr_140px] md:items-center">
                            <div>
                              <p className="text-sm font-medium text-text-primary">{season.name}</p>
                              <p className="text-xs text-text-secondary">
                                {season.archivedAt ? 'Archived season' : 'Applies across this season'}
                              </p>
                            </div>
                            <select
                              className="w-full rounded-md border border-surface-border bg-surface-elevated px-3 py-2.5 text-sm text-text-primary"
                              value={editingPlayerSeasonTeeChoices[season.id] ?? getDefaultTeeColorForGender(editingPlayerGender)}
                              onChange={(event) =>
                                updateEditingPlayerSeasonTeeChoice(season.id, event.target.value as TeeColor)
                              }
                            >
                              <option value="blue">Blue</option>
                              <option value="white">White</option>
                              <option value="yellow">Yellow</option>
                              <option value="silver">Silver</option>
                            </select>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-text-secondary">
                          Create a season first, then assign each player’s tee color for that season.
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 rounded-lg border border-surface-border bg-surface-sunken p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
                          Prior Handicap Rounds
                        </p>
                        <p className="mt-2 text-xs text-text-secondary">
                          Add up to 20 prior 9-hole rounds with the date picker, course, tee, and gross score.
                        </p>
                        <p className="mt-1 text-xs text-text-secondary">
                          Leave adjusted blank when gross and adjusted are the same. Choose custom only when the round does not match one of the configured courses.
                        </p>
                        <p className="mt-1 text-xs font-semibold text-text-secondary">
                          {editingPlayerImportedRounds.length > 0
                            ? `${editingPlayerImportedRounds.length} round${editingPlayerImportedRounds.length === 1 ? '' : 's'} loaded`
                            : 'No prior rounds loaded yet'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm font-semibold text-text-primary"
                          onClick={() => setEditingPlayerRoundsExpanded((current) => !current)}
                        >
                          {editingPlayerRoundsExpanded ? 'Hide Rounds' : 'Show Rounds'}
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm font-semibold text-text-primary"
                          onClick={addEditingPlayerImportedRound}
                          disabled={isSubmitting || editingPlayerImportedRounds.length >= 20}
                        >
                          Add Round
                        </button>
                      </div>
                    </div>
                    {editingPlayerRoundsExpanded ? (
                      <div className="mt-4 space-y-3">
                        {editingPlayerImportedRounds.length > 0 ? (
                        editingPlayerImportedRounds.map((round, index) => {
                          const selectedTee =
                            round.courseId !== CUSTOM_COURSE_ID
                              ? getImportedHandicapCourseTee(
                                  data.courses,
                                  round.courseId,
                                  round.teeColor,
                                  editingPlayerGender
                                )
                              : null

                          return (
                            <div
                              key={round.id}
                              className="rounded-lg border border-surface-border bg-surface-elevated p-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-semibold text-text-primary">
                                  Round {index + 1}
                                </p>
                                <button
                                  type="button"
                                  className="text-sm text-danger-text"
                                  onClick={() => removeEditingPlayerImportedRound(round.id)}
                                >
                                  Remove
                                </button>
                              </div>
                              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                                <label className="space-y-1">
                                  <span className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
                                    Date
                                  </span>
                                  <input
                                    className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
                                    type="date"
                                    value={round.date}
                                    onChange={(event) =>
                                      updateEditingPlayerImportedRound(round.id, {
                                        date: event.target.value
                                      })
                                    }
                                  />
                                </label>
                                <label className="space-y-1 xl:col-span-2">
                                  <span className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
                                    Course
                                  </span>
                                  <select
                                    className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
                                    value={round.courseId}
                                    onChange={(event) =>
                                      updateEditingPlayerImportedRound(round.id, {
                                        courseId: event.target.value
                                      })
                                    }
                                  >
                                    {data.courses.map((course) => (
                                      <option key={course.id} value={course.id}>
                                        {course.name}
                                      </option>
                                    ))}
                                    <option value={CUSTOM_COURSE_ID}>Custom course values</option>
                                  </select>
                                </label>
                                <label className="space-y-1">
                                  <span className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
                                    Tee
                                  </span>
                                  <select
                                    className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary disabled:text-text-disabled"
                                    value={round.teeColor}
                                    onChange={(event) =>
                                      updateEditingPlayerImportedRound(round.id, {
                                        teeColor: event.target.value as TeeColor
                                      })
                                    }
                                    disabled={round.courseId === CUSTOM_COURSE_ID}
                                  >
                                    <option value="blue">Blue</option>
                                    <option value="white">White</option>
                                    <option value="yellow">Yellow</option>
                                    <option value="silver">Silver</option>
                                  </select>
                                </label>
                                <label className="space-y-1">
                                  <span className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
                                    Gross
                                  </span>
                                  <input
                                    className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
                                    inputMode="numeric"
                                    value={round.grossScore}
                                    onChange={(event) =>
                                      updateEditingPlayerImportedRound(round.id, {
                                        grossScore: event.target.value
                                      })
                                    }
                                  />
                                </label>
                              </div>
                              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                <label className="space-y-1">
                                  <span className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
                                    Adjusted
                                  </span>
                                  <input
                                    className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
                                    inputMode="numeric"
                                    placeholder="Same as gross"
                                    value={round.adjustedGrossScore}
                                    onChange={(event) =>
                                      updateEditingPlayerImportedRound(round.id, {
                                        adjustedGrossScore: event.target.value
                                      })
                                    }
                                  />
                                </label>
                                {round.courseId === CUSTOM_COURSE_ID ? (
                                  <>
                                    <label className="space-y-1">
                                      <span className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
                                        Rating
                                      </span>
                                      <input
                                        className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
                                        inputMode="decimal"
                                        value={round.courseRating}
                                        onChange={(event) =>
                                          updateEditingPlayerImportedRound(round.id, {
                                            courseRating: event.target.value
                                          })
                                        }
                                      />
                                    </label>
                                    <label className="space-y-1">
                                      <span className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
                                        Slope
                                      </span>
                                      <input
                                        className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
                                        inputMode="numeric"
                                        value={round.slopeRating}
                                        onChange={(event) =>
                                          updateEditingPlayerImportedRound(round.id, {
                                            slopeRating: event.target.value
                                          })
                                        }
                                      />
                                    </label>
                                    <label className="space-y-1">
                                      <span className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
                                        Par
                                      </span>
                                      <input
                                        className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
                                        inputMode="numeric"
                                        value={round.coursePar}
                                        onChange={(event) =>
                                          updateEditingPlayerImportedRound(round.id, {
                                            coursePar: event.target.value
                                          })
                                        }
                                      />
                                    </label>
                                  </>
                                ) : (
                                  <div className="xl:col-span-3 rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-secondary">
                                    {selectedTee ? (
                                      <>
                                        Uses {selectedTee.courseName} {selectedTee.teeColor} tee values:
                                        {' '}
                                        {selectedTee.nineHoleRating.toFixed(1)} / {selectedTee.nineHoleSlope} / Par {selectedTee.nineHolePar}
                                      </>
                                    ) : (
                                      'This course does not have tee values configured yet.'
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })
                        ) : (
                          <div className="rounded-lg border border-dashed border-surface-border px-4 py-6 text-sm text-text-secondary">
                            No prior handicap rounds added yet.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-4 rounded-lg border border-dashed border-surface-border px-4 py-4 text-sm text-text-secondary">
                        Prior rounds are collapsed for quicker profile edits.
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      className="rounded-lg border border-surface-border bg-surface-sunken px-4 py-3 text-sm font-semibold text-text-primary disabled:cursor-not-allowed disabled:text-text-disabled"
                      onClick={closeEditingPlayer}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="font-condensed rounded-lg bg-accent px-4 py-3 text-sm font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-disabled"
                      disabled={isSubmitting}
                    >
                      Save Player
                    </button>
                  </div>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-surface-border bg-surface-elevated">
        <div className="border-b border-surface-border px-4 py-3">
          <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
            Seasons ({data.seasons.length})
          </p>
        </div>
        <div className="divide-y divide-surface-border">
          {data.seasons.length > 0 ? (
            data.seasons.map((season) => (
              <div key={season.id} className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-text-primary">{season.name}</p>
                    <span
                      className={`rounded px-2 py-0.5 font-condensed text-[11px] font-semibold uppercase tracking-widest ${
                        season.archivedAt
                          ? 'bg-surface-sunken text-text-secondary'
                          : 'bg-accent-dim text-accent-text'
                      }`}
                    >
                      {season.archivedAt ? 'Archived' : 'Active'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    {season.type} · {season.startDate} to {season.endDate} · {season.weekCount} weeks
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {season.hasWeekActivity
                      ? 'Week dates are locked in because attendance or match data already exists.'
                      : 'Week dates are still editable.'}
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-surface-sunken px-3 py-2 text-sm font-semibold text-text-primary disabled:cursor-not-allowed disabled:text-text-disabled"
                    onClick={() => beginEditingSeason(season)}
                    disabled={isSubmitting || Boolean(season.archivedAt)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-surface-sunken px-3 py-2 text-sm font-semibold text-text-primary disabled:cursor-not-allowed disabled:text-text-disabled"
                    onClick={() => handleSeasonArchiveToggle(season, !season.archivedAt)}
                    disabled={isSubmitting}
                  >
                    {season.archivedAt ? 'Restore' : 'Archive'}
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-danger-dim px-3 py-2 text-sm font-semibold text-danger-text disabled:cursor-not-allowed disabled:text-text-disabled"
                    onClick={() => handleDeleteSeason(season)}
                    disabled={isSubmitting}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-text-secondary">No seasons created yet.</div>
          )}
        </div>
      </section>

      {editingSeasonId ? (
        <form
          className="rounded-xl border border-surface-border bg-surface-elevated p-4"
          onSubmit={handleSaveSeason}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
                Edit Season
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Update season metadata and, when no week activity exists yet, adjust the scheduled dates.
              </p>
            </div>
            <button
              type="button"
              className="text-sm text-text-secondary"
              onClick={() => setEditingSeasonId(null)}
            >
              Close
            </button>
          </div>
          <div className="mt-4 space-y-3">
            <input
              className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              placeholder="Season name"
              value={editingSeasonName}
              onChange={(event) => setEditingSeasonName(event.target.value)}
            />
            <select
              className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              value={editingSeasonType}
              onChange={(event) => setEditingSeasonType(event.target.value as 'spring' | 'summer')}
            >
              <option value="spring">Spring</option>
              <option value="summer">Summer</option>
            </select>
            <div>
              <p className="mb-1.5 font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
                Start Date
              </p>
              <input
                className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
                type="date"
                value={editingSeasonStartDate}
                onChange={(event) => setEditingSeasonStartDate(event.target.value)}
                disabled={editingSeason?.hasWeekActivity}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-[1fr_120px]">
              <input
                className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary disabled:text-text-disabled"
                type="date"
                value={editingSeasonDatePickerValue}
                onChange={(event) => setEditingSeasonDatePickerValue(event.target.value)}
                disabled={editingSeason?.hasWeekActivity}
              />
              <button
                type="button"
                className="rounded-lg border border-surface-border bg-surface-sunken px-4 py-3 text-sm font-semibold text-text-primary disabled:cursor-not-allowed disabled:text-text-disabled"
                onClick={() => addEditingSeasonDate(editingSeasonDatePickerValue)}
                disabled={editingSeason?.hasWeekActivity}
              >
                Add Date
              </button>
            </div>
            <div className="grid gap-3 md:grid-cols-[120px_1fr]">
              <input
                className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary disabled:text-text-disabled"
                inputMode="numeric"
                value={editingSeasonWeekCount}
                onChange={(event) => setEditingSeasonWeekCount(event.target.value)}
                disabled={editingSeason?.hasWeekActivity}
              />
              <button
                type="button"
                className="rounded-lg border border-surface-border bg-surface-sunken px-4 py-3 text-sm font-semibold text-text-primary disabled:cursor-not-allowed disabled:text-text-disabled"
                onClick={generateEditingSeasonDates}
                disabled={editingSeason?.hasWeekActivity}
              >
                Generate Weekly Dates
              </button>
            </div>
            <div className="rounded-lg border border-surface-border bg-surface-sunken p-3">
              <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
                Scheduled Week Dates
              </p>
              {editingSeason?.hasWeekActivity ? (
                <p className="mt-2 text-xs text-text-secondary">
                  Dates are read-only because this season already has attendance, pairings, or scores.
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {editingSeasonWeekDates.length > 0 ? (
                  editingSeasonWeekDates.map((date) => (
                    <button
                      key={date}
                      type="button"
                      className="rounded bg-accent-dim px-2 py-1 text-xs font-semibold text-accent-text disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => removeEditingSeasonDate(date)}
                      disabled={editingSeason?.hasWeekActivity}
                    >
                      {date} ×
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-text-secondary">No dates selected yet.</p>
                )}
              </div>
            </div>
            <button
              type="submit"
              className="font-condensed w-full rounded-lg bg-accent px-4 py-3 text-sm font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-disabled"
              disabled={isSubmitting}
            >
              Save Season
            </button>
          </div>
        </form>
      ) : null}

      <section className="rounded-xl border border-surface-border bg-surface-elevated">
        <div className="border-b border-surface-border px-4 py-3">
          <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
            Courses ({data.courses.length})
          </p>
        </div>
        <div className="divide-y divide-surface-border">
          {data.courses.length > 0 ? (
            data.courses.map((course) => (
              <div key={course.id} className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">{course.name}</p>
                  <p className="mt-1 text-xs text-text-secondary">
                    {course.tees.length} tee{course.tees.length !== 1 ? 's' : ''} · {course.holes.length} hole{course.holes.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded-lg bg-surface-sunken px-3 py-2 text-sm font-semibold text-text-primary disabled:cursor-not-allowed disabled:text-text-disabled"
                  onClick={() => openCourseEditor(course)}
                  disabled={isSubmitting}
                >
                  Edit
                </button>
              </div>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-text-secondary">No courses added yet.</div>
          )}
        </div>
        <div className="border-t border-surface-border px-4 py-3">
          <button
            type="button"
            className="font-condensed rounded-lg bg-accent px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-disabled"
            onClick={() => openCourseEditor()}
            disabled={isSubmitting}
          >
            Add Course
          </button>
        </div>
      </section>

      {editingCourseId ? (
        <div className="rounded-xl border border-surface-border bg-surface-elevated p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
              {editingCourseId === 'new' ? 'New Course' : 'Edit Course'}
            </p>
            <button
              type="button"
              className="text-sm text-text-secondary"
              onClick={() => setEditingCourseId(null)}
            >
              Close
            </button>
          </div>

          <label className="block space-y-1.5">
            <span className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">Course Name</span>
            <input
              className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
              placeholder="Course name"
              value={courseName}
              onChange={(e) => setCourseName(e.target.value)}
            />
          </label>

          <div>
            <p className="mb-2 font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">
              Default (fallback when no tee selected)
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="space-y-1">
                <span className="font-condensed text-[10px] font-semibold uppercase tracking-widest text-text-muted">9-Hole Par</span>
                <input
                  className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
                  inputMode="numeric"
                  value={courseNineHolePar}
                  onChange={(e) => setCourseNineHolePar(e.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="font-condensed text-[10px] font-semibold uppercase tracking-widest text-text-muted">9-Hole Rating</span>
                <input
                  className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
                  inputMode="decimal"
                  value={courseNineHoleRating}
                  onChange={(e) => setCourseNineHoleRating(e.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="font-condensed text-[10px] font-semibold uppercase tracking-widest text-text-muted">9-Hole Slope</span>
                <input
                  className="w-full rounded-md border border-surface-border bg-surface-sunken px-3 py-2.5 text-sm text-text-primary"
                  inputMode="numeric"
                  value={courseNineHoleSlope}
                  onChange={(e) => setCourseNineHoleSlope(e.target.value)}
                />
              </label>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">Tees</p>
              <button
                type="button"
                className="rounded bg-surface-sunken px-3 py-1 text-xs font-semibold text-text-primary hover:bg-surface-border"
                onClick={addCourseTee}
              >
                + Add Tee
              </button>
            </div>
            {courseTees.length > 0 ? (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_1fr_64px_80px_80px_32px] gap-2">
                  <p className="font-condensed text-[10px] font-semibold uppercase tracking-widest text-text-muted">Color</p>
                  <p className="font-condensed text-[10px] font-semibold uppercase tracking-widest text-text-muted">Gender</p>
                  <p className="font-condensed text-[10px] font-semibold uppercase tracking-widest text-text-muted">Par</p>
                  <p className="font-condensed text-[10px] font-semibold uppercase tracking-widest text-text-muted">Rating</p>
                  <p className="font-condensed text-[10px] font-semibold uppercase tracking-widest text-text-muted">Slope</p>
                  <span />
                </div>
                {courseTees.map((tee, index) => (
                  <div key={tee._key} className="grid grid-cols-[1fr_1fr_64px_80px_80px_32px] gap-2 items-center">
                    <select
                      className="w-full rounded-md border border-surface-border bg-surface-sunken px-2 py-2 text-sm text-text-primary"
                      value={tee.color}
                      onChange={(e) => updateCourseTee(index, 'color', e.target.value)}
                    >
                      <option value="blue">Blue</option>
                      <option value="silver">Silver</option>
                      <option value="white">White</option>
                      <option value="yellow">Yellow</option>
                    </select>
                    <select
                      className="w-full rounded-md border border-surface-border bg-surface-sunken px-2 py-2 text-sm text-text-primary"
                      value={tee.gender}
                      onChange={(e) => updateCourseTee(index, 'gender', e.target.value)}
                    >
                      <option value="man">Men</option>
                      <option value="woman">Women</option>
                    </select>
                    <input
                      className="w-full rounded-md border border-surface-border bg-surface-sunken px-2 py-2 text-sm text-text-primary"
                      inputMode="numeric"
                      value={tee.nineHolePar}
                      onChange={(e) => updateCourseTee(index, 'nineHolePar', e.target.value)}
                    />
                    <input
                      className="w-full rounded-md border border-surface-border bg-surface-sunken px-2 py-2 text-sm text-text-primary"
                      inputMode="decimal"
                      value={tee.nineHoleRating}
                      onChange={(e) => updateCourseTee(index, 'nineHoleRating', e.target.value)}
                    />
                    <input
                      className="w-full rounded-md border border-surface-border bg-surface-sunken px-2 py-2 text-sm text-text-primary"
                      inputMode="numeric"
                      value={tee.nineHoleSlope}
                      onChange={(e) => updateCourseTee(index, 'nineHoleSlope', e.target.value)}
                    />
                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded text-danger-text hover:bg-danger-dim"
                      onClick={() => removeCourseTee(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-surface-border px-4 py-4 text-sm text-text-secondary">
                No tees configured. Add a tee to set rating/slope per tee color.
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 font-condensed text-xs font-semibold uppercase tracking-widest text-text-muted">Holes</p>
            <div className="grid grid-cols-[40px_1fr_1fr] gap-2 mb-1.5 px-1">
              <p className="font-condensed text-[10px] font-semibold uppercase tracking-widest text-text-muted">#</p>
              <p className="font-condensed text-[10px] font-semibold uppercase tracking-widest text-text-muted">Par</p>
              <p className="font-condensed text-[10px] font-semibold uppercase tracking-widest text-text-muted">Stroke Index</p>
            </div>
            <div className="space-y-1.5">
              {courseHoles.map((hole) => (
                <div key={hole.holeNumber} className="grid grid-cols-[40px_1fr_1fr] gap-2 items-center">
                  <span className="font-condensed pl-1 text-xs font-semibold text-text-muted">{hole.holeNumber}</span>
                  <input
                    className="w-full rounded-md border border-surface-border bg-surface-sunken px-2 py-2 text-sm text-text-primary"
                    inputMode="numeric"
                    value={hole.par}
                    onChange={(e) => updateCourseHole(hole.holeNumber, 'par', e.target.value)}
                  />
                  <input
                    className="w-full rounded-md border border-surface-border bg-surface-sunken px-2 py-2 text-sm text-text-primary"
                    inputMode="numeric"
                    value={hole.strokeIndex}
                    onChange={(e) => updateCourseHole(hole.holeNumber, 'strokeIndex', e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              className="font-condensed w-full rounded-lg bg-accent px-4 py-3 text-sm font-bold uppercase tracking-wide text-white disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-text-disabled"
              onClick={saveCourse}
              disabled={isSubmitting}
            >
              {editingCourseId === 'new' ? 'Create Course' : 'Save Course'}
            </button>
            {editingCourseId !== 'new' ? (
              confirmDeleteCourse ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="font-condensed flex-1 rounded-lg bg-danger-dim px-4 py-3 text-sm font-bold uppercase tracking-wide text-danger-text disabled:cursor-not-allowed"
                    onClick={deleteCourse}
                    disabled={isSubmitting}
                  >
                    Confirm Delete
                  </button>
                  <button
                    type="button"
                    className="rounded-lg bg-surface-sunken px-4 py-3 text-sm font-semibold text-text-secondary"
                    onClick={() => setConfirmDeleteCourse(false)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="font-condensed w-full rounded-lg bg-surface-sunken px-4 py-3 text-sm font-semibold text-danger-text disabled:cursor-not-allowed"
                  onClick={() => setConfirmDeleteCourse(true)}
                  disabled={isSubmitting}
                >
                  Delete Course
                </button>
              )
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  )
}

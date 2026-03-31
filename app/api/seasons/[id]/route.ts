import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getApiSession, unauthorizedResponse } from '@/lib/api-auth'
import { parsePhoenixDate, sortUniqueWeekDates } from '@/lib/seasons'

function hasSeasonScheduleActivity(weeks: Array<{
  locked: boolean
  _count: {
    attendance: number
    matches: number
    holeScores: number
    handicapRecords: number
  }
}>) {
  return weeks.some(
    (week) =>
      week.locked ||
      week._count.attendance > 0 ||
      week._count.matches > 0 ||
      week._count.holeScores > 0 ||
      week._count.handicapRecords > 0
  )
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const season = await prisma.season.findUnique({
    where: { id: params.id },
    include: {
      weeks: {
        orderBy: { date: 'asc' },
        select: {
          id: true,
          weekNumber: true,
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
    }
  })

  if (!season) {
    return NextResponse.json({ error: 'Season not found' }, { status: 404 })
  }

  const body = await request.json()
  const seasonUpdates: {
    name?: string
    type?: 'spring' | 'summer'
    startDate?: Date
    endDate?: Date
    archivedAt?: Date | null
  } = {}

  const wantsArchiveToggle = typeof body.archived === 'boolean'
  const wantsNameUpdate = 'name' in body
  const wantsTypeUpdate = 'type' in body
  const wantsStartDateUpdate = 'startDate' in body
  const wantsWeekDatesUpdate = 'weekDates' in body
  const wantsMetadataEdit =
    wantsNameUpdate || wantsTypeUpdate || wantsStartDateUpdate || wantsWeekDatesUpdate

  if (season.archivedAt && wantsMetadataEdit) {
    return NextResponse.json(
      { error: 'Archived seasons must be restored before editing' },
      { status: 409 }
    )
  }

  if (wantsNameUpdate) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      return NextResponse.json({ error: 'Season name is required' }, { status: 400 })
    }
    seasonUpdates.name = name
  }

  if (wantsTypeUpdate) {
    if (body.type !== 'spring' && body.type !== 'summer') {
      return NextResponse.json({ error: 'Season type must be spring or summer' }, { status: 400 })
    }
    seasonUpdates.type = body.type
  }

  let parsedStartDate: Date | null | undefined
  if (wantsStartDateUpdate) {
    parsedStartDate = parsePhoenixDate(body.startDate)
    if (!parsedStartDate) {
      return NextResponse.json({ error: 'Season start date is invalid' }, { status: 400 })
    }
  }

  let weekDates: Date[] | undefined
  if (wantsWeekDatesUpdate) {
    if (!Array.isArray(body.weekDates)) {
      return NextResponse.json({ error: 'weekDates must be an array' }, { status: 400 })
    }

    weekDates = sortUniqueWeekDates(body.weekDates)
    if (weekDates.length === 0) {
      return NextResponse.json({ error: 'At least one week date is required' }, { status: 400 })
    }
  }

  if ((wantsStartDateUpdate || wantsWeekDatesUpdate) && hasSeasonScheduleActivity(season.weeks)) {
    return NextResponse.json(
      { error: 'Season dates can only be edited before weeks have attendance, pairings, or scores' },
      { status: 409 }
    )
  }

  if (wantsArchiveToggle) {
    seasonUpdates.archivedAt = body.archived ? season.archivedAt ?? new Date() : null
  }

  if (wantsWeekDatesUpdate) {
    const orderedWeekDates = weekDates ?? []
    seasonUpdates.startDate = parsedStartDate ?? orderedWeekDates[0]
    seasonUpdates.endDate = orderedWeekDates[orderedWeekDates.length - 1]

    const updatedSeason = await prisma.$transaction(async (tx) => {
      await tx.season.update({
        where: { id: params.id },
        data: seasonUpdates
      })

      await tx.week.deleteMany({
        where: { seasonId: params.id }
      })

      for (const [index, weekDate] of orderedWeekDates.entries()) {
        await tx.week.create({
          data: {
            seasonId: params.id,
            weekNumber: index + 1,
            date: weekDate
          }
        })
      }

      return tx.season.findUnique({
        where: { id: params.id },
        include: {
          weeks: {
            orderBy: { date: 'asc' }
          }
        }
      })
    })

    return NextResponse.json(updatedSeason)
  }

  if (wantsStartDateUpdate && parsedStartDate) {
    seasonUpdates.startDate = parsedStartDate
  }

  if (Object.keys(seasonUpdates).length === 0) {
    return NextResponse.json({ error: 'No season changes were provided' }, { status: 400 })
  }

  const updatedSeason = await prisma.season.update({
    where: { id: params.id },
    data: seasonUpdates,
    include: {
      weeks: {
        orderBy: { date: 'asc' }
      }
    }
  })

  return NextResponse.json(updatedSeason)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const season = await prisma.season.findUnique({
    where: { id: params.id },
    select: { id: true }
  })

  if (!season) {
    return NextResponse.json({ error: 'Season not found' }, { status: 404 })
  }

  await prisma.season.delete({
    where: { id: params.id }
  })

  return NextResponse.json({ ok: true })
}

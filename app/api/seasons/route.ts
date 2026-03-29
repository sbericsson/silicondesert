import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getApiSession, unauthorizedResponse } from '@/lib/api-auth'

function parseDate(value: unknown) {
  if (typeof value !== 'string') {
    return null
  }

  const date = new Date(`${value}T00:00:00-07:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

export async function GET() {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const seasons = await prisma.season.findMany({
    include: {
      weeks: {
        orderBy: { date: 'asc' }
      }
    },
    orderBy: { startDate: 'asc' }
  })

  return NextResponse.json(seasons)
}

export async function POST(request: NextRequest) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const body = await request.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const type = body.type === 'spring' || body.type === 'summer' ? body.type : null
  const startDate = parseDate(body.startDate)
  const weekDates = Array.isArray(body.weekDates) ? body.weekDates.map(parseDate).filter(Boolean) : []

  if (!name || !type || !startDate || weekDates.length === 0) {
    return NextResponse.json(
      { error: 'name, type, startDate, and at least one weekDate are required' },
      { status: 400 }
    )
  }

  const orderedWeekDates = [...weekDates].sort((a, b) => a.getTime() - b.getTime())
  const endDate = orderedWeekDates[orderedWeekDates.length - 1]

  const season = await prisma.$transaction(async (tx) => {
    const createdSeason = await tx.season.create({
      data: {
        name,
        type,
        startDate,
        endDate
      }
    })

    for (const [index, weekDate] of orderedWeekDates.entries()) {
      await tx.week.create({
        data: {
          seasonId: createdSeason.id,
          weekNumber: index + 1,
          date: weekDate
        }
      })
    }

    return tx.season.findUnique({
      where: { id: createdSeason.id },
      include: {
        weeks: {
          orderBy: { date: 'asc' }
        }
      }
    })
  })

  return NextResponse.json(season, { status: 201 })
}

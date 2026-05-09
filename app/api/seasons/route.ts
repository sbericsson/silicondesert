import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getApiSession, unauthorizedResponse } from '@/lib/api-auth'
import { getDefaultTeeColorForGender } from '@/lib/course-tee'
import { parsePhoenixDate, sortUniqueWeekDates } from '@/lib/seasons'

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
  const startDate = parsePhoenixDate(body.startDate)
  const weekDates = Array.isArray(body.weekDates) ? sortUniqueWeekDates(body.weekDates) : []

  if (!name || !type || !startDate || weekDates.length === 0) {
    return NextResponse.json(
      { error: 'name, type, startDate, and at least one weekDate are required' },
      { status: 400 }
    )
  }

  const orderedWeekDates = [...weekDates].sort((a, b) => a.getTime() - b.getTime())
  const endDate = orderedWeekDates[orderedWeekDates.length - 1]

  try {
    const season = await prisma.$transaction(async (tx) => {
      const createdSeason = await tx.season.create({
        data: {
          name,
          type,
          startDate,
          endDate
        }
      })

      const [priorTeeChoices, players] = await Promise.all([
        tx.playerSeasonTee.findMany({
          where: {
            seasonId: {
              not: createdSeason.id
            }
          },
          include: {
            season: {
              select: {
                startDate: true
              }
            }
          },
          orderBy: [
            {
              season: {
                startDate: 'desc'
              }
            },
            {
              createdAt: 'desc'
            }
          ]
        }),
        tx.player.findMany({
          select: {
            id: true,
            gender: true,
            defaultTeeColor: true
          }
        })
      ])

      const latestChoiceByPlayer = new Map<string, (typeof priorTeeChoices)[number]>()
      for (const choice of priorTeeChoices) {
        if (!latestChoiceByPlayer.has(choice.playerId)) {
          latestChoiceByPlayer.set(choice.playerId, choice)
        }
      }

      if (players.length > 0) {
        await tx.playerSeasonTee.createMany({
          data: players.map((player) => ({
            playerId: player.id,
            seasonId: createdSeason.id,
            teeColor:
              latestChoiceByPlayer.get(player.id)?.teeColor ??
              player.defaultTeeColor ??
              getDefaultTeeColorForGender(player.gender)
          }))
        })
      }

      for (const [index, weekDate] of orderedWeekDates.entries()) {
        await tx.week.create({
          data: {
            seasonId: createdSeason.id,
            weekNumber: index + 1,
            date: weekDate,
            handicapMode: 'index'
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
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'A season with one of those unique values already exists.' },
          { status: 409 }
        )
      }
    }

    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ error: 'Unable to create season' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getApiSession, unauthorizedResponse } from '@/lib/api-auth'
import { getCurrentWeekRecord } from '@/lib/week'

export async function GET(request: NextRequest) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  if (request.nextUrl.searchParams.get('current') === 'true') {
    const week = await getCurrentWeekRecord()
    return NextResponse.json(week)
  }

  const seasonId = request.nextUrl.searchParams.get('seasonId')

  const weeks = await prisma.week.findMany({
    where: seasonId
      ? { seasonId }
      : {
          season: {
            is: {
              archivedAt: null
            }
          }
        },
    include: {
      season: true,
      course: true
    },
    orderBy: [{ date: 'asc' }]
  })

  return NextResponse.json(weeks)
}

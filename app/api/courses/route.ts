import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getApiSession, unauthorizedResponse } from '@/lib/api-auth'

export async function GET() {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const courses = await prisma.course.findMany({
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

  return NextResponse.json(courses)
}

export async function POST(request: Request) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const body = await request.json()
  const { name, nineHolePar, nineHoleRating, nineHoleSlope, tees = [], holes = [] } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Course name is required' }, { status: 400 })
  }

  const course = await prisma.course.create({
    data: {
      name: name.trim(),
      nineHolePar: Number(nineHolePar) || 36,
      nineHoleRating: Number(nineHoleRating) || 36.0,
      nineHoleSlope: Number(nineHoleSlope) || 113,
      tees: {
        create: tees.map((tee: { color: string; gender: string; nineHolePar: number; nineHoleRating: number; nineHoleSlope: number }) => ({
          color: tee.color,
          gender: tee.gender,
          nineHolePar: Number(tee.nineHolePar),
          nineHoleRating: Number(tee.nineHoleRating),
          nineHoleSlope: Number(tee.nineHoleSlope)
        }))
      },
      holes: {
        create: holes.map((hole: { holeNumber: number; par: number; strokeIndex: number }) => ({
          holeNumber: Number(hole.holeNumber),
          par: Number(hole.par),
          strokeIndex: Number(hole.strokeIndex)
        }))
      }
    }
  })

  return NextResponse.json(course, { status: 201 })
}

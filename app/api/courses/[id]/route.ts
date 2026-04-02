import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getApiSession, unauthorizedResponse } from '@/lib/api-auth'

interface RouteParams {
  params: { id: string }
}

export async function PUT(request: Request, { params }: RouteParams) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const body = await request.json()
  const { name, nineHolePar, nineHoleRating, nineHoleSlope, tees = [], holes = [] } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Course name is required' }, { status: 400 })
  }

  const course = await prisma.$transaction(async (tx) => {
    const updated = await tx.course.update({
      where: { id: params.id },
      data: {
        name: name.trim(),
        nineHolePar: Number(nineHolePar) || 36,
        nineHoleRating: Number(nineHoleRating) || 36.0,
        nineHoleSlope: Number(nineHoleSlope) || 113
      }
    })

    await tx.courseTee.deleteMany({ where: { courseId: params.id } })
    if (tees.length > 0) {
      await tx.courseTee.createMany({
        data: tees.map((tee: { color: string; gender: string; nineHolePar: number; nineHoleRating: number; nineHoleSlope: number }) => ({
          courseId: params.id,
          color: tee.color,
          gender: tee.gender,
          nineHolePar: Number(tee.nineHolePar),
          nineHoleRating: Number(tee.nineHoleRating),
          nineHoleSlope: Number(tee.nineHoleSlope)
        }))
      })
    }

    await tx.courseHole.deleteMany({ where: { courseId: params.id } })
    if (holes.length > 0) {
      await tx.courseHole.createMany({
        data: holes.map((hole: { holeNumber: number; par: number; strokeIndex: number }) => ({
          courseId: params.id,
          holeNumber: Number(hole.holeNumber),
          par: Number(hole.par),
          strokeIndex: Number(hole.strokeIndex)
        }))
      })
    }

    return updated
  })

  return NextResponse.json(course)
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  await prisma.course.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}

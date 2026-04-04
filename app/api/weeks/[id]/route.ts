import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getApiSession, unauthorizedResponse } from '@/lib/api-auth'
import { writeAuditLog } from '@/lib/audit'

function parseOptionalInt(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed)) {
    return null
  }

  return parsed
}

async function getCoursePar3HoleNumbers(courseId: string) {
  const holes = await prisma.courseHole.findMany({
    where: { courseId },
    select: {
      holeNumber: true,
      par: true
    }
  })

  return holes.filter((hole) => hole.par === 3).map((hole) => hole.holeNumber)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const body = await request.json()
  const updates: {
    courseId?: string | null
    ctpHoleNumber?: number | null
    longestPuttHoleNumber?: number | null
    ctpWinnerId?: string | null
    longestPuttWinnerId?: string | null
  } = {}

  if ('courseId' in body) {
    updates.courseId = body.courseId || null
  }

  if ('ctpHoleNumber' in body) {
    updates.ctpHoleNumber = parseOptionalInt(body.ctpHoleNumber)
  }

  if ('longestPuttHoleNumber' in body) {
    updates.longestPuttHoleNumber = parseOptionalInt(body.longestPuttHoleNumber)
  }

  if ('ctpWinnerId' in body) {
    updates.ctpWinnerId = typeof body.ctpWinnerId === 'string' ? body.ctpWinnerId : null
  }

  if ('longestPuttWinnerId' in body) {
    updates.longestPuttWinnerId = typeof body.longestPuttWinnerId === 'string' ? body.longestPuttWinnerId : null
  }

  const existingWeek = await prisma.week.findUnique({
    where: { id: params.id },
    include: {
      course: {
        include: {
          holes: true
        }
      },
      season: {
        select: {
          archivedAt: true
        }
      }
    }
  })

  if (!existingWeek) {
    return NextResponse.json({ error: 'Week not found' }, { status: 404 })
  }

  if (existingWeek.season.archivedAt) {
    return NextResponse.json({ error: 'Archived seasons cannot be edited' }, { status: 409 })
  }

  if (existingWeek.completedAt) {
    return NextResponse.json({ error: 'Closed weeks cannot be edited' }, { status: 409 })
  }

  // CTP/LP winner fields can be updated after lock (post-round data).
  // Course, CTP hole, and LP hole cannot be changed once locked.
  const lockedFields = ['courseId', 'ctpHoleNumber', 'longestPuttHoleNumber'] as const
  const hasLockedFieldUpdate = lockedFields.some((field) => field in updates)
  if (existingWeek.locked && hasLockedFieldUpdate) {
    return NextResponse.json({ error: 'Locked weeks cannot be edited' }, { status: 409 })
  }

  const effectiveCourseId = updates.courseId !== undefined ? updates.courseId : existingWeek.courseId
  const requestedCtpHoleNumber =
    updates.ctpHoleNumber !== undefined ? updates.ctpHoleNumber : existingWeek.ctpHoleNumber

  if (updates.ctpHoleNumber !== undefined && updates.ctpHoleNumber !== null && !effectiveCourseId) {
    return NextResponse.json(
      { error: 'Select a course before choosing the CTP hole' },
      { status: 400 }
    )
  }

  let validPar3HoleNumbers: number[] = []
  if (effectiveCourseId) {
    validPar3HoleNumbers = await getCoursePar3HoleNumbers(effectiveCourseId)
  }

  if (
    requestedCtpHoleNumber !== null &&
    requestedCtpHoleNumber !== undefined &&
    effectiveCourseId &&
    !validPar3HoleNumbers.includes(requestedCtpHoleNumber)
  ) {
    if (updates.ctpHoleNumber !== undefined) {
      return NextResponse.json(
        { error: 'Closest to pin must be set to a par 3 hole on the selected course' },
        { status: 400 }
      )
    }

    // Only auto-reset CTP when the course itself is being changed, not when
    // updating other fields (e.g. ctpWinnerId) while the hole is stale.
    if ('courseId' in updates) {
      updates.ctpHoleNumber = null
      updates.ctpWinnerId = null
    } else {
      return NextResponse.json(
        {
          error: `CTP hole ${requestedCtpHoleNumber} is not a par 3 on the selected course. Clear the CTP hole before saving a winner.`
        },
        { status: 409 }
      )
    }
  }

  const updatedWeek = await prisma.$transaction(async (tx) => {
    const week = await tx.week.update({
      where: { id: params.id },
      data: updates
    })

    for (const [field, newValue] of Object.entries(updates)) {
      const oldValue = existingWeek[field as keyof typeof existingWeek]
      if (oldValue !== newValue) {
        await writeAuditLog(tx, {
          weekId: params.id,
          action: 'week_update',
          field,
          oldValue: oldValue === null || oldValue === undefined ? null : String(oldValue),
          newValue: newValue === null || newValue === undefined ? null : String(newValue)
        })
      }
    }

    return week
  })

  return NextResponse.json(updatedWeek)
}

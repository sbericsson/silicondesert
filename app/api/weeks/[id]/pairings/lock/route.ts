import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getApiSession, unauthorizedResponse } from '@/lib/api-auth'
import { writeAuditLog } from '@/lib/audit'
import { getCourseTee, getPlayerSeasonTeeColor } from '@/lib/course-tee'
import { getPlayerHandicapIndexValue, getPlayingHandicap } from '@/lib/playing-handicap'

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const week = await prisma.week.findUnique({
    where: { id: params.id },
    include: {
      matches: {
        include: {
          player1: {
            include: {
              handicapRecords: {
                orderBy: { date: 'desc' },
                take: 20
              },
              seasonTeeChoices: true
            }
          },
          player2: {
            include: {
              handicapRecords: {
                orderBy: { date: 'desc' },
                take: 20
              },
              seasonTeeChoices: true
            }
          }
        }
      },
      course: {
        include: {
          tees: true
        }
      },
      season: {
        select: {
          archivedAt: true,
          id: true
        }
      }
    }
  })

  if (!week) {
    return NextResponse.json({ error: 'Week not found' }, { status: 404 })
  }

  if (week.season.archivedAt) {
    return NextResponse.json({ error: 'Archived seasons cannot be edited' }, { status: 409 })
  }

  if (week.completedAt) {
    return NextResponse.json({ error: 'Closed weeks cannot be edited' }, { status: 409 })
  }

  if (week.locked) {
    return NextResponse.json({ error: 'Week is already locked' }, { status: 409 })
  }

  if (week.matches.length === 0) {
    return NextResponse.json({ error: 'Generate pairings before locking the week' }, { status: 400 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.week.update({
      where: { id: params.id },
      data: { locked: true }
    })

    for (const match of week.matches) {
      const player1HandicapIndex = getPlayerHandicapIndexValue(match.player1)
      const player2HandicapIndex = getPlayerHandicapIndexValue(match.player2)
      const player1TeeColor = getPlayerSeasonTeeColor(
        match.player1.seasonTeeChoices,
        week.season.id,
        match.player1.gender,
        match.player1.defaultTeeColor
      )
      const player2TeeColor = getPlayerSeasonTeeColor(
        match.player2.seasonTeeChoices,
        week.season.id,
        match.player2.gender,
        match.player2.defaultTeeColor
      )
      const player1Tee = week.course
        ? getCourseTee(week.course.tees, player1TeeColor, match.player1.gender, {
            color: 'white',
            gender: 'man',
            nineHolePar: week.course.nineHolePar,
            nineHoleRating: week.course.nineHoleRating,
            nineHoleSlope: week.course.nineHoleSlope
          })
        : null
      const player2Tee = week.course
        ? getCourseTee(week.course.tees, player2TeeColor, match.player2.gender, {
            color: 'white',
            gender: 'man',
            nineHolePar: week.course.nineHolePar,
            nineHoleRating: week.course.nineHoleRating,
            nineHoleSlope: week.course.nineHoleSlope
          })
        : null

      await tx.match.update({
        where: { id: match.id },
        data: {
          locked: true,
          player1HandicapIndex,
          player2HandicapIndex,
          player1PlayingHandicap: getPlayingHandicap(week.handicapMode, player1HandicapIndex, player1Tee),
          player2PlayingHandicap: getPlayingHandicap(week.handicapMode, player2HandicapIndex, player2Tee)
        }
      })
    }

    await writeAuditLog(tx, {
      weekId: params.id,
      action: 'week_lock',
      field: 'locked',
      oldValue: 'false',
      newValue: 'true'
    })
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const week = await prisma.week.findUnique({
    where: { id: params.id },
    include: {
      matches: {
        include: {
          holeScores: {
            select: { id: true }
          }
        }
      },
      season: {
        select: {
          archivedAt: true
        }
      }
    }
  })

  if (!week) {
    return NextResponse.json({ error: 'Week not found' }, { status: 404 })
  }

  if (week.season.archivedAt) {
    return NextResponse.json({ error: 'Archived seasons cannot be edited' }, { status: 409 })
  }

  if (week.completedAt) {
    return NextResponse.json({ error: 'Closed weeks cannot be edited' }, { status: 409 })
  }

  if (!week.locked) {
    return NextResponse.json({ error: 'Week is not locked' }, { status: 409 })
  }

  if (week.matches.some((match) => match.holeScores.length > 0)) {
    return NextResponse.json(
      { error: 'Weeks with entered scores cannot be unlocked' },
      { status: 409 }
    )
  }

  await prisma.$transaction(async (tx) => {
    await tx.week.update({
      where: { id: params.id },
      data: { locked: false }
    })

    await tx.match.updateMany({
      where: { weekId: params.id },
      data: {
        locked: false,
        player1HandicapIndex: null,
        player2HandicapIndex: null,
        player1PlayingHandicap: null,
        player2PlayingHandicap: null
      }
    })

    await writeAuditLog(tx, {
      weekId: params.id,
      action: 'week_unlock',
      field: 'locked',
      oldValue: 'true',
      newValue: 'false'
    })
  })

  return NextResponse.json({ ok: true })
}

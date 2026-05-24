import { NextRequest, NextResponse } from 'next/server'
import { getApiSession, unauthorizedResponse } from '@/lib/api-auth'
import { getMatchScorePageData, submitMatchScores } from '@/lib/match-score'
import { revalidateWeekPages } from '@/lib/revalidate-week-pages'
import { prisma } from '@/lib/db'
import { writeAuditLog } from '@/lib/audit'

export async function GET(
  _request: Request,
  { params }: { params: { id: string; matchId: string } }
) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const data = await getMatchScorePageData(params.id, params.matchId)
  if (!data) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; matchId: string } }
) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const body = await request.json()

  try {
    const result = await submitMatchScores({
      weekId: params.id,
      matchId: params.matchId,
      player1Scores: body.player1Scores ?? [],
      player2Scores: body.player2Scores ?? []
    })

    revalidateWeekPages(params.id)

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to submit scores' },
      { status: 400 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; matchId: string } }
) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const match = await prisma.match.findUnique({
    where: { id: params.matchId },
    include: {
      week: {
        select: {
          id: true,
          locked: true,
          completedAt: true,
          season: { select: { archivedAt: true } }
        }
      }
    }
  })

  if (!match || match.week.id !== params.id) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 })
  }

  if (match.week.season.archivedAt) {
    return NextResponse.json({ error: 'Archived seasons cannot be edited' }, { status: 409 })
  }

  if (match.week.completedAt) {
    return NextResponse.json({ error: 'Closed weeks cannot be edited' }, { status: 409 })
  }

  await prisma.$transaction(async (tx) => {
    await tx.holeScore.deleteMany({ where: { matchId: params.matchId } })

    await tx.match.update({
      where: { id: params.matchId },
      data: {
        matchPlayLeadBy: null,
        matchPlayHolesRemaining: null,
        matchPlayWinnerId: null
      }
    })

    await writeAuditLog(tx, {
      weekId: params.id,
      action: 'match_scores_clear',
      field: 'holeScores',
      oldValue: 'scores',
      newValue: 'cleared'
    })
  })

  revalidateWeekPages(params.id)

  return NextResponse.json({ ok: true })
}

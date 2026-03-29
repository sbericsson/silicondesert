import { NextRequest, NextResponse } from 'next/server'
import { getApiSession, unauthorizedResponse } from '@/lib/api-auth'
import { getMatchScorePageData, submitMatchScores } from '@/lib/match-score'

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
      player2Scores: body.player2Scores ?? [],
      matchPlayLeadBy: body.matchPlayLeadBy,
      matchPlayHolesRemaining: body.matchPlayHolesRemaining,
      matchPlayWinnerId: body.matchPlayWinnerId ?? null
    })

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to submit scores' },
      { status: 400 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getApiSession, unauthorizedResponse } from '@/lib/api-auth'

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
    name?: string
    email?: string | null
    active?: boolean
    seedHandicap?: number | null
  } = {}

  if ('name' in body && typeof body.name === 'string') {
    updates.name = body.name.trim()
  }

  if ('email' in body) {
    updates.email =
      typeof body.email === 'string' && body.email.trim().length > 0 ? body.email.trim() : null
  }

  if ('active' in body && typeof body.active === 'boolean') {
    updates.active = body.active
  }

  if ('seedHandicap' in body) {
    updates.seedHandicap =
      body.seedHandicap === null || body.seedHandicap === ''
        ? null
        : Number(body.seedHandicap)
  }

  const player = await prisma.player.update({
    where: { id: params.id },
    data: updates
  })

  return NextResponse.json(player)
}

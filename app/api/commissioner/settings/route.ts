import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getApiSession, unauthorizedResponse } from '@/lib/api-auth'

export async function GET() {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const commissioner = await prisma.commissioner.findFirst({
    select: {
      publicRosterEnabled: true,
      defaultTrailingPlayerId: true
    }
  })

  return NextResponse.json({
    publicRosterEnabled: commissioner?.publicRosterEnabled ?? false,
    defaultTrailingPlayerId: commissioner?.defaultTrailingPlayerId ?? null
  })
}

export async function PATCH(request: NextRequest) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const body = await request.json()
  const updates: {
    publicRosterEnabled?: boolean
    defaultTrailingPlayerId?: string | null
  } = {}

  if ('publicRosterEnabled' in body) {
    if (typeof body.publicRosterEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'publicRosterEnabled must be a boolean' },
        { status: 400 }
      )
    }

    updates.publicRosterEnabled = body.publicRosterEnabled
  }

  if ('defaultTrailingPlayerId' in body) {
    if (body.defaultTrailingPlayerId === null || body.defaultTrailingPlayerId === '') {
      updates.defaultTrailingPlayerId = null
    } else if (typeof body.defaultTrailingPlayerId === 'string') {
      const player = await prisma.player.findUnique({
        where: { id: body.defaultTrailingPlayerId },
        select: { id: true }
      })

      if (!player) {
        return NextResponse.json(
          { error: 'Default trailing player could not be found' },
          { status: 400 }
        )
      }

      updates.defaultTrailingPlayerId = player.id
    } else {
      return NextResponse.json(
        { error: 'defaultTrailingPlayerId must be a player id or null' },
        { status: 400 }
      )
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No commissioner settings were provided' }, { status: 400 })
  }

  const commissioner = await prisma.commissioner.findFirst({
    select: { id: true }
  })

  if (!commissioner) {
    return NextResponse.json({ error: 'Commissioner not found' }, { status: 404 })
  }

  const updated = await prisma.commissioner.update({
    where: { id: commissioner.id },
    data: updates,
    select: {
      publicRosterEnabled: true,
      defaultTrailingPlayerId: true
    }
  })

  return NextResponse.json(updated)
}

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
      publicRosterEnabled: true
    }
  })

  return NextResponse.json({
    publicRosterEnabled: commissioner?.publicRosterEnabled ?? false
  })
}

export async function PATCH(request: NextRequest) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const body = await request.json()
  if (typeof body.publicRosterEnabled !== 'boolean') {
    return NextResponse.json(
      { error: 'publicRosterEnabled must be a boolean' },
      { status: 400 }
    )
  }

  const commissioner = await prisma.commissioner.findFirst({
    select: { id: true }
  })

  if (!commissioner) {
    return NextResponse.json({ error: 'Commissioner not found' }, { status: 404 })
  }

  const updated = await prisma.commissioner.update({
    where: { id: commissioner.id },
    data: {
      publicRosterEnabled: body.publicRosterEnabled
    },
    select: {
      publicRosterEnabled: true
    }
  })

  return NextResponse.json(updated)
}

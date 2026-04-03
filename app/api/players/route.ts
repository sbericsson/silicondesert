import { NextRequest, NextResponse } from 'next/server'
import type { Gender, TeeColor } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getApiSession, unauthorizedResponse } from '@/lib/api-auth'
import { normalizeUsPhoneNumber } from '@/lib/phone'
import { getDefaultTeeColorForGender } from '@/lib/course-tee'

export async function GET(request: NextRequest) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const includeInactive = request.nextUrl.searchParams.get('all') === 'true'

  const players = await prisma.player.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: { name: 'asc' }
  })

  return NextResponse.json(players)
}

export async function POST(request: NextRequest) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const body = await request.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const gender: Gender = body.gender === 'woman' ? 'woman' : 'man'
  const email =
    typeof body.email === 'string' && body.email.trim().length > 0 ? body.email.trim() : null
  const defaultTeeColor =
    body.defaultTeeColor === 'blue' ||
    body.defaultTeeColor === 'white' ||
    body.defaultTeeColor === 'yellow' ||
    body.defaultTeeColor === 'silver'
      ? (body.defaultTeeColor as TeeColor)
      : getDefaultTeeColorForGender(gender)
  const rawCellPhone = typeof body.cellPhone === 'string' ? body.cellPhone.trim() : ''
  const cellPhone = normalizeUsPhoneNumber(rawCellPhone)
  const seedHandicap =
    body.seedHandicap === null || body.seedHandicap === undefined || body.seedHandicap === ''
      ? null
      : Number(body.seedHandicap)

  if (!name) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  if (seedHandicap !== null && Number.isNaN(seedHandicap)) {
    return NextResponse.json({ error: 'Seed handicap must be numeric' }, { status: 400 })
  }

  if (rawCellPhone && !cellPhone) {
    return NextResponse.json(
      { error: 'Cell phone must be a valid 10-digit US number' },
      { status: 400 }
    )
  }

  const player = await prisma.player.create({
    data: {
      name,
      gender,
      defaultTeeColor,
      email,
      cellPhone,
      seedHandicap
    }
  })

  return NextResponse.json(player, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getApiSession, unauthorizedResponse } from '@/lib/api-auth'
import { normalizeUsPhoneNumber } from '@/lib/phone'
import {
  validateImportedHandicapRounds,
  toImportedHandicapRoundRecords
} from '@/lib/imported-handicap'
import { recomputeUsedInIndex } from '@/lib/handicap-records'

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
    cellPhone?: string | null
    active?: boolean
    seedHandicap?: number | null
  } = {}
  let importedHandicapRounds:
    | ReturnType<typeof validateImportedHandicapRounds>['rounds']
    | undefined

  if ('name' in body && typeof body.name === 'string') {
    updates.name = body.name.trim()
  }

  if ('email' in body) {
    updates.email =
      typeof body.email === 'string' && body.email.trim().length > 0 ? body.email.trim() : null
  }

  if ('cellPhone' in body) {
    const rawCellPhone = typeof body.cellPhone === 'string' ? body.cellPhone.trim() : ''
    const normalizedCellPhone = normalizeUsPhoneNumber(rawCellPhone)

    if (rawCellPhone && !normalizedCellPhone) {
      return NextResponse.json(
        { error: 'Cell phone must be a valid 10-digit US number' },
        { status: 400 }
      )
    }

    updates.cellPhone = normalizedCellPhone
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

  if (updates.seedHandicap !== undefined && updates.seedHandicap !== null && Number.isNaN(updates.seedHandicap)) {
    return NextResponse.json({ error: 'Seed handicap must be numeric' }, { status: 400 })
  }

  if ('importedHandicapRounds' in body) {
    if (!Array.isArray(body.importedHandicapRounds)) {
      return NextResponse.json(
        { error: 'Imported handicap rounds must be an array' },
        { status: 400 }
      )
    }

    const validatedImportedRounds = validateImportedHandicapRounds(body.importedHandicapRounds)
    if (validatedImportedRounds.error) {
      return NextResponse.json({ error: validatedImportedRounds.error }, { status: 400 })
    }

    importedHandicapRounds = validatedImportedRounds.rounds
  }

  const player = await prisma.$transaction(async (tx) => {
    const updatedPlayer = await tx.player.update({
      where: { id: params.id },
      data: updates
    })

    if (importedHandicapRounds !== undefined) {
      await tx.handicapRecord.deleteMany({
        where: {
          playerId: params.id,
          isImported: true,
          weekId: null
        }
      })

      const importedRecords = toImportedHandicapRoundRecords(importedHandicapRounds)
      if (importedRecords.length > 0) {
        await tx.handicapRecord.createMany({
          data: importedRecords.map((round) => ({
            playerId: params.id,
            weekId: null,
            date: new Date(`${round.date}T00:00:00-07:00`),
            grossScore: round.grossScore,
            adjustedGrossScore: round.adjustedGrossScore,
            courseRating: round.courseRating,
            slopeRating: round.slopeRating,
            coursePar: round.coursePar,
            courseDifferential: round.courseDifferential,
            isImported: true
          }))
        })
      }

      await recomputeUsedInIndex(tx, params.id)
    }

    return updatedPlayer
  })

  return NextResponse.json(player)
}

import { NextRequest, NextResponse } from 'next/server'
import type { Gender, TeeColor } from '@prisma/client'
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
    gender?: Gender
    email?: string | null
    cellPhone?: string | null
    active?: boolean
    seedHandicap?: number | null
  } = {}
  let importedHandicapRounds:
    | ReturnType<typeof validateImportedHandicapRounds>['rounds']
    | undefined
  let seasonTeeChoices:
    | Array<{
        seasonId: string
        teeColor: TeeColor
      }>
    | undefined

  if ('name' in body && typeof body.name === 'string') {
    updates.name = body.name.trim()
  }

  if ('gender' in body) {
    if (body.gender !== 'man' && body.gender !== 'woman') {
      return NextResponse.json({ error: 'Gender must be man or woman' }, { status: 400 })
    }

    updates.gender = body.gender
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

  if ('seasonTeeChoices' in body) {
    if (!Array.isArray(body.seasonTeeChoices)) {
      return NextResponse.json({ error: 'Season tee choices must be an array' }, { status: 400 })
    }

    const normalizedChoices = body.seasonTeeChoices.flatMap((choice: unknown) => {
      if (!choice || typeof choice !== 'object') {
        return []
      }

      const seasonId = typeof (choice as { seasonId?: unknown }).seasonId === 'string'
        ? (choice as { seasonId: string }).seasonId
        : null
      const teeColor = (choice as { teeColor?: unknown }).teeColor

      if (
        !seasonId ||
        (teeColor !== 'blue' &&
          teeColor !== 'white' &&
          teeColor !== 'yellow' &&
          teeColor !== 'silver')
      ) {
        return []
      }

      return [{ seasonId, teeColor }]
    })

    if (normalizedChoices.length !== body.seasonTeeChoices.length) {
      return NextResponse.json(
        { error: 'Each season tee choice must include a seasonId and teeColor' },
        { status: 400 }
      )
    }

    seasonTeeChoices = normalizedChoices
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

    if (seasonTeeChoices !== undefined) {
      const validSeasonIds = new Set(
        (
          await tx.season.findMany({
            where: {
              id: {
                in: seasonTeeChoices.map((choice) => choice.seasonId)
              }
            },
            select: { id: true }
          })
        ).map((season) => season.id)
      )

      if (validSeasonIds.size !== seasonTeeChoices.length) {
        throw new Error('One or more selected seasons could not be found')
      }

      for (const choice of seasonTeeChoices) {
        await tx.playerSeasonTee.upsert({
          where: {
            playerId_seasonId: {
              playerId: params.id,
              seasonId: choice.seasonId
            }
          },
          update: {
            teeColor: choice.teeColor
          },
          create: {
            playerId: params.id,
            seasonId: choice.seasonId,
            teeColor: choice.teeColor
          }
        })
      }
    }

    return updatedPlayer
  }).catch((error: Error) => {
    throw error
  })

  return NextResponse.json(player)
}

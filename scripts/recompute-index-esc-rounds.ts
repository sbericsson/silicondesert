import { existsSync, readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { getCourseTee, getPlayerMatchTeeColor } from '../lib/course-tee'
import {
  applyESC,
  exactHandicapIndex,
  roundToWholeHandicap,
  scoreDifferential,
  strokesReceivedOnHole
} from '../lib/handicap'
import { recomputeUsedInIndex } from '../lib/handicap-records'

function loadDotEnv() {
  if (!existsSync('.env')) {
    return
  }

  const lines = readFileSync('.env', 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }

    const key = trimmed.slice(0, separatorIndex).trim()
    const rawValue = trimmed.slice(separatorIndex + 1).trim()
    if (!key || process.env[key] !== undefined) {
      continue
    }

    process.env[key] = rawValue.replace(/^["']|["']$/g, '')
  }
}

loadDotEnv()

const prisma = new PrismaClient()

type RecomputedRound = {
  date: Date
  weekId: string | null
  courseDifferential: number
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0)
}

function getEscIndex(
  seedHandicap: number | null,
  previousRecords: RecomputedRound[],
  currentWeekId: string,
  currentWeekDate: Date,
  grossScore: number,
  tee: {
    nineHoleRating: number
    nineHoleSlope: number
  }
) {
  const hasPriorRound = previousRecords.some(
    (record) => record.weekId !== currentWeekId && record.date.getTime() < currentWeekDate.getTime()
  )

  if (!hasPriorRound) {
    return exactHandicapIndex([
      scoreDifferential(grossScore, tee.nineHoleRating, tee.nineHoleSlope)
    ]) ?? seedHandicap ?? 0
  }

  return exactHandicapIndex(previousRecords.map((record) => record.courseDifferential)) ?? seedHandicap ?? 0
}

async function main() {
  const players = await prisma.player.findMany({
    orderBy: { name: 'asc' },
    include: {
      seasonTeeChoices: true,
      handicapRecords: {
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        include: {
          week: {
            include: {
              season: true,
              course: {
                include: {
                  tees: true,
                  holes: true
                }
              },
              matches: true
            }
          }
        }
      },
      holeScores: {
        orderBy: [{ weekId: 'asc' }, { holeNumber: 'asc' }]
      }
    }
  })

  let updatedRecords = 0
  let updatedHoleScores = 0

  for (const player of players) {
    const previousRecords: RecomputedRound[] = []

    for (const record of player.handicapRecords) {
      if (record.isImported || !record.week || !record.week.course || !record.weekId) {
        previousRecords.push({
          date: record.date,
          weekId: record.weekId,
          courseDifferential: record.courseDifferential
        })
        continue
      }

      const week = record.week
      const course = week.course
      if (!course) {
        previousRecords.push({
          date: record.date,
          weekId: record.weekId,
          courseDifferential: record.courseDifferential
        })
        continue
      }

      const match = week.matches.find(
        (candidate) => candidate.player1Id === player.id || candidate.player2Id === player.id
      )
      const overrideColor = match?.player1Id === player.id
        ? match.player1TeeOverrideColor
        : match?.player2Id === player.id
          ? match.player2TeeOverrideColor
          : null
      const teeColor = getPlayerMatchTeeColor(
        player.seasonTeeChoices,
        week.seasonId,
        player.gender,
        player.defaultTeeColor,
        overrideColor
      )
      const tee = getCourseTee(course.tees, teeColor, player.gender, {
        color: 'white',
        gender: 'man',
        nineHolePar: course.nineHolePar,
        nineHoleRating: course.nineHoleRating,
        nineHoleSlope: course.nineHoleSlope
      })
      const weekScores = player.holeScores
        .filter((score) => score.weekId === record.weekId)
        .sort((left, right) => left.holeNumber - right.holeNumber)

      if (weekScores.length !== 9) {
        previousRecords.push({
          date: record.date,
          weekId: record.weekId,
          courseDifferential: record.courseDifferential
        })
        continue
      }

      const grossScore = sum(weekScores.map((score) => score.grossScore))
      const escHandicap = roundToWholeHandicap(
        getEscIndex(player.seedHandicap, previousRecords, record.weekId, week.date, grossScore, tee)
      )
      const holesByNumber = new Map(course.holes.map((hole) => [hole.holeNumber, hole]))
      const adjustedScores = weekScores.map((score) => {
        const hole = holesByNumber.get(score.holeNumber)
        if (!hole) {
          throw new Error(`Missing hole ${score.holeNumber} for week ${record.weekId}`)
        }

        return {
          id: score.id,
          adjustedScore: applyESC(
            score.grossScore,
            hole.par,
            strokesReceivedOnHole(escHandicap, hole.strokeIndex)
          )
        }
      })
      const adjustedGrossScore = sum(adjustedScores.map((score) => score.adjustedScore))
      const courseDifferential = scoreDifferential(
        adjustedGrossScore,
        tee.nineHoleRating,
        tee.nineHoleSlope
      )

      await prisma.$transaction(async (tx) => {
        for (const score of adjustedScores) {
          const existing = weekScores.find((candidate) => candidate.id === score.id)
          if (existing && existing.adjustedScore !== score.adjustedScore) {
            await tx.holeScore.update({
              where: { id: score.id },
              data: { adjustedScore: score.adjustedScore }
            })
            updatedHoleScores += 1
          }
        }

        if (
          record.grossScore !== grossScore ||
          record.adjustedGrossScore !== adjustedGrossScore ||
          record.courseRating !== tee.nineHoleRating ||
          record.slopeRating !== tee.nineHoleSlope ||
          record.coursePar !== tee.nineHolePar ||
          record.courseDifferential !== courseDifferential
        ) {
          await tx.handicapRecord.update({
            where: { id: record.id },
            data: {
              grossScore,
              adjustedGrossScore,
              courseRating: tee.nineHoleRating,
              slopeRating: tee.nineHoleSlope,
              coursePar: tee.nineHolePar,
              courseDifferential
            }
          })
          updatedRecords += 1
        }
      })

      previousRecords.push({
        date: record.date,
        weekId: record.weekId,
        courseDifferential
      })
    }

    await recomputeUsedInIndex(prisma, player.id)
  }

  console.log(`Updated ${updatedHoleScores} hole scores and ${updatedRecords} handicap records.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

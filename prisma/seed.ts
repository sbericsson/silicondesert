import { hash } from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const courses = [
  {
    name: 'Oakwood CC - Course A',
    nineHolePar: 36,
    nineHoleRating: 35.2,
    nineHoleSlope: 128,
    holes: [
      { holeNumber: 1, par: 4, strokeIndex: 3 },
      { holeNumber: 2, par: 5, strokeIndex: 7 },
      { holeNumber: 3, par: 3, strokeIndex: 9 },
      { holeNumber: 4, par: 4, strokeIndex: 1 },
      { holeNumber: 5, par: 4, strokeIndex: 5 },
      { holeNumber: 6, par: 3, strokeIndex: 8 },
      { holeNumber: 7, par: 5, strokeIndex: 2 },
      { holeNumber: 8, par: 4, strokeIndex: 4 },
      { holeNumber: 9, par: 4, strokeIndex: 6 }
    ]
  },
  {
    name: 'Oakwood CC - Course B',
    nineHolePar: 36,
    nineHoleRating: 34.8,
    nineHoleSlope: 124,
    holes: [
      { holeNumber: 1, par: 4, strokeIndex: 4 },
      { holeNumber: 2, par: 4, strokeIndex: 8 },
      { holeNumber: 3, par: 3, strokeIndex: 9 },
      { holeNumber: 4, par: 5, strokeIndex: 2 },
      { holeNumber: 5, par: 4, strokeIndex: 6 },
      { holeNumber: 6, par: 3, strokeIndex: 7 },
      { holeNumber: 7, par: 5, strokeIndex: 1 },
      { holeNumber: 8, par: 4, strokeIndex: 3 },
      { holeNumber: 9, par: 4, strokeIndex: 5 }
    ]
  },
  {
    name: 'Oakwood CC - Course C',
    nineHolePar: 35,
    nineHoleRating: 34.1,
    nineHoleSlope: 120,
    holes: [
      { holeNumber: 1, par: 4, strokeIndex: 2 },
      { holeNumber: 2, par: 3, strokeIndex: 9 },
      { holeNumber: 3, par: 4, strokeIndex: 5 },
      { holeNumber: 4, par: 5, strokeIndex: 1 },
      { holeNumber: 5, par: 4, strokeIndex: 6 },
      { holeNumber: 6, par: 3, strokeIndex: 8 },
      { holeNumber: 7, par: 4, strokeIndex: 3 },
      { holeNumber: 8, par: 4, strokeIndex: 4 },
      { holeNumber: 9, par: 4, strokeIndex: 7 }
    ]
  }
]

async function main() {
  await prisma.commissioner.upsert({
    where: { username: 'commissioner' },
    update: {},
    create: {
      username: 'commissioner',
      passwordHash: await hash('changeme', 12)
    }
  })

  for (const course of courses) {
    const createdCourse = await prisma.course.upsert({
      where: { name: course.name },
      update: {
        nineHolePar: course.nineHolePar,
        nineHoleRating: course.nineHoleRating,
        nineHoleSlope: course.nineHoleSlope
      },
      create: {
        name: course.name,
        nineHolePar: course.nineHolePar,
        nineHoleRating: course.nineHoleRating,
        nineHoleSlope: course.nineHoleSlope
      }
    })

    for (const hole of course.holes) {
      await prisma.courseHole.upsert({
        where: {
          courseId_holeNumber: {
            courseId: createdCourse.id,
            holeNumber: hole.holeNumber
          }
        },
        update: {
          par: hole.par,
          strokeIndex: hole.strokeIndex
        },
        create: {
          courseId: createdCourse.id,
          holeNumber: hole.holeNumber,
          par: hole.par,
          strokeIndex: hole.strokeIndex
        }
      })
    }
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

import { hash } from 'bcryptjs'
import { PrismaClient, TeeColor } from '@prisma/client'

const prisma = new PrismaClient()

// Oakwood 9-hole tee ratings/slopes are provisionally derived from the
// Palms/Sonoran, Sonoran/Lakes, and Lakes/Palms combo scorecard PDF by
// solving the paired 18-hole ratings and averaging slopes across the two nines.
// Ironwood front/back 9 ratings/slopes are provisionally split from the 18-hole
// scorecard using yardage-weighted ratings and averaged slope adjustments.
const courses: Array<{
  name: string
  defaultTee: {
    color: TeeColor
    nineHolePar: number
    nineHoleRating: number
    nineHoleSlope: number
  }
  tees: Array<{
    color: TeeColor
    nineHolePar: number
    nineHoleRating: number
    nineHoleSlope: number
  }>
  holes: Array<{
    holeNumber: number
    par: number
    strokeIndex: number
  }>
}> = [
  {
    name: 'Oakwood - Palms',
    defaultTee: { color: TeeColor.white, nineHolePar: 36, nineHoleRating: 33.7, nineHoleSlope: 119 },
    tees: [
      { color: TeeColor.blue, nineHolePar: 36, nineHoleRating: 34.6, nineHoleSlope: 124 },
      { color: TeeColor.white, nineHolePar: 36, nineHoleRating: 33.7, nineHoleSlope: 119 },
      { color: TeeColor.yellow, nineHolePar: 36, nineHoleRating: 33.0, nineHoleSlope: 114 }
    ],
    holes: [
      { holeNumber: 1, par: 4, strokeIndex: 11 },
      { holeNumber: 2, par: 5, strokeIndex: 9 },
      { holeNumber: 3, par: 4, strokeIndex: 3 },
      { holeNumber: 4, par: 3, strokeIndex: 17 },
      { holeNumber: 5, par: 4, strokeIndex: 5 },
      { holeNumber: 6, par: 4, strokeIndex: 13 },
      { holeNumber: 7, par: 3, strokeIndex: 15 },
      { holeNumber: 8, par: 4, strokeIndex: 1 },
      { holeNumber: 9, par: 5, strokeIndex: 7 }
    ]
  },
  {
    name: 'Oakwood - Sonoran',
    defaultTee: { color: TeeColor.white, nineHolePar: 36, nineHoleRating: 32.7, nineHoleSlope: 101 },
    tees: [
      { color: TeeColor.blue, nineHolePar: 36, nineHoleRating: 34.3, nineHoleSlope: 116 },
      { color: TeeColor.white, nineHolePar: 36, nineHoleRating: 32.7, nineHoleSlope: 101 },
      { color: TeeColor.yellow, nineHolePar: 36, nineHoleRating: 31.2, nineHoleSlope: 98 }
    ],
    holes: [
      { holeNumber: 1, par: 4, strokeIndex: 5 },
      { holeNumber: 2, par: 4, strokeIndex: 11 },
      { holeNumber: 3, par: 3, strokeIndex: 13 },
      { holeNumber: 4, par: 4, strokeIndex: 3 },
      { holeNumber: 5, par: 5, strokeIndex: 15 },
      { holeNumber: 6, par: 4, strokeIndex: 17 },
      { holeNumber: 7, par: 4, strokeIndex: 7 },
      { holeNumber: 8, par: 3, strokeIndex: 9 },
      { holeNumber: 9, par: 5, strokeIndex: 1 }
    ]
  },
  {
    name: 'Oakwood - Lakes',
    defaultTee: { color: TeeColor.white, nineHolePar: 36, nineHoleRating: 33.8, nineHoleSlope: 125 },
    tees: [
      { color: TeeColor.blue, nineHolePar: 36, nineHoleRating: 34.8, nineHoleSlope: 130 },
      { color: TeeColor.white, nineHolePar: 36, nineHoleRating: 33.8, nineHoleSlope: 125 },
      { color: TeeColor.yellow, nineHolePar: 36, nineHoleRating: 32.7, nineHoleSlope: 112 }
    ],
    holes: [
      { holeNumber: 1, par: 5, strokeIndex: 7 },
      { holeNumber: 2, par: 3, strokeIndex: 15 },
      { holeNumber: 3, par: 4, strokeIndex: 3 },
      { holeNumber: 4, par: 4, strokeIndex: 11 },
      { holeNumber: 5, par: 4, strokeIndex: 9 },
      { holeNumber: 6, par: 3, strokeIndex: 13 },
      { holeNumber: 7, par: 5, strokeIndex: 1 },
      { holeNumber: 8, par: 4, strokeIndex: 17 },
      { holeNumber: 9, par: 4, strokeIndex: 5 }
    ]
  },
  {
    name: 'Ironwood - Front 9',
    defaultTee: { color: TeeColor.white, nineHolePar: 34, nineHoleRating: 30.3, nineHoleSlope: 98 },
    tees: [
      { color: TeeColor.blue, nineHolePar: 34, nineHoleRating: 31.4, nineHoleSlope: 102 },
      { color: TeeColor.white, nineHolePar: 34, nineHoleRating: 30.3, nineHoleSlope: 98 },
      { color: TeeColor.yellow, nineHolePar: 34, nineHoleRating: 29.4, nineHoleSlope: 88 }
    ],
    holes: [
      { holeNumber: 1, par: 5, strokeIndex: 1 },
      { holeNumber: 2, par: 4, strokeIndex: 15 },
      { holeNumber: 3, par: 4, strokeIndex: 7 },
      { holeNumber: 4, par: 3, strokeIndex: 13 },
      { holeNumber: 5, par: 4, strokeIndex: 17 },
      { holeNumber: 6, par: 3, strokeIndex: 9 },
      { holeNumber: 7, par: 4, strokeIndex: 11 },
      { holeNumber: 8, par: 3, strokeIndex: 5 },
      { holeNumber: 9, par: 4, strokeIndex: 3 }
    ]
  },
  {
    name: 'Ironwood - Back 9',
    defaultTee: { color: TeeColor.white, nineHolePar: 33, nineHoleRating: 31.0, nineHoleSlope: 100 },
    tees: [
      { color: TeeColor.blue, nineHolePar: 33, nineHoleRating: 32.0, nineHoleSlope: 104 },
      { color: TeeColor.white, nineHolePar: 33, nineHoleRating: 31.0, nineHoleSlope: 100 },
      { color: TeeColor.yellow, nineHolePar: 33, nineHoleRating: 29.8, nineHoleSlope: 90 }
    ],
    holes: [
      { holeNumber: 1, par: 3, strokeIndex: 12 },
      { holeNumber: 2, par: 4, strokeIndex: 10 },
      { holeNumber: 3, par: 4, strokeIndex: 2 },
      { holeNumber: 4, par: 3, strokeIndex: 18 },
      { holeNumber: 5, par: 4, strokeIndex: 16 },
      { holeNumber: 6, par: 3, strokeIndex: 6 },
      { holeNumber: 7, par: 4, strokeIndex: 14 },
      { holeNumber: 8, par: 3, strokeIndex: 8 },
      { holeNumber: 9, par: 5, strokeIndex: 4 }
    ]
  }
]

async function main() {
  const legacyCourseRenames = [
    ['Oakwood CC - Course A', 'Oakwood - Palms'],
    ['Oakwood CC - Course B', 'Oakwood - Sonoran'],
    ['Oakwood CC - Course C', 'Oakwood - Lakes']
  ] as const

  for (const [legacyName, newName] of legacyCourseRenames) {
    const [legacyCourse, newCourse] = await Promise.all([
      prisma.course.findUnique({ where: { name: legacyName } }),
      prisma.course.findUnique({ where: { name: newName } })
    ])

    if (legacyCourse && !newCourse) {
      await prisma.course.update({
        where: { id: legacyCourse.id },
        data: { name: newName }
      })
    }
  }

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
        nineHolePar: course.defaultTee.nineHolePar,
        nineHoleRating: course.defaultTee.nineHoleRating,
        nineHoleSlope: course.defaultTee.nineHoleSlope
      },
      create: {
        name: course.name,
        nineHolePar: course.defaultTee.nineHolePar,
        nineHoleRating: course.defaultTee.nineHoleRating,
        nineHoleSlope: course.defaultTee.nineHoleSlope
      }
    })

    for (const tee of course.tees) {
      await prisma.courseTee.upsert({
        where: {
          courseId_color: {
            courseId: createdCourse.id,
            color: tee.color
          }
        },
        update: {
          nineHolePar: tee.nineHolePar,
          nineHoleRating: tee.nineHoleRating,
          nineHoleSlope: tee.nineHoleSlope
        },
        create: {
          courseId: createdCourse.id,
          color: tee.color,
          nineHolePar: tee.nineHolePar,
          nineHoleRating: tee.nineHoleRating,
          nineHoleSlope: tee.nineHoleSlope
        }
      })
    }

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

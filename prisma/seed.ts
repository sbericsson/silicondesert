import { hash } from 'bcryptjs'
import { Gender, PrismaClient, TeeColor } from '@prisma/client'

const prisma = new PrismaClient()

// Oakwood and Ironwood tee ratings/slopes come from the league-provided
// men's and women's 9-hole course tables.
const courses: Array<{
  name: string
  defaultTee: {
    color: TeeColor
    gender: Gender
    nineHolePar: number
    nineHoleRating: number
    nineHoleSlope: number
  }
  tees: Array<{
    color: TeeColor
    gender: Gender
    nineHolePar: number
    nineHoleRating: number
    nineHoleSlope: number
  }>
  holes: Array<{
    holeNumber: number
    par: number
    strokeIndex: number
    womenStrokeIndex: number
  }>
}> = [
  {
    name: 'Oakwood - Palms',
    defaultTee: {
      color: TeeColor.white,
      gender: Gender.man,
      nineHolePar: 36,
      nineHoleRating: 33.7,
      nineHoleSlope: 118
    },
    tees: [
      { color: TeeColor.blue, gender: Gender.man, nineHolePar: 36, nineHoleRating: 34.6, nineHoleSlope: 123 },
      { color: TeeColor.white, gender: Gender.man, nineHolePar: 36, nineHoleRating: 33.7, nineHoleSlope: 118 },
      { color: TeeColor.yellow, gender: Gender.man, nineHolePar: 36, nineHoleRating: 33.0, nineHoleSlope: 114 },
      { color: TeeColor.silver, gender: Gender.man, nineHolePar: 36, nineHoleRating: 30.9, nineHoleSlope: 105 },
      { color: TeeColor.blue, gender: Gender.woman, nineHolePar: 36, nineHoleRating: 37.4, nineHoleSlope: 133 },
      { color: TeeColor.white, gender: Gender.woman, nineHolePar: 36, nineHoleRating: 36.5, nineHoleSlope: 127 },
      { color: TeeColor.yellow, gender: Gender.woman, nineHolePar: 36, nineHoleRating: 35.8, nineHoleSlope: 124 },
      { color: TeeColor.silver, gender: Gender.woman, nineHolePar: 36, nineHoleRating: 32.9, nineHoleSlope: 112 }
    ],
    holes: [
      { holeNumber: 1, par: 4, strokeIndex: 11, womenStrokeIndex: 11 },
      { holeNumber: 2, par: 5, strokeIndex: 9,  womenStrokeIndex: 9  },
      { holeNumber: 3, par: 4, strokeIndex: 3,  womenStrokeIndex: 3  },
      { holeNumber: 4, par: 3, strokeIndex: 17, womenStrokeIndex: 17 },
      { holeNumber: 5, par: 4, strokeIndex: 5,  womenStrokeIndex: 5  },
      { holeNumber: 6, par: 4, strokeIndex: 13, womenStrokeIndex: 13 },
      { holeNumber: 7, par: 3, strokeIndex: 15, womenStrokeIndex: 15 },
      { holeNumber: 8, par: 4, strokeIndex: 1,  womenStrokeIndex: 1  },
      { holeNumber: 9, par: 5, strokeIndex: 7,  womenStrokeIndex: 7  }
    ]
  },
  {
    name: 'Oakwood - Sonoran',
    defaultTee: {
      color: TeeColor.white,
      gender: Gender.man,
      nineHolePar: 36,
      nineHoleRating: 32.6,
      nineHoleSlope: 100
    },
    tees: [
      { color: TeeColor.blue, gender: Gender.man, nineHolePar: 36, nineHoleRating: 34.2, nineHoleSlope: 115 },
      { color: TeeColor.white, gender: Gender.man, nineHolePar: 36, nineHoleRating: 32.6, nineHoleSlope: 100 },
      { color: TeeColor.yellow, gender: Gender.man, nineHolePar: 36, nineHoleRating: 31.1, nineHoleSlope: 96 },
      { color: TeeColor.silver, gender: Gender.man, nineHolePar: 36, nineHoleRating: 30.2, nineHoleSlope: 93 },
      { color: TeeColor.blue, gender: Gender.woman, nineHolePar: 36, nineHoleRating: 36.5, nineHoleSlope: 121 },
      { color: TeeColor.white, gender: Gender.woman, nineHolePar: 36, nineHoleRating: 34.9, nineHoleSlope: 115 },
      { color: TeeColor.yellow, gender: Gender.woman, nineHolePar: 36, nineHoleRating: 33.4, nineHoleSlope: 102 },
      { color: TeeColor.silver, gender: Gender.woman, nineHolePar: 36, nineHoleRating: 31.9, nineHoleSlope: 98 }
    ],
    holes: [
      { holeNumber: 1, par: 4, strokeIndex: 5,  womenStrokeIndex: 5  },
      { holeNumber: 2, par: 4, strokeIndex: 11, womenStrokeIndex: 11 },
      { holeNumber: 3, par: 3, strokeIndex: 13, womenStrokeIndex: 13 },
      { holeNumber: 4, par: 4, strokeIndex: 3,  womenStrokeIndex: 3  },
      { holeNumber: 5, par: 5, strokeIndex: 15, womenStrokeIndex: 15 },
      { holeNumber: 6, par: 4, strokeIndex: 17, womenStrokeIndex: 17 },
      { holeNumber: 7, par: 4, strokeIndex: 7,  womenStrokeIndex: 7  },
      { holeNumber: 8, par: 3, strokeIndex: 9,  womenStrokeIndex: 9  },
      { holeNumber: 9, par: 5, strokeIndex: 1,  womenStrokeIndex: 1  }
    ]
  },
  {
    name: 'Oakwood - Lakes',
    defaultTee: {
      color: TeeColor.white,
      gender: Gender.man,
      nineHolePar: 36,
      nineHoleRating: 33.8,
      nineHoleSlope: 126
    },
    tees: [
      { color: TeeColor.blue, gender: Gender.man, nineHolePar: 36, nineHoleRating: 34.8, nineHoleSlope: 131 },
      { color: TeeColor.white, gender: Gender.man, nineHolePar: 36, nineHoleRating: 33.8, nineHoleSlope: 126 },
      { color: TeeColor.yellow, gender: Gender.man, nineHolePar: 36, nineHoleRating: 32.7, nineHoleSlope: 112 },
      { color: TeeColor.silver, gender: Gender.man, nineHolePar: 36, nineHoleRating: 31.3, nineHoleSlope: 105 },
      { color: TeeColor.blue, gender: Gender.woman, nineHolePar: 36, nineHoleRating: 36.9, nineHoleSlope: 136 },
      { color: TeeColor.white, gender: Gender.woman, nineHolePar: 36, nineHoleRating: 36.1, nineHoleSlope: 131 },
      { color: TeeColor.yellow, gender: Gender.woman, nineHolePar: 36, nineHoleRating: 34.8, nineHoleSlope: 122 },
      { color: TeeColor.silver, gender: Gender.woman, nineHolePar: 36, nineHoleRating: 33.1, nineHoleSlope: 114 }
    ],
    holes: [
      { holeNumber: 1, par: 5, strokeIndex: 7,  womenStrokeIndex: 7  },
      { holeNumber: 2, par: 3, strokeIndex: 15, womenStrokeIndex: 15 },
      { holeNumber: 3, par: 4, strokeIndex: 3,  womenStrokeIndex: 3  },
      { holeNumber: 4, par: 4, strokeIndex: 11, womenStrokeIndex: 11 },
      { holeNumber: 5, par: 4, strokeIndex: 9,  womenStrokeIndex: 9  },
      { holeNumber: 6, par: 3, strokeIndex: 13, womenStrokeIndex: 13 },
      { holeNumber: 7, par: 5, strokeIndex: 1,  womenStrokeIndex: 1  },
      { holeNumber: 8, par: 4, strokeIndex: 17, womenStrokeIndex: 17 },
      { holeNumber: 9, par: 4, strokeIndex: 5,  womenStrokeIndex: 5  }
    ]
  },
  {
    name: 'Ironwood - Front 9',
    defaultTee: {
      color: TeeColor.white,
      gender: Gender.man,
      nineHolePar: 34,
      nineHoleRating: 30.65,
      nineHoleSlope: 99
    },
    tees: [
      { color: TeeColor.blue, gender: Gender.man, nineHolePar: 34, nineHoleRating: 31.7, nineHoleSlope: 103 },
      { color: TeeColor.white, gender: Gender.man, nineHolePar: 34, nineHoleRating: 30.65, nineHoleSlope: 99 },
      { color: TeeColor.yellow, gender: Gender.man, nineHolePar: 34, nineHoleRating: 29.6, nineHoleSlope: 89 },
      { color: TeeColor.silver, gender: Gender.man, nineHolePar: 34, nineHoleRating: 29.2, nineHoleSlope: 87 },
      { color: TeeColor.blue, gender: Gender.woman, nineHolePar: 34, nineHoleRating: 34.2, nineHoleSlope: 110 },
      { color: TeeColor.white, gender: Gender.woman, nineHolePar: 34, nineHoleRating: 32.4, nineHoleSlope: 104 },
      { color: TeeColor.yellow, gender: Gender.woman, nineHolePar: 34, nineHoleRating: 30.5, nineHoleSlope: 97 },
      { color: TeeColor.silver, gender: Gender.woman, nineHolePar: 34, nineHoleRating: 29.65, nineHoleSlope: 92 }
    ],
    holes: [
      { holeNumber: 1, par: 5, strokeIndex: 1,  womenStrokeIndex: 1  },
      { holeNumber: 2, par: 4, strokeIndex: 15, womenStrokeIndex: 15 },
      { holeNumber: 3, par: 4, strokeIndex: 7,  womenStrokeIndex: 7  },
      { holeNumber: 4, par: 3, strokeIndex: 13, womenStrokeIndex: 13 },
      { holeNumber: 5, par: 4, strokeIndex: 17, womenStrokeIndex: 17 },
      { holeNumber: 6, par: 3, strokeIndex: 9,  womenStrokeIndex: 9  },
      { holeNumber: 7, par: 4, strokeIndex: 11, womenStrokeIndex: 11 },
      { holeNumber: 8, par: 3, strokeIndex: 5,  womenStrokeIndex: 5  },
      { holeNumber: 9, par: 4, strokeIndex: 3,  womenStrokeIndex: 3  }
    ]
  },
  {
    name: 'Ironwood - Back 9',
    defaultTee: {
      color: TeeColor.white,
      gender: Gender.man,
      nineHolePar: 33,
      nineHoleRating: 30.65,
      nineHoleSlope: 99
    },
    tees: [
      { color: TeeColor.blue, gender: Gender.man, nineHolePar: 33, nineHoleRating: 31.7, nineHoleSlope: 103 },
      { color: TeeColor.white, gender: Gender.man, nineHolePar: 33, nineHoleRating: 30.65, nineHoleSlope: 99 },
      { color: TeeColor.yellow, gender: Gender.man, nineHolePar: 33, nineHoleRating: 29.6, nineHoleSlope: 89 },
      { color: TeeColor.silver, gender: Gender.man, nineHolePar: 33, nineHoleRating: 29.2, nineHoleSlope: 87 },
      { color: TeeColor.blue, gender: Gender.woman, nineHolePar: 33, nineHoleRating: 34.2, nineHoleSlope: 110 },
      { color: TeeColor.white, gender: Gender.woman, nineHolePar: 33, nineHoleRating: 32.4, nineHoleSlope: 104 },
      { color: TeeColor.yellow, gender: Gender.woman, nineHolePar: 33, nineHoleRating: 30.5, nineHoleSlope: 97 },
      { color: TeeColor.silver, gender: Gender.woman, nineHolePar: 33, nineHoleRating: 29.65, nineHoleSlope: 92 }
    ],
    holes: [
      { holeNumber: 1, par: 3, strokeIndex: 12, womenStrokeIndex: 12 },
      { holeNumber: 2, par: 4, strokeIndex: 10, womenStrokeIndex: 10 },
      { holeNumber: 3, par: 4, strokeIndex: 2,  womenStrokeIndex: 2  },
      { holeNumber: 4, par: 3, strokeIndex: 18, womenStrokeIndex: 18 },
      { holeNumber: 5, par: 4, strokeIndex: 16, womenStrokeIndex: 16 },
      { holeNumber: 6, par: 3, strokeIndex: 6,  womenStrokeIndex: 6  },
      { holeNumber: 7, par: 4, strokeIndex: 14, womenStrokeIndex: 14 },
      { holeNumber: 8, par: 3, strokeIndex: 8,  womenStrokeIndex: 8  },
      { holeNumber: 9, par: 5, strokeIndex: 4,  womenStrokeIndex: 4  }
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
          courseId_color_gender: {
            courseId: createdCourse.id,
            color: tee.color,
            gender: tee.gender
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
          gender: tee.gender,
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
          strokeIndex: hole.strokeIndex,
          womenStrokeIndex: hole.womenStrokeIndex
        },
        create: {
          courseId: createdCourse.id,
          holeNumber: hole.holeNumber,
          par: hole.par,
          strokeIndex: hole.strokeIndex,
          womenStrokeIndex: hole.womenStrokeIndex
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

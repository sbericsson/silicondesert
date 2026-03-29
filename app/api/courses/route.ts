import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getApiSession, unauthorizedResponse } from '@/lib/api-auth'

export async function GET() {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const courses = await prisma.course.findMany({
    include: {
      holes: {
        orderBy: { holeNumber: 'asc' }
      }
    },
    orderBy: { name: 'asc' }
  })

  return NextResponse.json(courses)
}

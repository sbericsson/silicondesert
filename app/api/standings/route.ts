import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getApiSession, unauthorizedResponse } from '@/lib/api-auth'

function applyStoredMatchResult(input: {
  player1Id: string
  player2Id: string
  strokeWinnerId: string | null
  matchPlayWinnerId: string | null
  matchPlayLeadBy: number | null
  player2ScorecardOnly: boolean
  player1Present: boolean
  player2Present: boolean
}) {
  const player1 = {
    totalPoints: input.player1Present ? 1 : 0,
    strokeWins: 0,
    matchPlayWins: 0
  }
  const player2 = {
    totalPoints: input.player2Present && !input.player2ScorecardOnly ? 1 : 0,
    strokeWins: 0,
    matchPlayWins: 0
  }

  if (input.player2ScorecardOnly) {
    if (input.strokeWinnerId === input.player1Id) {
      player1.totalPoints += 2
      player1.strokeWins += 1
    } else if (input.strokeWinnerId === null) {
      player1.totalPoints += 1
    }
  } else if (input.strokeWinnerId === input.player1Id) {
    player1.totalPoints += 2
    player1.strokeWins += 1
  } else if (input.strokeWinnerId === input.player2Id) {
    player2.totalPoints += 2
    player2.strokeWins += 1
  } else {
    player1.totalPoints += 1
    player2.totalPoints += 1
  }

  if (input.matchPlayLeadBy !== null) {
    if (input.player2ScorecardOnly) {
      if (input.matchPlayWinnerId === input.player1Id) {
        player1.totalPoints += 2
        player1.matchPlayWins += 1
      } else if (input.matchPlayLeadBy === 0) {
        player1.totalPoints += 1
      }
    } else if (input.matchPlayWinnerId === input.player1Id) {
      player1.totalPoints += 2
      player1.matchPlayWins += 1
    } else if (input.matchPlayWinnerId === input.player2Id) {
      player2.totalPoints += 2
      player2.matchPlayWins += 1
    } else {
      player1.totalPoints += 1
      player2.totalPoints += 1
    }
  }

  return { player1, player2 }
}

export async function GET(request: NextRequest) {
  const session = await getApiSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const seasonId = request.nextUrl.searchParams.get('seasonId')
  if (!seasonId) {
    return NextResponse.json({ error: 'seasonId is required' }, { status: 400 })
  }

  const weeks = await prisma.week.findMany({
    where: { seasonId },
    include: {
      attendance: true,
      matches: true
    }
  })

  const players = await prisma.player.findMany({
    where: { active: true }
  })

  const totals = new Map(
    players.map((player) => [
      player.id,
      {
        playerId: player.id,
        name: player.name,
        totalPoints: 0,
        strokeWins: 0,
        matchPlayWins: 0,
        ctpWins: 0,
        lpWins: 0
      }
    ])
  )

  for (const week of weeks) {
    const attendanceMap = new Map(week.attendance.map((entry) => [entry.playerId, entry.present]))

    for (const match of week.matches) {
      if (match.matchPlayLeadBy === null) {
        continue
      }

      const points = applyStoredMatchResult({
        player1Id: match.player1Id,
        player2Id: match.player2Id,
        strokeWinnerId: match.strokeWinnerId,
        matchPlayWinnerId: match.matchPlayWinnerId,
        matchPlayLeadBy: match.matchPlayLeadBy,
        player2ScorecardOnly: match.player2ScorecardOnly,
        player1Present: attendanceMap.get(match.player1Id) ?? false,
        player2Present: attendanceMap.get(match.player2Id) ?? false
      })

      const player1 = totals.get(match.player1Id)
      const player2 = totals.get(match.player2Id)

      if (player1) {
        player1.totalPoints += points.player1.totalPoints
        player1.strokeWins += points.player1.strokeWins
        player1.matchPlayWins += points.player1.matchPlayWins
      }

      if (player2) {
        player2.totalPoints += points.player2.totalPoints
        player2.strokeWins += points.player2.strokeWins
        player2.matchPlayWins += points.player2.matchPlayWins
      }
    }

    if (week.ctpWinnerId && totals.has(week.ctpWinnerId)) {
      const player = totals.get(week.ctpWinnerId)
      if (player) {
        player.totalPoints += 1
        player.ctpWins += 1
      }
    }

    if (week.longestPuttWinnerId && totals.has(week.longestPuttWinnerId)) {
      const player = totals.get(week.longestPuttWinnerId)
      if (player) {
        player.totalPoints += 1
        player.lpWins += 1
      }
    }
  }

  return NextResponse.json(
    [...totals.values()].sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) {
        return b.totalPoints - a.totalPoints
      }

      return a.name.localeCompare(b.name)
    })
  )
}

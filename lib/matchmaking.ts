export interface Player {
  id: string
  name: string
  handicapIndex: number
  checkInOrder: number
}

export interface PriorMatch {
  player1Id: string
  player2Id: string
}

export interface PairingResult {
  matches: Array<{ player1: Player; player2: Player }>
  threesome: {
    pivot: Player
    matchA: { player1: Player; player2: Player }
    matchBRef: { player: Player; referencePlayer: Player }
  } | null
  flags: Array<{
    player1Id: string
    player2Id: string
    type: 'repeat' | 'gap'
    detail: string
  }>
}

interface GeneratePairingsOptions {
  trailingPlayerId?: string | null
}

function pairKey(player1Id: string, player2Id: string) {
  return [player1Id, player2Id].sort().join(':')
}

function pairCost(player1: Player, player2: Player, repeatCounts: Map<string, number>) {
  const gap = Math.abs(player1.handicapIndex - player2.handicapIndex)
  const priorCount = repeatCounts.get(pairKey(player1.id, player2.id)) ?? 0
  // Repeat penalty 13 = a 1x repeat is treated like a 6.5-stroke gap, so any
  // non-repeat with a gap of 6 or less wins over a repeat.
  return gap * 2 + priorCount * 13
}

function buildRepeatCounts(priorMatchesThisSeason: PriorMatch[]) {
  const counts = new Map<string, number>()

  for (const match of priorMatchesThisSeason) {
    const key = pairKey(match.player1Id, match.player2Id)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return counts
}

function greedyMatches(players: Player[], repeatCounts: Map<string, number>) {
  const sorted = [...players].sort((a, b) => a.handicapIndex - b.handicapIndex)
  const remaining = [...sorted]
  const matches: Array<{ player1: Player; player2: Player }> = []

  while (remaining.length > 1) {
    const player = remaining.shift()
    if (!player) {
      break
    }

    let bestIndex = 0
    let bestCost = Number.POSITIVE_INFINITY

    remaining.forEach((candidate, index) => {
      const cost = pairCost(player, candidate, repeatCounts)
      if (cost < bestCost) {
        bestCost = cost
        bestIndex = index
      }
    })

    const [opponent] = remaining.splice(bestIndex, 1)
    matches.push({ player1: player, player2: opponent })
  }

  return matches
}

function buildFlags(
  matches: Array<{ player1: Player; player2: Player }>,
  repeatCounts: Map<string, number>
): PairingResult['flags'] {
  const flags: PairingResult['flags'] = []

  for (const match of matches) {
    const gap = Math.abs(match.player1.handicapIndex - match.player2.handicapIndex)
    if (gap > 6) {
      flags.push({
        player1Id: match.player1.id,
        player2Id: match.player2.id,
        type: 'gap',
        detail: `Gap: ${gap.toFixed(1)}`
      })
    }

    const repeats = repeatCounts.get(pairKey(match.player1.id, match.player2.id)) ?? 0
    if (repeats > 0) {
      flags.push({
        player1Id: match.player1.id,
        player2Id: match.player2.id,
        type: 'repeat',
        detail: `Played ${repeats}× this season`
      })
    }
  }

  return flags
}

export function buildPairingFlags(
  matches: Array<{ player1: Player; player2: Player }>,
  priorMatchesThisSeason: PriorMatch[]
): PairingResult['flags'] {
  return buildFlags(matches, buildRepeatCounts(priorMatchesThisSeason))
}

function totalMatchCost(
  matches: Array<{ player1: Player; player2: Player }>,
  repeatCounts: Map<string, number>
) {
  return matches.reduce(
    (total, match) => total + pairCost(match.player1, match.player2, repeatCounts),
    0
  )
}

export function generatePairings(
  players: Player[],
  priorMatchesThisSeason: PriorMatch[],
  options: GeneratePairingsOptions = {}
): PairingResult {
  if (players.length < 2) {
    throw new Error('Need at least 2 players')
  }

  const repeatCounts = buildRepeatCounts(priorMatchesThisSeason)
  const trailingPlayer =
    options.trailingPlayerId
      ? players.find((player) => player.id === options.trailingPlayerId) ?? null
      : null
  const byCheckInDesc = [...players].sort((a, b) => b.checkInOrder - a.checkInOrder)
  const pivot =
    players.length % 2 === 1
      ? trailingPlayer ?? byCheckInDesc[0]
      : null
  const pairingPool = pivot ? players.filter((player) => player.id !== pivot.id) : players
  let matches =
    !pivot && trailingPlayer
      ? (() => {
          const candidates = pairingPool.filter((player) => player.id !== trailingPlayer.id)
          let bestMatches: Array<{ player1: Player; player2: Player }> | null = null
          let bestCost = Number.POSITIVE_INFINITY

          for (const candidate of candidates) {
            const remainingPool = pairingPool.filter(
              (player) => player.id !== trailingPlayer.id && player.id !== candidate.id
            )
            const leadingMatches = greedyMatches(remainingPool, repeatCounts)
            const candidateMatches = [...leadingMatches, { player1: trailingPlayer, player2: candidate }]
            const candidateCost = totalMatchCost(candidateMatches, repeatCounts)

            if (candidateCost < bestCost) {
              bestCost = candidateCost
              bestMatches = candidateMatches
            }
          }

          return bestMatches ?? greedyMatches(pairingPool, repeatCounts)
        })()
      : greedyMatches(pairingPool, repeatCounts)

  let threesome: PairingResult['threesome'] = null

  if (pivot && matches.length > 0) {
    let worstIndex = 0
    let worstCost = Number.NEGATIVE_INFINITY

    matches.forEach((match, index) => {
      const cost = pairCost(match.player1, match.player2, repeatCounts)
      if (cost > worstCost) {
        worstCost = cost
        worstIndex = index
      }
    })

    const [worstMatch] = matches.splice(worstIndex, 1)
    const anchorPlayer1Cost =
      pairCost(pivot, worstMatch.player1, repeatCounts) +
      pairCost(worstMatch.player2, worstMatch.player1, repeatCounts)
    const anchorPlayer2Cost =
      pairCost(pivot, worstMatch.player2, repeatCounts) +
      pairCost(worstMatch.player1, worstMatch.player2, repeatCounts)
    const anchorPlayer = anchorPlayer1Cost <= anchorPlayer2Cost ? worstMatch.player1 : worstMatch.player2
    const scorecardPlayer =
      anchorPlayer.id === worstMatch.player1.id ? worstMatch.player2 : worstMatch.player1

    threesome = {
      pivot,
      matchA: {
        player1: pivot,
        player2: anchorPlayer
      },
      matchBRef: {
        player: scorecardPlayer,
        referencePlayer: anchorPlayer
      }
    }
  }

  const allFlagMatches = threesome
    ? [...matches, threesome.matchA, { player1: threesome.matchBRef.player, player2: threesome.matchBRef.referencePlayer }]
    : matches

  return {
    matches,
    threesome,
    flags: buildFlags(allFlagMatches, repeatCounts)
  }
}

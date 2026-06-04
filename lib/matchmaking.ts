export interface Player {
  id: string
  name: string
  handicapIndex: number
  checkInOrder: number
  earlyBirdRequested?: boolean
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
  groups: Array<
    | { type: 'match'; match: { player1: Player; player2: Player } }
    | {
        type: 'threesome'
        threesome: NonNullable<PairingResult['threesome']>
      }
  >
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

const TRAILING_PLAYER_PAIR_WEIGHT = 4
const REPEAT_PAIRING_PENALTY = 16

function pairKey(player1Id: string, player2Id: string) {
  return [player1Id, player2Id].sort().join(':')
}

function pairCost(player1: Player, player2: Player, repeatCounts: Map<string, number>) {
  const gap = Math.abs(player1.handicapIndex - player2.handicapIndex)
  const priorCount = repeatCounts.get(pairKey(player1.id, player2.id)) ?? 0
  // A 1x repeat is treated like an 8-stroke gap, so any non-repeat with a gap
  // of 7.5 or less wins over a repeat.
  return gap * 2 + priorCount * REPEAT_PAIRING_PENALTY
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

function comparePlayersByHandicapThenKey(playerA: Player, playerB: Player) {
  const handicapComparison = playerA.handicapIndex - playerB.handicapIndex
  if (handicapComparison !== 0) {
    return handicapComparison
  }

  return playerA.id.localeCompare(playerB.id)
}

function bestOpponentIndex(
  player: Player,
  candidates: Player[],
  repeatCounts: Map<string, number>
) {
  let bestIndex = 0
  let bestCost = Number.POSITIVE_INFINITY

  candidates.forEach((candidate, index) => {
    const cost = pairCost(player, candidate, repeatCounts)
    if (cost < bestCost) {
      bestCost = cost
      bestIndex = index
    }
  })

  return bestIndex
}

function earlyPriorityMatches(players: Player[], repeatCounts: Map<string, number>) {
  const remaining = [...players].sort(comparePlayersByHandicapThenKey)
  const matches: Array<{ player1: Player; player2: Player }> = []

  while (remaining.length > 1) {
    const earlyIndex = remaining.findIndex((player) => player.earlyBirdRequested)
    if (earlyIndex === -1) {
      break
    }

    const [earlyPlayer] = remaining.splice(earlyIndex, 1)
    const opponent = remaining[bestOpponentIndex(earlyPlayer, remaining, repeatCounts)]
    const opponentIndex = remaining.findIndex((player) => player.id === opponent.id)

    remaining.splice(opponentIndex, 1)
    matches.push({ player1: earlyPlayer, player2: opponent })
  }

  return [...matches, ...greedyMatches(remaining, repeatCounts)]
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

function averageHandicap(match: { player1: Player; player2: Player }) {
  return (match.player1.handicapIndex + match.player2.handicapIndex) / 2
}

function spreadMatchesByHandicap(
  matches: Array<{ player1: Player; player2: Player }>,
  trailingPlayerId: string | null
) {
  if (matches.length < 3) {
    return matches
  }

  const trailingMatches: Array<{ player1: Player; player2: Player }> = []
  const standardMatches: Array<{ player1: Player; player2: Player }> = []

  for (const match of matches) {
    if (
      trailingPlayerId &&
      (match.player1.id === trailingPlayerId || match.player2.id === trailingPlayerId)
    ) {
      trailingMatches.push(match)
    } else {
      standardMatches.push(match)
    }
  }

  const sorted = [...standardMatches].sort((left, right) => {
    const handicapComparison = averageHandicap(left) - averageHandicap(right)
    if (handicapComparison !== 0) {
      return handicapComparison
    }

    return pairKey(left.player1.id, left.player2.id).localeCompare(
      pairKey(right.player1.id, right.player2.id)
    )
  })

  const spread: Array<{ player1: Player; player2: Player }> = []
  let left = Math.floor((sorted.length - 1) / 2)
  let right = left + 1

  while (left >= 0 || right < sorted.length) {
    if (left >= 0) {
      spread.push(sorted[left])
      left -= 1
    }

    if (right < sorted.length) {
      spread.push(sorted[right])
      right += 1
    }
  }

  return [...spread, ...trailingMatches]
}

function earlyBirdCount(match: { player1: Player; player2: Player }) {
  return Number(Boolean(match.player1.earlyBirdRequested)) + Number(Boolean(match.player2.earlyBirdRequested))
}

function earlyBirdCountForThreesome(threesome: NonNullable<PairingResult['threesome']>) {
  return (
    Number(Boolean(threesome.pivot.earlyBirdRequested)) +
    Number(Boolean(threesome.matchA.player2.earlyBirdRequested)) +
    Number(Boolean(threesome.matchBRef.player.earlyBirdRequested))
  )
}

function orderPairingGroups(
  matches: Array<{ player1: Player; player2: Player }>,
  threesome: PairingResult['threesome'],
  trailingPlayerId: string | null
): PairingResult['groups'] {
  const trailingGroups: PairingResult['groups'] = []
  const standardGroups: PairingResult['groups'] = []

  matches.forEach((match) => {
    const group = { type: 'match' as const, match }
    if (
      trailingPlayerId &&
      (match.player1.id === trailingPlayerId || match.player2.id === trailingPlayerId)
    ) {
      trailingGroups.push(group)
    } else {
      standardGroups.push(group)
    }
  })

  if (threesome) {
    const group = { type: 'threesome' as const, threesome }
    if (trailingPlayerId && threesome.pivot.id === trailingPlayerId) {
      trailingGroups.push(group)
    } else {
      standardGroups.push(group)
    }
  }

  const earlyBirdRank = (group: PairingResult['groups'][number]) =>
    group.type === 'match' ? earlyBirdCount(group.match) : earlyBirdCountForThreesome(group.threesome)

  return [
    ...standardGroups
      .map((group, index) => ({ group, index }))
      .sort((left, right) => {
        const earlyComparison = earlyBirdRank(right.group) - earlyBirdRank(left.group)
        if (earlyComparison !== 0) {
          return earlyComparison
        }

        return left.index - right.index
      })
      .map(({ group }) => group),
    ...trailingGroups
  ]
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
            const leadingMatches = earlyPriorityMatches(remainingPool, repeatCounts)
            const candidateMatches = [...leadingMatches, { player1: trailingPlayer, player2: candidate }]
            const candidateCost =
              totalMatchCost(leadingMatches, repeatCounts) +
              pairCost(trailingPlayer, candidate, repeatCounts) * TRAILING_PLAYER_PAIR_WEIGHT

            if (candidateCost < bestCost) {
              bestCost = candidateCost
              bestMatches = candidateMatches
            }
          }

          return bestMatches ?? earlyPriorityMatches(pairingPool, repeatCounts)
        })()
      : earlyPriorityMatches(pairingPool, repeatCounts)

  let threesome: PairingResult['threesome'] = null

  if (pivot && matches.length > 0) {
    let worstIndex = 0
    let worstCost = Number.NEGATIVE_INFINITY
    let trailingThreesomeIndex = 0
    let trailingThreesomeCost = Number.POSITIVE_INFINITY

    matches.forEach((match, index) => {
      const cost = pairCost(match.player1, match.player2, repeatCounts)
      if (cost > worstCost) {
        worstCost = cost
        worstIndex = index
      }

      if (pivot.id === trailingPlayer?.id) {
        const trailingCost = Math.min(
          pairCost(pivot, match.player1, repeatCounts),
          pairCost(pivot, match.player2, repeatCounts)
        )

        if (trailingCost < trailingThreesomeCost) {
          trailingThreesomeCost = trailingCost
          trailingThreesomeIndex = index
        }
      }
    })

    const [worstMatch] = matches.splice(
      pivot.id === trailingPlayer?.id ? trailingThreesomeIndex : worstIndex,
      1
    )
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

  matches = spreadMatchesByHandicap(matches, trailingPlayer?.id ?? null)

  const groups = orderPairingGroups(matches, threesome, trailingPlayer?.id ?? null)
  const allFlagMatches = threesome
    ? [...matches, threesome.matchA, { player1: threesome.matchBRef.player, player2: threesome.matchBRef.referencePlayer }]
    : matches

  return {
    matches,
    threesome,
    groups,
    flags: buildFlags(allFlagMatches, repeatCounts)
  }
}

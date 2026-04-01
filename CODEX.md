# CODEX.md — Silicon Desert Golf League Commissioner App
# Implementation spec for Codex. Every decision is made. Build exactly this.

## Overview

Single-user commissioner web app for a 9-hole Friday golf league. Replaces a spreadsheet.
~35 players, ~17 matches per Friday, Spring + Summer seasons.
Commissioner-only in v1. No player accounts.

Stack: Next.js 14 App Router · PostgreSQL · Prisma · NextAuth.js · Tailwind CSS

---

## Implementation Decisions (Locked 2026-03-29)

These decisions resolve the remaining ambiguities in the spec and are now part of the implementation source of truth.

### 1. Threesome Persistence Model

- A threesome is stored as **two `Match` rows**.
- `matchA` is the pivot's live head-to-head match.
- `matchB` is the reference match and must set `player2ScorecardOnly=true`.
- Pivot hole scores are stored **once** against `matchA`.
- Because pivot scores are reused by both matches, `HoleScore.matchId` becomes optional and is used as the **entry-context match**, not the ownership key.
- The canonical uniqueness rule remains `@@unique([weekId, playerId, holeNumber])`.
- Score queries for reference matches must load the pivot's hole scores by `(weekId, playerId)` rather than by `matchId`.

### 2. Score Entry Route

- Score Entry is a pushed workflow, not a bottom-nav destination.
- Add route: `app/(app)/week/matches/[matchId]/page.tsx`.
- Pairings cards navigate to this route after lock.

### 3. Navigation Information Architecture

- Bottom nav remains exactly four items from `DESIGN.md`: `Week`, `Standings`, `Roster`, `History`.
- `Week` contains the `Check-in` and `Pairings` sub-tabs.
- The older wireframe showing separate Pairings and Scores nav items is superseded by `DESIGN.md`.

### 4. Design Token Canon

- `DESIGN.md` token names are canonical.
- Tailwind color keys must use: `surface`, `text`, `accent`, `warning`, `danger`, `info`.
- Do not introduce alternate aliases like `brand` or `warn`.

### 5. Pairing Algorithm Contract

- `generatePairings()` must return deterministic, disjoint player pairings.
- The implementation may use `munkres-js`, but tests are the contract:
  - no player appears in more than one returned standard match
  - odd player counts create exactly one pivot threesome
  - repeat-pair penalties and handicap-gap penalties influence match selection
- The pivot is the last checked-in player.
- The pivot's live match is the lowest-priority generated pair after cost optimization.
- The reference match uses the remaining player from that live pair and must persist as a second `Match` row with `player2ScorecardOnly=true`.

### 6. Week Points API Shape

- `calculateWeekPoints()` must accept enough information to aggregate totals by player without caller-side reconstruction.
- During implementation, it may be refactored from the draft signature in this document as long as:
  - match points remain pure-function based
  - CTP and LP bonuses are added at week level
  - `player2ScorecardOnly` never awards points to player2

### 7. Check-In Order Persistence

- Pairing logic must use persisted attendance timing, not UI-only order.
- `Attendance` adds `checkedInAt DateTime?`.
- When a player is marked present, set `checkedInAt` to the current Phoenix-local timestamp if it is null.
- When a player is marked absent, clear `checkedInAt`.
- The pivot is the present player with the latest `checkedInAt`.

---

## Project Initialization

```bash
npx create-next-app@14 silicon --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
cd silicon
npm install prisma @prisma/client next-auth bcryptjs munkres-js
npm install --save-dev @types/bcryptjs @types/munkres-js vitest @vitejs/plugin-react
npx prisma init
```

---

## Environment Variables (.env)

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/silicon"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="https://yourdomain.com"
TZ="America/Phoenix"
```

Set `TZ=America/Phoenix` in the PM2 ecosystem config as well (Arizona has no DST).

---

## package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev",
    "prebuild": "prisma generate",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate": "prisma migrate deploy",
    "db:studio": "prisma studio"
  }
}
```

---

## Directory Structure

```
silicon/
  app/
    (auth)/
      login/
        page.tsx           # login form
    (app)/
      layout.tsx           # authenticated shell with bottom nav
      week/
        page.tsx           # Week tab — Check-in | Pairings sub-tabs
      standings/
        page.tsx           # Standings — Spring | Summer | Overall tabs
      roster/
        page.tsx           # Player list + Admin section
      history/
        page.tsx           # Past weeks
    api/
      auth/
        [...nextauth]/
          route.ts         # NextAuth handler
      players/
        route.ts           # GET all, POST create
        [id]/
          route.ts         # PATCH update, DELETE deactivate
      seasons/
        route.ts           # GET all, POST create
      weeks/
        route.ts           # GET current week, POST create
        [id]/
          route.ts         # GET, PATCH
          attendance/
            route.ts       # GET list, POST toggle
          pairings/
            route.ts       # POST generate, GET current
            lock/
              route.ts     # POST lock, DELETE unlock
          matches/
            route.ts       # GET all for week
            [matchId]/
              scores/
                route.ts   # GET, POST submit scores
      standings/
        route.ts           # GET standings (query: seasonId, type)
      courses/
        route.ts           # GET all courses
      import/
        route.ts           # POST CSV import (historical differentials)
      export/
        route.ts           # GET CSV export (standings, scores, differentials)
  lib/
    handicap.ts            # Pure functions: scoreDifferential, handicapIndex, courseHandicap
    scoring.ts             # Pure functions: calculateMatchPoints, calculateWeekPoints
    matchmaking.ts         # Pure functions: generatePairings (munkres-js)
    audit.ts               # writeAuditLog(tx, entry)
    db.ts                  # Prisma client singleton
    auth.ts                # NextAuth config
  lib/__tests__/
    handicap.test.ts
    scoring.test.ts
    matchmaking.test.ts
  prisma/
    schema.prisma
    seed.ts                # Seeds CourseHole data (27 rows) + commissioner account
  DESIGN.md
  CODEX.md
  TODOS.md
```

---

## Prisma Schema (prisma/schema.prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Course {
  id              String       @id @default(cuid())
  name            String
  nineHolePar     Int
  nineHoleRating  Float
  nineHoleSlope   Int
  holes           CourseHole[]
  weeks           Week[]
  createdAt       DateTime     @default(now())
}

model CourseHole {
  id          String  @id @default(cuid())
  courseId    String
  holeNumber  Int     // 1-9
  par         Int     // 3, 4, or 5
  strokeIndex Int     // 1-9 (1 = hardest)
  course      Course  @relation(fields: [courseId], references: [id])

  @@unique([courseId, holeNumber])
}

model Player {
  id             String          @id @default(cuid())
  name           String
  email          String?
  active         Boolean         @default(true)
  seedHandicap   Float?          // manually entered for 0-round players
  attendance     Attendance[]
  handicapRecords HandicapRecord[]
  matchesAsP1    Match[]         @relation("Player1Matches")
  matchesAsP2    Match[]         @relation("Player2Matches")
  holeScores     HoleScore[]
  weeksCtp       Week[]          @relation("CtpWinner")
  weeksLp        Week[]          @relation("LpWinner")
  auditLogs      AuditLog[]
  createdAt      DateTime        @default(now())
}

model Season {
  id        String   @id @default(cuid())
  name      String   // e.g. "Spring 2026"
  type      SeasonType
  startDate DateTime
  endDate   DateTime
  weeks     Week[]
  createdAt DateTime @default(now())

  @@unique([type, startDate]) // prevent duplicate seasons
}

enum SeasonType {
  spring
  summer
}

model Week {
  id                    String       @id @default(cuid())
  seasonId              String
  weekNumber            Int
  date                  DateTime     // Friday date (date only, midnight Phoenix time)
  courseId              String?      // null until commissioner selects on Friday
  ctpHoleNumber         Int?         // 1-9, selected by commissioner
  longestPuttHoleNumber Int?         // 1-9, selected by commissioner
  ctpWinnerId           String?
  longestPuttWinnerId   String?
  locked                Boolean      @default(false)
  season                Season       @relation(fields: [seasonId], references: [id])
  course                Course?      @relation(fields: [courseId], references: [id])
  ctpWinner             Player?      @relation("CtpWinner", fields: [ctpWinnerId], references: [id])
  longestPuttWinner     Player?      @relation("LpWinner", fields: [longestPuttWinnerId], references: [id])
  attendance            Attendance[]
  matches               Match[]
  handicapRecords       HandicapRecord[]
  holeScores            HoleScore[]
  auditLogs             AuditLog[]
  createdAt             DateTime     @default(now())

  @@unique([seasonId, weekNumber])
  @@unique([seasonId, date])
}

model Attendance {
  id       String  @id @default(cuid())
  weekId   String
  playerId String
  present  Boolean @default(false)
  week     Week    @relation(fields: [weekId], references: [id])
  player   Player  @relation(fields: [playerId], references: [id])

  @@unique([weekId, playerId])
}

model Match {
  id                     String      @id @default(cuid())
  weekId                 String
  player1Id              String
  player2Id              String
  player1HandicapIndex   Float?      // snapshotted at lock time
  player2HandicapIndex   Float?      // snapshotted at lock time
  strokeWinnerId         String?     // null = tie
  matchPlayLeadBy        Int?        // 0 = all square, 1-8 = holes up
  matchPlayHolesRemaining Int?       // 0 = all 9 played, 1-4 = ended early
  matchPlayWinnerId      String?     // null = halved
  player2ScorecardOnly   Boolean     @default(false) // threesome pivot
  locked                 Boolean     @default(false)
  week                   Week        @relation(fields: [weekId], references: [id])
  player1                Player      @relation("Player1Matches", fields: [player1Id], references: [id])
  player2                Player      @relation("Player2Matches", fields: [player2Id], references: [id])
  holeScores             HoleScore[] // all holes for both players in this match context
  auditLogs              AuditLog[]
  createdAt              DateTime    @default(now())
}

model HoleScore {
  id            String  @id @default(cuid())
  weekId        String
  playerId      String
  matchId       String  // which match this score was entered for
  holeNumber    Int     // 1-9
  grossScore    Int
  adjustedScore Int     // ESC-capped gross score
  week          Week    @relation(fields: [weekId], references: [id])
  player        Player  @relation(fields: [playerId], references: [id])
  match         Match   @relation(fields: [matchId], references: [id])

  @@unique([weekId, playerId, holeNumber])
}

model HandicapRecord {
  id                  String   @id @default(cuid())
  playerId            String
  weekId              String?  // null for seed/import records
  date                DateTime
  grossScore          Int
  adjustedGrossScore  Int
  courseRating        Float    // snapshotted from Course at time of record
  slopeRating         Int      // snapshotted
  coursePar           Int      // snapshotted
  courseDifferential  Float    // computed: (adjGross - rating) * 113 / slope, 1dp
  usedInIndex         Boolean  @default(false) // recomputed on every handicap recalc
  isImported          Boolean  @default(false) // true for CSV-imported historical records
  week                Week?    @relation(fields: [weekId], references: [id])
  player              Player   @relation(fields: [playerId], references: [id])
  createdAt           DateTime @default(now())
}

model AuditLog {
  id        String   @id @default(cuid())
  weekId    String?
  matchId   String?
  playerId  String?
  action    String   // e.g. "score_edit", "week_lock", "week_unlock", "attendance_toggle"
  field     String?  // field that changed
  oldValue  String?
  newValue  String?
  timestamp DateTime @default(now())
  week      Week?    @relation(fields: [weekId], references: [id])
  match     Match?   @relation(fields: [matchId], references: [id])
  player    Player?  @relation(fields: [playerId], references: [id])
}

model Commissioner {
  id           String   @id @default(cuid())
  username     String   @unique
  passwordHash String
  createdAt    DateTime @default(now())
}
```

---

## lib/db.ts

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: ['error'] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

---

## lib/auth.ts (NextAuth config)

```typescript
import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { compare } from 'bcryptjs'
import { prisma } from '@/lib/db'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null
        const commissioner = await prisma.commissioner.findUnique({
          where: { username: credentials.username },
        })
        if (!commissioner) return null
        const valid = await compare(credentials.password, commissioner.passwordHash)
        if (!valid) return null
        return { id: commissioner.id, name: commissioner.username }
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 }, // 24 hours
  pages: { signIn: '/login' },
}
```

---

## lib/handicap.ts — Pure Functions

All functions are pure (no DB calls). All must pass tests against spreadsheet fixtures.

### Rounding rules
- `scoreDifferential`: round to 1 decimal place
- `handicapIndex`: round to 1 decimal place
- `courseHandicap`: round to nearest integer

### strokesReceivedOnHole

```typescript
/**
 * Returns strokes received by a player on a given hole.
 * strokeIndex: hole difficulty rank 1-9 (1 = hardest)
 * courseHandicap: player's course handicap (integer, already computed)
 */
export function strokesReceivedOnHole(courseHandicap: number, strokeIndex: number): 0 | 1 | 2 {
  // First pass: strokes 1-9
  const firstPass = courseHandicap >= strokeIndex ? 1 : 0
  // Second pass: for handicaps > 9, wrap around
  const secondPass = courseHandicap >= strokeIndex + 9 ? 1 : 0
  return (firstPass + secondPass) as 0 | 1 | 2
}
```

### netDoubleBogey

```typescript
export function netDoubleBogey(par: number, strokesReceived: 0 | 1 | 2): number {
  return par + 2 + strokesReceived
}
```

### applyESC

```typescript
/**
 * Apply Equitable Stroke Control to a single hole score.
 * Returns the adjusted score (capped at net double bogey).
 */
export function applyESC(
  grossScore: number,
  par: number,
  strokesReceived: 0 | 1 | 2
): number {
  const maxScore = netDoubleBogey(par, strokesReceived)
  return Math.min(grossScore, maxScore)
}
```

### scoreDifferential

```typescript
/**
 * Compute 9-hole score differential for a single round.
 * adjustedGrossScore: sum of ESC-adjusted hole scores
 * courseRating: 9-hole rating
 * slopeRating: 9-hole slope (typically 55-155, par = 113)
 */
export function scoreDifferential(
  adjustedGrossScore: number,
  courseRating: number,
  slopeRating: number
): number {
  const raw = (adjustedGrossScore - courseRating) * 113 / slopeRating
  return Math.round(raw * 10) / 10
}
```

### handicapIndex

```typescript
/**
 * WHS lookup table: how many differentials to use based on round count.
 * Returns [best N differentials to average, then multiply by 0.96]
 */
const WHS_LOOKUP: Record<number, number> = {
  1: 1, 2: 1, 3: 2, 4: 2, 5: 2, 6: 2, 7: 3, 8: 3,
  9: 4, 10: 4, 11: 4, 12: 5, 13: 5, 14: 5, 15: 6,
  16: 6, 17: 7, 18: 7, 19: 8, 20: 8,
}

/**
 * Compute Handicap Index from an array of score differentials.
 * Input: all available differentials for the player (up to last 20).
 * Uses most recent 20, picks best N per WHS table, multiplies by 0.96.
 * Returns null if no rounds (player has seed index only).
 */
export function handicapIndex(differentials: number[]): number | null {
  if (differentials.length === 0) return null
  const recent = differentials.slice(-20)
  const count = recent.length
  const useCount = WHS_LOOKUP[Math.min(count, 20)]
  const sorted = [...recent].sort((a, b) => a - b)
  const best = sorted.slice(0, useCount)
  const avg = best.reduce((s, d) => s + d, 0) / best.length
  const raw = avg * 0.96
  return Math.round(raw * 10) / 10
}
```

### courseHandicap

```typescript
/**
 * Compute Course Handicap for 9-hole play.
 * Formula: (HI × Slope / 113) + (Rating - Par), then halve for 9-hole.
 * Round to nearest integer.
 */
export function courseHandicap(
  handicapIndex: number,
  slopeRating: number,
  courseRating: number,
  coursePar: number
): number {
  const full18Equiv = (handicapIndex * slopeRating / 113) + (courseRating - coursePar)
  const nineHole = full18Equiv / 2
  return Math.round(nineHole)
}
```

---

## lib/scoring.ts — Pure Functions

```typescript
export interface MatchInput {
  player1Id: string
  player2Id: string
  player1NetScore: number | null  // null if scores not yet entered
  player2NetScore: number | null
  matchPlayWinnerId: string | null  // null = halved
  matchPlayLeadBy: number | null    // 0 = all square
  player2ScorecardOnly: boolean
}

export interface MatchPoints {
  player1Points: number
  player2Points: number
  breakdown: {
    p1Stroke: number
    p2Stroke: number
    p1MatchPlay: number
    p2MatchPlay: number
    p1Attendance: number
    p2Attendance: number
  }
}

/**
 * Calculate points for a single match.
 * Attendance is always 1 point for both players (unless player2ScorecardOnly).
 * player2ScorecardOnly: player2 earns 0 points from this match.
 */
export function calculateMatchPoints(
  match: MatchInput,
  player1Present: boolean,
  player2Present: boolean
): MatchPoints {
  const p1Attend = player1Present ? 1 : 0
  const p2Attend = player2Present && !match.player2ScorecardOnly ? 1 : 0

  // Stroke play
  let p1Stroke = 0, p2Stroke = 0
  if (match.player1NetScore !== null && match.player2NetScore !== null && !match.player2ScorecardOnly) {
    if (match.player1NetScore < match.player2NetScore) {
      p1Stroke = 2
    } else if (match.player2NetScore < match.player1NetScore) {
      p2Stroke = 2
    } else {
      p1Stroke = 1
      p2Stroke = 1
    }
  } else if (match.player1NetScore !== null && match.player2ScorecardOnly) {
    // Pivot reference match: p1 gets stroke points based on comparison
    // p2 earns nothing
    p1Stroke = 2 // p1 always "wins" stroke vs a reference scorecard
    p2Stroke = 0
  }

  // Match play
  let p1Match = 0, p2Match = 0
  if (!match.player2ScorecardOnly && match.matchPlayLeadBy !== null) {
    if (match.matchPlayWinnerId === match.player1Id) {
      p1Match = 2
    } else if (match.matchPlayWinnerId === match.player2Id) {
      p2Match = 2
    } else {
      // halved
      p1Match = 1
      p2Match = 1
    }
  } else if (match.player2ScorecardOnly) {
    // Pivot reference: match play result is between p1 and p2's scorecard
    // p1 earns match play points, p2 earns nothing
    if (match.matchPlayWinnerId === match.player1Id) {
      p1Match = 2
    } else if (match.matchPlayLeadBy === 0) {
      p1Match = 1
    }
    p2Match = 0
  }

  const p2Total = match.player2ScorecardOnly ? 0 : p2Attend + p2Stroke + p2Match

  return {
    player1Points: p1Attend + p1Stroke + p1Match,
    player2Points: p2Total,
    breakdown: {
      p1Stroke, p2Stroke,
      p1MatchPlay: p1Match, p2MatchPlay: p2Match,
      p1Attendance: p1Attend, p2Attendance: p2Attend,
    },
  }
}

/**
 * Calculate all points for a week, including CTP and LP bonuses.
 * ctpWinnerId / lpWinnerId: null if not awarded (voided).
 */
export function calculateWeekPoints(
  matches: MatchInput[],
  attendance: Record<string, boolean>,
  ctpWinnerId: string | null,
  lpWinnerId: string | null,
  matchPoints: Map<string, MatchPoints>  // matchId -> points
): Map<string, number> {
  const totals = new Map<string, number>()

  for (const [, pts] of matchPoints) {
    // accumulate by player across all matches... caller builds this map
  }

  if (ctpWinnerId) {
    totals.set(ctpWinnerId, (totals.get(ctpWinnerId) ?? 0) + 1)
  }
  if (lpWinnerId) {
    totals.set(lpWinnerId, (totals.get(lpWinnerId) ?? 0) + 1)
  }

  return totals
}
```

---

## lib/matchmaking.ts — Pairing Algorithm

```typescript
import { munkres } from 'munkres-js'

export interface Player {
  id: string
  name: string
  handicapIndex: number
  checkInOrder: number  // order they checked in (1-based)
}

export interface PriorMatch {
  player1Id: string
  player2Id: string
}

export interface PairingResult {
  matches: Array<{ player1: Player; player2: Player }>
  threesome: {
    pivot: Player
    matchA: { player1: Player; player2: Player }  // pivot vs opponent
    matchBRef: { player: Player; referencePlayer: Player }  // new player vs pivot's scorecard
  } | null
  flags: Array<{
    player1Id: string
    player2Id: string
    type: 'repeat' | 'gap'
    detail: string
  }>
}

/**
 * Generate optimal pairings for the current set of checked-in players.
 * Cost function: (handicap_gap * 2) + (prior_matches_this_season * 5)
 * Uses munkres-js minimum-weight perfect matching.
 * Odd N: last checked-in player becomes threesome pivot.
 */
export function generatePairings(
  players: Player[],
  priorMatchesThisSeason: PriorMatch[]
): PairingResult {
  if (players.length < 2) throw new Error('Need at least 2 players')

  let pivot: Player | null = null
  let pairing_players = [...players]

  if (players.length % 2 === 1) {
    // Last checked-in player is pivot (threesome last group out)
    const sorted_by_checkin = [...players].sort((a, b) => b.checkInOrder - a.checkInOrder)
    pivot = sorted_by_checkin[0]
    pairing_players = players.filter(p => p.id !== pivot!.id)
  }

  const n = pairing_players.length
  const sorted = [...pairing_players].sort((a, b) => a.handicapIndex - b.handicapIndex)

  // Build cost matrix (n x n)
  const costMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0))

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        costMatrix[i][j] = 9999 // can't pair with self
        continue
      }
      const gap = Math.abs(sorted[i].handicapIndex - sorted[j].handicapIndex)
      const priorCount = priorMatchesThisSeason.filter(
        m =>
          (m.player1Id === sorted[i].id && m.player2Id === sorted[j].id) ||
          (m.player1Id === sorted[j].id && m.player2Id === sorted[i].id)
      ).length
      costMatrix[i][j] = gap * 2 + priorCount * 5
    }
  }

  const assignment = munkres(costMatrix)

  const matches: PairingResult['matches'] = []
  const paired = new Set<number>()

  for (const [i, j] of assignment) {
    if (paired.has(i) || paired.has(j)) continue
    if (i < j) {
      matches.push({ player1: sorted[i], player2: sorted[j] })
      paired.add(i)
      paired.add(j)
    }
  }

  // Flags
  const flags: PairingResult['flags'] = []
  for (const m of matches) {
    const gap = Math.abs(m.player1.handicapIndex - m.player2.handicapIndex)
    if (gap > 6) {
      flags.push({ player1Id: m.player1.id, player2Id: m.player2.id, type: 'gap', detail: `Gap: ${gap.toFixed(1)}` })
    }
    const repeats = priorMatchesThisSeason.filter(
      pm =>
        (pm.player1Id === m.player1.id && pm.player2Id === m.player2.id) ||
        (pm.player1Id === m.player2.id && pm.player2Id === m.player1.id)
    ).length
    if (repeats > 0) {
      flags.push({ player1Id: m.player1.id, player2Id: m.player2.id, type: 'repeat', detail: `Played ${repeats}× this season` })
    }
  }

  // Threesome: find best match for pivot reference
  let threesome: PairingResult['threesome'] = null
  if (pivot) {
    // Pivot goes with the last match (lowest priority pair)
    const refMatch = matches[matches.length - 1]
    threesome = {
      pivot,
      matchA: refMatch,
      matchBRef: { player: pivot, referencePlayer: refMatch.player1 }, // pivot vs p1's scorecard
    }
  }

  return { matches, threesome, flags }
}
```

---

## API Route Contracts

### Authentication
- `POST /api/auth/[...nextauth]` — NextAuth handler (login, session)
- All routes except auth return 401 if no valid session

### Players
- `GET /api/players` → `Player[]` (active only by default, `?all=true` for all)
- `POST /api/players` body: `{name, email?, seedHandicap?}` → `Player`
- `PATCH /api/players/[id]` body: `{name?, email?, active?, seedHandicap?}` → `Player`

### Seasons
- `GET /api/seasons` → `Season[]`
- `POST /api/seasons` body: `{name, type, startDate, weekDates: string[]}` → `Season` + creates all `Week` records

### Weeks
- `GET /api/weeks?current=true` → current week (date matches today in America/Phoenix)
- `GET /api/weeks?seasonId=X` → `Week[]`
- `PATCH /api/weeks/[id]` body: `{courseId?, ctpHoleNumber?, longestPuttHoleNumber?, ctpWinnerId?, longestPuttWinnerId?}` → `Week`

### Attendance
- `GET /api/weeks/[id]/attendance` → `{playerId, name, handicapIndex, present}[]` sorted: present first
- `POST /api/weeks/[id]/attendance` body: `{playerId, present}` → optimistic toggle, writes AuditLog

### Pairings
- `POST /api/weeks/[id]/pairings` body: `{playerIds: string[]}` → generates pairings, returns `PairingResult`
  - Creates `Match` records in tentative state
  - Requires `courseId` set on week (for handicap calculation)
- `GET /api/weeks/[id]/pairings` → current matches with flags and score status
- `POST /api/weeks/[id]/pairings/lock` → locks all matches, snapshots handicap indexes, writes AuditLog
- `DELETE /api/weeks/[id]/pairings/lock` (unlock) → unlocks week and all matches, writes AuditLog

### Scores
- `GET /api/weeks/[id]/matches/[matchId]/scores` → `{holeNumber, player1Gross, player1Adj, player1Net, player2Gross, player2Adj, player2Net}[]`
- `POST /api/weeks/[id]/matches/[matchId]/scores`
  - body: `{player1Scores: {holeNumber, grossScore}[], player2Scores: {holeNumber, grossScore}[], matchPlayLeadBy, matchPlayHolesRemaining, matchPlayWinnerId}`
  - Validates: all 9 holes present for both players, match is locked, both players present
  - Computes: adjustedScore per hole (ESC), net scores, strokeWinnerId
  - Triggers: handicap recalculation for both players (updates `HandicapRecord.usedInIndex`)
  - Writes: AuditLog entry
  - Returns: `{match, pointsSummary: {player1Points, player2Points, breakdown}}`

### Standings
- `GET /api/standings?seasonId=X` → `{playerId, name, totalPoints, matchesPlayed, strokeWins, matchPlayWins, ctpWins, lpWins}[]` sorted by totalPoints desc
- `GET /api/standings?year=2026&type=overall` → combines Spring + Summer

### Courses
- `GET /api/courses` → `Course[]` with holes

### Import/Export
- `POST /api/import` — multipart CSV upload. Format: `playerId,date,grossScore,adjustedGrossScore,courseRating,slopeRating,coursePar`. Creates `HandicapRecord` rows with `isImported=true`. Triggers handicap recalc.
- `GET /api/export?type=standings&seasonId=X` → CSV download
- `GET /api/export?type=scores&weekId=X` → CSV download
- `GET /api/export?type=differentials&playerId=X` → CSV download

---

## Tailwind Config (tailwind.config.ts)

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: {
          base:     '#0f1117',
          elevated: '#1a1f2e',
          sunken:   '#131720',
          border:   '#2a3040',
        },
        brand: {
          DEFAULT: '#4b9e6f',
          hover:   '#3d8a5e',
          dim:     '#1a2818',
          text:    '#6fcf97',
        },
        warn: {
          DEFAULT: '#f59e0b',
          dim:     '#2d1f0e',
          text:    '#fcd34d',
        },
        danger: {
          DEFAULT: '#ef4444',
          dim:     '#2d1010',
          text:    '#fca5a5',
        },
        info: {
          dim:  '#1e3a5f',
          text: '#93c5fd',
        },
      },
    },
  },
  plugins: [],
}

export default config
```

---

## Database Seed (prisma/seed.ts)

```typescript
import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Commissioner account
  await prisma.commissioner.upsert({
    where: { username: 'commissioner' },
    update: {},
    create: {
      username: 'commissioner',
      passwordHash: await hash('changeme', 12), // commissioner changes this on first login
    },
  })

  // Oakwood CC courses — replace with actual ratings/slopes
  const courses = [
    { name: 'Oakwood CC — Course A', nineHolePar: 36, nineHoleRating: 35.2, nineHoleSlope: 128 },
    { name: 'Oakwood CC — Course B', nineHolePar: 36, nineHoleRating: 34.8, nineHoleSlope: 124 },
    { name: 'Oakwood CC — Course C', nineHolePar: 35, nineHoleRating: 34.1, nineHoleSlope: 120 },
  ]

  // Hole data — replace with actual Oakwood par and stroke index values
  const holeData = {
    'Course A': [
      { holeNumber: 1, par: 4, strokeIndex: 3 },
      { holeNumber: 2, par: 5, strokeIndex: 7 },
      { holeNumber: 3, par: 3, strokeIndex: 9 },
      { holeNumber: 4, par: 4, strokeIndex: 1 },
      { holeNumber: 5, par: 4, strokeIndex: 5 },
      { holeNumber: 6, par: 3, strokeIndex: 8 },
      { holeNumber: 7, par: 5, strokeIndex: 2 },
      { holeNumber: 8, par: 4, strokeIndex: 4 },
      { holeNumber: 9, par: 4, strokeIndex: 6 },
    ],
    // TODO: fill in actual Course B and Course C hole data before seeding
  }

  for (const course of courses) {
    await prisma.course.upsert({
      where: { id: course.name }, // use name as stable id for seeding
      update: course,
      create: { ...course, id: course.name },
    })
  }

  console.log('Seed complete. Change commissioner password before first use.')
}

main().catch(console.error).finally(() => prisma.$disconnect())
```

---

## Test Fixtures (lib/__tests__/handicap.test.ts)

```typescript
import { describe, it, expect } from 'vitest'
import {
  scoreDifferential,
  handicapIndex,
  courseHandicap,
  strokesReceivedOnHole,
  applyESC,
} from '../handicap'

describe('strokesReceivedOnHole', () => {
  it('0 strokes when course handicap < stroke index', () => {
    expect(strokesReceivedOnHole(5, 7)).toBe(0)
  })
  it('1 stroke when course handicap >= stroke index', () => {
    expect(strokesReceivedOnHole(5, 3)).toBe(1)
  })
  it('2 strokes when course handicap >= stroke index + 9', () => {
    expect(strokesReceivedOnHole(14, 5)).toBe(1) // 14 >= 5, but 14 < 14 (5+9)
    expect(strokesReceivedOnHole(15, 5)).toBe(2) // 15 >= 5 AND 15 >= 14
  })
})

describe('scoreDifferential', () => {
  it('computes differential correctly and rounds to 1dp', () => {
    // Known example: adjGross 42, rating 35.2, slope 128
    expect(scoreDifferential(42, 35.2, 128)).toBe(
      Math.round(((42 - 35.2) * 113 / 128) * 10) / 10
    )
  })
})

describe('handicapIndex', () => {
  it('returns null for empty differentials', () => {
    expect(handicapIndex([])).toBeNull()
  })
  it('uses WHS lookup table for fewer than 20 rounds', () => {
    // 3 rounds: use best 2, multiply by 0.96
    const diffs = [5.0, 8.0, 6.0]
    const result = handicapIndex(diffs)
    const expected = Math.round(((5.0 + 6.0) / 2) * 0.96 * 10) / 10
    expect(result).toBe(expected)
  })
  it('uses best 8 of most recent 20 for full records', () => {
    const diffs = Array.from({ length: 20 }, (_, i) => 10 - i * 0.3) // 20 differentials
    const result = handicapIndex(diffs)
    expect(result).not.toBeNull()
    // Verify it used the 8 lowest of the 20
  })
})

// TODO: add test cases from commissioner's actual spreadsheet once obtained
// These are the canonical fixtures — if these fail, the app is wrong
describe('Commissioner spreadsheet fixtures', () => {
  it.todo('Player A: 15 rounds, known differentials → expected HI X.X')
  it.todo('Player B: 8 rounds → expected HI Y.Y')
  it.todo('Course handicap for HI 14.2 on Course A (slope 128, rating 35.2, par 36)')
})
```

---

## PM2 Ecosystem Config (ecosystem.config.js)

```javascript
module.exports = {
  apps: [{
    name: 'silicon',
    script: 'node_modules/.bin/next',
    args: 'start',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      TZ: 'America/Phoenix',
    },
  }],
}
```

---

## nginx Config (reference)

```nginx
server {
  listen 80;
  server_name yourdomain.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl;
  server_name yourdomain.com;

  ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

  location / {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

---

## Deploy Workflow

```bash
git pull
npx prisma migrate deploy
npm run build          # prisma generate runs first via prebuild
pm2 reload silicon
```

---

## Vitest Config (vitest.config.ts)

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/__tests__/**/*.test.ts'],
  },
})
```

---

## Critical Rules for Codex

1. **Handicap math must match the commissioner's spreadsheet.** Get actual worked examples before finalizing `lib/handicap.ts`. The `it.todo` test stubs are placeholders — fill them in first.
2. **Rounding is exact.** Differential to 1dp, index to 1dp, course handicap to integer. No `toFixed` without subsequent `parseFloat`.
3. **Timezone is America/Phoenix.** All "is today a Friday?" logic must use Phoenix local time, not UTC. Use `new Date().toLocaleDateString('en-US', { timeZone: 'America/Phoenix' })` or the `date-fns-tz` library.
4. **player2ScorecardOnly matches earn no points for player2.** This is the threesome pivot rule. The scoring module enforces it — never award points to player2 when this flag is true.
5. **HoleScore is unique per (weekId, playerId, holeNumber).** The pivot's scores are shared across both matches — write once, query twice.
6. **All API routes require authentication.** Use a middleware wrapper. Unauthenticated requests return 401.
7. **Write AuditLog entries for all score edits, lock/unlock actions, and attendance changes.** These are required for commissioner trust in the data.
8. **Course Handicap formula is halved for 9-hole play.** `courseHandicap = round((HI × Slope/113 + (Rating - Par)) / 2)`. Do not skip the halving step.
9. **usedInIndex recomputation:** On every `HandicapRecord` write for a player, recompute which records are in the "best 8 of 20" set and update `usedInIndex` for all of that player's records in a single transaction.
10. **CSV import is idempotent.** If the same (playerId, date, grossScore) combination is uploaded twice, update rather than duplicate.

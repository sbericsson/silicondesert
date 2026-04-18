# Silicon Desert Golf League

A commissioner app for running a 9-hole Friday golf league in Phoenix, AZ. The players are mostly current and former semiconductor professionals — hence Silicon Desert.

The app replaces the usual spreadsheet-and-text-thread workflow with a single place to run the season from check-in through final standings.

---

## What it does

Each Friday follows the same rhythm: players arrive, the commissioner checks them in, the app generates pairings, the card gets locked, scores come in, and the week closes. Silicon Desert handles every step of that loop.

**Roster & seasons**
- Player records with contact info, tee preferences, and handicap history
- Spring and summer seasons, each with a weekly schedule
- Per-season tee color assignments (blue / silver / white / yellow) with gender defaults

**The week workspace**
- Check players in as they arrive — the check-in order feeds into pairing logic
- Attendance-only check-ins for players who show up but don't play (earn attendance point, skipped in pairings)
- Generate pairings automatically, tweak them manually, then lock the card
- Set the CTP and longest-putt holes and record winners
- Track odd-player-count weeks: one player plays as a threesome pivot with a live match and a scorecard-only reference match

**Score entry**
- Hole-by-hole gross scores per player
- ESC (Equitable Stroke Control) applied automatically using net double bogey
- Match play result computed in real time as holes are entered
- Stroke and match play points calculated per match; CTP and LP each add a bonus point

**Handicaps**
- WHS-compliant score differentials: `(adjustedGross − courseRating) × 113 / slope`
- Index calculation follows WHS Rule 5.2a (1–20 rounds, best differentials with appropriate adjustments)
- Prior handicap history can be imported for players joining mid-season or transferring records
- "NEW", "EST", and "HCP" labels surface clearly in the commissioner view

**Standings & history**
- Season leaderboard with per-week point breakdowns
- Completed week summaries with match results, scores, and side competition winners
- Audit log on score and pairing changes

**Public league pages**
- Read-only views for members: standings, schedule, current week, and roster
- Commissioner can toggle public roster visibility on/off

---

## Scoring

Each week a player can earn up to **5 points** per match:

| Category | Points |
|---|---|
| Attendance | 1 |
| Stroke play (net score vs. opponent) | 0–2 |
| Match play (hole-by-hole net) | 0–2 |
| Closest to pin (CTP) | +1 bonus |
| Longest putt (LP) | +1 bonus |

Stroke and match play each award 2 to the winner, 1–1 for a tie, 0 to the loser. A scorecard-only player (absent opponent) forfeits attendance, stroke, and match play points.

---

## Pairings

The pairing algorithm balances two competing goals: minimize handicap gap between opponents, and avoid rematches within a season. It does this with a cost function:

```
cost = handicapGap × 2 + repeatCount × 5
```

For even player counts, a greedy algorithm pairs from the sorted handicap list. For odd counts, the last-checked-in player (or a commissioner-designated trailing player) becomes the threesome pivot and plays a live match against their closest available opponent while a third player plays a scorecard-only reference match against the pivot's score.

The commissioner can override any pairing before locking the card. Pairings with a handicap gap > 6 or with repeat opponents are flagged.

---

## Tech stack

- **Next.js 14** — app router, server components, server actions
- **TypeScript**
- **PostgreSQL** + **Prisma** — schema, migrations, seed
- **NextAuth** — commissioner authentication (username/password)
- **Tailwind CSS**
- **Vitest** — unit tests for scoring, handicap, matchmaking, and utilities

---

## Local development

```bash
cp .env.example .env
# fill in DATABASE_URL and NEXTAUTH_SECRET
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Useful:

```bash
npm test          # run unit tests
npm run build     # type-check and build
npm run db:studio # Prisma Studio
```

The app assumes `America/Phoenix` timezone throughout. No DST — the desert keeps it simple.

---

## Project layout

```
app/
  (app)/          commissioner workspace (auth required)
    week/         check-in, pairings, score entry
    roster/       player management
    standings/    season leaderboard
    history/      completed week summaries
  (auth)/login/   commissioner login
  public/         public-facing league pages (no auth)
lib/
  handicap.ts               WHS index and course handicap calculations
  handicap-records.ts       DB-level usedInIndex marking per WHS Rule 5.2a
  playing-handicap.ts       course handicap and index value helpers
  player-handicap-display.ts  NEW / EST / HCP display labels
  imported-handicap.ts      prior handicap round import and parsing
  scoring.ts                match play, stroke play, and point totals
  match-score.ts            match result recording, ESC, and handicap recomputation
  matchmaking.ts            pairing algorithm
  week.ts                   week lifecycle queries
  history.ts                completed week summary queries
  standings.ts              season standings aggregation
  roster.ts                 player and season queries
prisma/
  schema.prisma   data model
  migrations/     migration history
  seed.ts         development seed data
```

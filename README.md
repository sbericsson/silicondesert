# Silicon Desert Golf League

A commissioner app for running a 9-hole Friday golf league in Phoenix, AZ. The players are mostly current and former semiconductor professionals — hence Silicon Desert.

The app replaces the usual spreadsheet-and-text-thread workflow with a single place to run the season from check-in through public results.

---

## What it does

Each Friday follows the same rhythm: the commissioner opens the week, players arrive, the app builds pairings, the card gets locked, scores come in, and the week closes. Silicon Desert handles every step of that loop.

**Roster, courses & seasons**
- Player records with contact info, normalized cell numbers, tee preferences, active/inactive status, and handicap history
- Spring and summer seasons with editable Friday schedules before league activity starts
- Season archival so old seasons stay in standings and history without staying editable
- Per-season tee color assignments (blue / silver / white / yellow) with gender defaults
- Course setup for 9-hole tracks, including tee ratings/slopes by color and gender, hole pars, and men's/women's stroke indexes
- Imported prior rounds for players joining mid-stream or carrying handicap history into the league

**The week workspace**
- Start the next scheduled week and keep only one unclosed week active at a time
- Pick the course, handicap basis (rounded index or course handicap), CTP hole, and longest-putt hole
- Check players in as they arrive — the check-in order feeds into pairing logic
- Track weekly side games: CTP, longest putt, early-bird requests, eligible players, and $5 pots
- Generate pairings automatically, add manual matches, use reference scorecards, and remove tentative pairings before lock
- Override tees per match, then lock the card with handicap snapshots for the week
- Unlock for corrections, clear individual match scores, close completed weeks, and copy public pairings/results text

**Score entry**
- Hole-by-hole gross scores per player, on a desktop score-entry grid or a mobile match screen
- Net scores, pop dots, stroke-play result, and match-play status calculated as scores are entered
- ESC (Equitable Stroke Control) applied automatically using net double bogey
- Match play result computed from hole-by-hole net scores, including "up", "all square", halved, and "2 & 1"-style clinches
- Stroke and match play points calculated per match; CTP and longest putt each add a bonus point
- Saved scores create/update handicap records and recompute which rounds count toward the player's index

**Handicaps**
- WHS-style score differentials: `(adjustedGross − courseRating) × 113 / slope`
- Index calculation uses the most recent 20 differentials and the WHS Rule 5.2a best-round table
- League rule for 1–3 rounds establishes an initial handicap from the lowest differential with the 3-round WHS adjustment
- Weekly play can use either rounded handicap index or course handicap for pairings, pops, and net scoring
- Prior handicap history can be imported or edited from the roster screen
- "NEW", "EST", and "HCP" labels surface clearly in the commissioner view

**Standings & history**
- Season leaderboard with total, attendance, stroke, match-play, CTP, and longest-putt points
- Completed week summaries with match results, scorecard links, scores, and side competition winners
- History and standings keep archived seasons visible
- Audit log on attendance, pairing, score, lock, tee, and week lifecycle changes

**Public league pages**
- Read-only pages for members: standings, schedule, current week, completed week results, match scorecards, and roster
- Public standings can show a season view or an overall view across seasons with results
- Public week pages reveal pairings after lock and results after all scores are complete
- Printable public week scorecard/results view
- Commissioner can toggle public roster visibility on/off

---

## Scoring

Each week a player can earn up to **5 match points**, plus side-game bonus points:

| Category | Points |
|---|---|
| Attendance | 1 |
| Stroke play (net score vs. opponent) | 0–2 |
| Match play (hole-by-hole net) | 0–2 |
| Closest to pin (CTP) | +1 bonus |
| Longest putt (LP) | +1 bonus |

Stroke and match play each award 2 to the winner, 1–1 for a tie, 0 to the loser. Attendance-only players earn their attendance point but are skipped in pairings.

In odd-player weeks, a scorecard-only reference opponent does not earn attendance, stroke, or match-play points. The live player can still win or halve stroke and match play against that reference scorecard.

---

## Pairings

The pairing algorithm balances two competing goals: keep handicap gaps reasonable and avoid rematches within a season. The base cost function is:

```
cost = handicapGap × 2 + repeatCount × 30
```

Pairings use the current week's handicap basis: rounded index or course handicap. Each Generate Next Pairing click creates the next best available group instead of filling the whole card at once. Early-bird players are paired first with their best available opponent, then the remaining even-sized pool is solved as a minimum total-cost matching. Groups are ordered so early-bird groups float up, earlier check-ins get a modest ordering bias, and the designated trailing player stays in the last group when possible.

For odd player counts, the pivot is the designated trailing player if one is available; otherwise it is the last checked-in player. The pivot plays a live match, and a third player plays a scorecard-only reference match against a player from that live group.

By default, Peter Pestalozzi is the trailing player when checked in. If he is not playing, the commissioner can choose a weekly commissioner to fill that role.

The commissioner can override any pairing before locking the card. Pairings with a handicap gap > 6 or with repeat opponents are flagged. A scorecard-only reference match counts as a repeat for both players, so pairing them again is flagged. The check-in list shows each player's prior opponents by initials; the player who played a reference scorecard picks up that opponent, while the player who lent the card does not.

Each pairing also names where the pops land, for example "Natasha Ericsson gets 6 pops on holes 1, 3, 5, 6, 8, 9." Pops follow the stroke index, using the women's index whenever either player in the match is a woman. Above nine pops the holes carrying a second stroke are listed separately.

After locking, the card can be unlocked for corrections — with a confirmation step if scores have already been entered. Individual match scores can also be cleared without affecting other matches.

---

## Tech stack

- **Next.js 14** — app router, server components, API routes
- **React 18**
- **TypeScript**
- **PostgreSQL** + **Prisma** — schema, migrations, seed
- **NextAuth** — commissioner authentication (username/password)
- **Tailwind CSS**
- **Vitest** — unit tests for scoring, handicap, matchmaking, week lifecycle, roster utilities, and public-page revalidation

---

## Local development

```bash
cp .env.example .env
# fill in DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, and TZ
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

The seed creates Oakwood/Ironwood course data and a development commissioner login:

```text
username: commissioner
password: changeme
```

Useful:

```bash
npm test                       # run unit tests
npm run test:watch             # watch unit tests
npm run build                  # generate Prisma client, type-check, and build
npm run db:studio              # Prisma Studio
npm run db:migrate             # deploy migrations
npm run db:recompute-index-esc # maintenance script for saved ESC/index data
```

The app assumes `America/Phoenix` timezone throughout. No DST — the desert keeps it simple.

---

## Project layout

```
app/
  (app)/          commissioner workspace (auth required)
    week/         check-in, pairings, score entry, week close
    roster/       players, seasons, courses, public roster setting
    standings/    commissioner season leaderboard
    history/      completed week summaries
  (auth)/login/   commissioner login
  api/            authenticated mutation/query routes
  public/         public-facing league pages (no auth)
lib/
  handicap.ts               WHS index, ESC, and course handicap math
  handicap-records.ts       DB-level usedInIndex marking per WHS Rule 5.2a
  playing-handicap.ts       weekly index-vs-course-handicap helpers
  player-handicap-display.ts  NEW / EST / HCP display labels
  imported-handicap.ts      prior handicap round import, validation, and course matching
  course-tee.ts             tee defaults and per-season/per-match tee resolution
  match-net-scoring.ts      pop allocation for match net scoring
  scoring.ts                match play, stroke play, and point totals
  match-score.ts            score entry, ESC, handicap records, and score recomputation
  matchmaking.ts            pairing algorithm and warnings
  week.ts                   active/upcoming week lifecycle queries
  week-commissioner.ts      trailing-player / weekly commissioner helper
  history.ts                completed week summary queries
  standings.ts              commissioner standings aggregation
  public-*.ts               public roster, standings, URL, and week data
  roster.ts                 player, course, season, and settings queries
prisma/
  schema.prisma   data model
  migrations/     migration history
  seed.ts         development seed data
scripts/
  recompute-index-esc-rounds.ts  maintenance script for recalculating saved rounds
```

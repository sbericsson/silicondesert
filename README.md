# Silicon Desert Golf League

Commissioner app for a 9-hole Friday golf league in Phoenix, AZ. It runs the weekly loop (open week, check-in, pairings, lock, score entry, close) and publishes read-only results for league members.

## Features

**Commissioner workspace** (auth required)
- Roster, courses (tee ratings/slopes, pars, men's/women's stroke indexes), and spring/summer seasons with per-season tee assignments (blue/silver/white/yellow)
- Weekly workflow: pick course, handicap basis (rounded index or course handicap), CTP and longest-putt holes; check players in; generate or hand-build pairings; override tees; lock the card; unlock for corrections; close the week
- Printable check-in sheet with handicaps, prior opponents this season, and club-membership tracking
- Score entry on a desktop grid or mobile match screen, with net scores, pops, stroke-play and match-play results computed live
- Season standings, completed-week history, and an audit log of attendance, pairing, score, lock, and lifecycle changes
- Handicap history import for players joining mid-stream

**Public pages** (`/public`, no auth)
- Standings (per season or overall), schedule, current week, completed-week results and scorecards, roster (commissioner can toggle visibility)
- Pairings appear after lock; results appear once all scores are in
- Printable week scorecard/results view
- Week URLs use the Phoenix match date, e.g. `/public/weeks/2026-07-31`. Old CUID links redirect to the dated path. A date must match exactly one locked week, otherwise the not-found page is returned.

## Rules

**Points per player per week**

| Category | Points |
|---|---|
| Attendance | 1 |
| Stroke play (net) | 2 win / 1 tie / 0 loss |
| Match play (hole-by-hole net) | 2 win / 1 halve / 0 loss |
| Closest to pin | +1 |
| Longest putt | +1 |

Attendance-only players score the attendance point and are skipped in pairings. With an odd count, the extra player plays a scorecard-only reference match against a player in a live group; the reference opponent earns no points, the live player can still win or halve against it.

**Handicaps** (`lib/handicap.ts`)
- Differential: `(adjustedGross − courseRating) × 113 / slope`, using ESC (net double bogey cap)
- Index: most recent 20 differentials, WHS Rule 5.2a table; with 1–3 rounds, the lowest differential minus 2.0
- Pops follow the stroke index, using the women's index if either player in the match is a woman

**Pairings** (`lib/matchmaking.ts`)
- Minimum-cost matching with `cost = handicapGap × 2 + repeatCount × 30`
- Early-bird players are paired first; earlier check-ins get a mild ordering bias
- Odd counts: the trailing player (default Peter Pestalozzi, or a chosen weekly commissioner) is the pivot and stays in the last group
- Warnings for handicap gap > 6 and repeat opponents (reference matches count as repeats)

## Stack

Next.js 14 (app router), React 18, TypeScript, PostgreSQL + Prisma, NextAuth (username/password), Tailwind CSS, Vitest. The app assumes `America/Phoenix` throughout.

## Local development

```bash
cp .env.example .env     # set DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, TZ
npm install
npx prisma migrate dev
npm run db:seed          # sample courses + login: commissioner / changeme
npm run dev
```

| Command | Purpose |
|---|---|
| `npm test` / `npm run test:watch` | Unit tests |
| `npm run build` | Prisma generate, type-check, build |
| `npm run db:studio` | Prisma Studio |
| `npm run db:migrate` | Deploy migrations |
| `npm run db:recompute-index-esc` | Recompute saved ESC/index data |

Deployment: `deploy.sh` (production) and `deploy-staging.sh` pull `main`, build, and restart the PM2 app defined in `ecosystem.config.js`.

## Layout

```
app/
  (app)/          commissioner workspace: week, roster, standings, history
  (auth)/login/   login
  api/            authenticated routes
  public/         public pages
components/       shared UI (check-in sheet, standings table, stepper)
lib/              domain logic (handicap, scoring, matchmaking, standings, week lifecycle, public data) + __tests__
prisma/           schema, migrations, seed
scripts/          maintenance and historical import scripts
```

See `CHANGELOG.md` for release history and `DESIGN.md` for the design system.

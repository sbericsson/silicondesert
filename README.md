# Silicon Desert Golf League

Commissioner web app for running a 9-hole Friday golf league.

## Stack

- Next.js 14 App Router
- PostgreSQL
- Prisma
- NextAuth credentials auth
- Tailwind CSS

## Local Setup

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL`, `NEXTAUTH_SECRET`, and `NEXTAUTH_URL`.
3. Install dependencies:

```bash
npm install
```

4. Run Prisma against your database:

```bash
npx prisma migrate dev
npm run db:seed
```

5. Start the app:

```bash
npm run dev
```

Default seeded commissioner login:

- username: `commissioner`
- password: `changeme`

## VPS Deploy Outline

1. Provision PostgreSQL and create a database.
2. Set production env vars:
   - `DATABASE_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`
   - `TZ=America/Phoenix`
3. Install dependencies:

```bash
npm install
```

4. Run migrations and seed:

```bash
npx prisma migrate deploy
npm run db:seed
```

5. Build and start:

```bash
npm run build
pm2 start ecosystem.config.js
```

6. Put nginx in front of the app and terminate TLS there.

## Staging Refresh

From the staging checkout on the VPS, you can replace `silicon_staging` with a fresh copy of production:

```bash
./refresh-staging-db.sh
./deploy-staging.sh
```

The refresh script reads staging `.env`, derives production as `silicon` by default, and refuses to run if the source and target database URLs are identical.

## Current Status

Working now:

- commissioner auth
- roster and season setup
- week check-in
- pairings generation and lock/unlock
- score entry
- standings
- history summary

Still to finish:

- CSV import/export
- richer season/history filters
- course admin UI
- production data migration workflow

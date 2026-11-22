// Value: protects=the Next 16 runtime paths a unit test cannot reach: proxy.ts discovery and the signed-out gate,
//   next-auth credentials login, every awaited `props.params`/`searchParams` in the dynamic route handlers and
//   pages the codemod rewrote (courses/players/seasons/weeks/pairings/scores/close and the (app) + public pages),
//   and the public visibility rules (match pages hidden until close, roster detail behind the commissioner flag);
//   fails_when=Next stops finding proxy.ts, a handler or page reads params without awaiting them (500/404), login
//   or the session cookie breaks, the Friday flow (season -> start -> check-in -> pairings -> lock -> scores ->
//   close -> standings) regresses, or a public page leaks data before it should;
//   why_new=pass 1 left 22 runtime-only gaps that were checked by a one-off manual curl run against `next start`;
//   seam=none (real `next start`, real Postgres, real next-auth); no_claim=browser behaviour (client components,
//   hydration, forms), visual output, or anything about `next dev`
//
// Usage: build and start the app against a throwaway database, then
//   DATABASE_URL=postgresql://localhost:5432/silicon_e2e E2E_BASE_URL=http://localhost:3000 npm run test:e2e
// The script WIPES league data (players, seasons, weeks, scores, audit log) in DATABASE_URL before it runs, so it
// refuses any database that is not on localhost with "e2e" or "smoke" in its name. The server must use the same
// database; a sentinel row written here and read back through the API proves that before the wipe and before any
// API write.
import { PrismaClient } from '@prisma/client'

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])
const SEASON_NAME = 'E2E Smoke Season'
const THROWAWAY_PREFIX = 'E2E Throwaway'
const PLAYER_COUNT = 8

function refuse(reason: string): never {
  console.error(`e2e-smoke: refusing to run: ${reason}`)
  process.exit(2)
}

function guardDatabaseUrl() {
  const raw = process.env.DATABASE_URL
  if (!raw) {
    refuse('DATABASE_URL is not set (export it explicitly; .env files are not read)')
  }

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    refuse('DATABASE_URL is not a valid URL')
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ''))
  if (!LOCAL_HOSTS.has(url.hostname)) {
    refuse(`DATABASE_URL host "${url.hostname}" is not localhost; this script deletes league data`)
  }

  if (!/e2e|smoke/i.test(databaseName)) {
    refuse(`database "${databaseName}" does not contain "e2e" or "smoke"; this script deletes league data`)
  }

  return raw
}

function guardBaseUrl() {
  const raw = process.env.E2E_BASE_URL || 'http://localhost:3000'
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    refuse(`E2E_BASE_URL "${raw}" is not a valid URL`)
  }

  if (!LOCAL_HOSTS.has(url.hostname)) {
    refuse(`E2E_BASE_URL host "${url.hostname}" is not localhost; this script writes data through the API`)
  }

  return url.origin
}

const databaseUrl = guardDatabaseUrl()
const BASE = guardBaseUrl()
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } })

// ---- tiny check runner ----

let passed = 0
let failed = 0

function check(name: string, ok: boolean, detail = '') {
  if (ok) {
    passed += 1
    console.log(`PASS ${name}${detail ? ` (${detail})` : ''}`)
  } else {
    failed += 1
    console.log(`FAIL ${name}${detail ? ` (${detail})` : ''}`)
  }
}

function checkStatus(name: string, expected: number, actual: number) {
  check(name, actual === expected, expected === actual ? String(actual) : `expected ${expected}, got ${actual}`)
}

class SetupError extends Error {}

function need<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new SetupError(what)
  }
  return value
}

// ---- HTTP with a cookie jar ----

type Jar = Map<string, string>

function storeCookies(jar: Jar, response: Response) {
  for (const header of response.headers.getSetCookie()) {
    const [pair, ...attributes] = header.split(';')
    const separator = pair.indexOf('=')
    if (separator === -1) {
      continue
    }
    const name = pair.slice(0, separator).trim()
    const value = pair.slice(separator + 1).trim()
    const expired = attributes.some((attribute) => /^\s*max-age=0\s*$/i.test(attribute))
    if (!value || expired) {
      jar.delete(name)
    } else {
      jar.set(name, value)
    }
  }
}

function cookieHeader(jar: Jar) {
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ')
}

type RequestOptions = {
  jar?: Jar
  method?: string
  json?: unknown
  form?: Record<string, string>
  headers?: Record<string, string>
  follow?: boolean
}

type Result = {
  status: number
  location: string | null
  hops: number[]
  text: string
  json: unknown
}

async function request(path: string, options: RequestOptions = {}): Promise<Result> {
  const { jar, method = 'GET', json, form, headers = {}, follow = false } = options
  let url = new URL(path, BASE).toString()
  const hops: number[] = []

  for (let hop = 0; hop < 6; hop += 1) {
    const requestHeaders: Record<string, string> = { ...headers }
    if (jar && jar.size > 0) {
      requestHeaders.cookie = cookieHeader(jar)
    }
    let body: string | undefined
    if (hop === 0 && json !== undefined) {
      requestHeaders['content-type'] = 'application/json'
      body = JSON.stringify(json)
    } else if (hop === 0 && form) {
      requestHeaders['content-type'] = 'application/x-www-form-urlencoded'
      body = new URLSearchParams(form).toString()
    }

    const response = await fetch(url, {
      method: hop === 0 ? method : 'GET',
      headers: requestHeaders,
      body,
      redirect: 'manual'
    })
    if (jar) {
      storeCookies(jar, response)
    }

    const location = response.headers.get('location')
    if (follow && location && response.status >= 300 && response.status < 400) {
      hops.push(response.status)
      await response.arrayBuffer()
      url = new URL(location, url).toString()
      continue
    }

    const text = await response.text()
    let parsed: unknown = null
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      parsed = null
    }
    return { status: response.status, location, hops, text, json: parsed }
  }

  throw new SetupError(`too many redirects for ${path}`)
}

type JsonObject = Record<string, unknown>

function asObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {}
}

function asArray(value: unknown): JsonObject[] {
  return Array.isArray(value) ? value.map(asObject) : []
}

function errorOf(result: Result) {
  const error = asObject(result.json).error
  return typeof error === 'string' ? error : ''
}

async function api(jar: Jar, name: string, path: string, method: string, expected: number, json?: unknown) {
  const result = await request(path, { jar, method, json })
  const error = errorOf(result)
  check(name, result.status === expected, `${result.status}${error ? `: ${error}` : ''}`)
  return result
}

async function page(name: string, path: string, expected: number, options: { jar?: Jar; contains?: string } = {}) {
  const result = await request(path, { jar: options.jar, follow: true })
  const hops = result.hops.length > 0 ? ` via ${result.hops.join(',')}` : ''
  const statusOk = result.status === expected
  const textOk = options.contains === undefined || result.text.includes(options.contains)
  const missing = statusOk && !textOk ? `, body lacks "${options.contains}"` : ''
  check(name, statusOk && textOk, `${result.status}${hops}${missing}`)
  return result
}

// ---- fixtures ----

function phoenixDate(offsetDays: number) {
  const date = new Date(Date.now() - 7 * 60 * 60 * 1000 + offsetDays * 24 * 60 * 60 * 1000)
  return date.toISOString().slice(0, 10)
}

function nineHoleCard(scores: number[]) {
  return scores.map((grossScore, index) => ({ holeNumber: index + 1, grossScore }))
}

const PLAYER1_SCORES = nineHoleCard([4, 5, 4, 3, 5, 4, 4, 5, 4])
const PLAYER2_SCORES = nineHoleCard([5, 4, 4, 4, 5, 3, 5, 4, 5])

// Row deletes in FK order, not TRUNCATE ... CASCADE: Commissioner references Player, so a cascade would also wipe
// the seeded login. Seeded courses and the commissioner are kept.
async function resetLeagueData() {
  await prisma.$transaction([
    prisma.commissioner.updateMany({ data: { publicRosterEnabled: false, defaultTrailingPlayerId: null } }),
    prisma.auditLog.deleteMany(),
    prisma.holeScore.deleteMany(),
    prisma.handicapRecord.deleteMany(),
    prisma.attendance.deleteMany(),
    prisma.match.deleteMany(),
    prisma.week.deleteMany(),
    prisma.playerSeasonTee.deleteMany(),
    prisma.season.deleteMany(),
    prisma.player.deleteMany(),
    prisma.course.deleteMany({ where: { name: { startsWith: THROWAWAY_PREFIX } } })
  ])
}

// ---- the run ----

async function signedOutChecks() {
  console.log('== signed out')
  // The proxy sends signed-out users to /api/auth/signin?callbackUrl=...; the (app) layout's own fallback goes to
  // /login. Asserting the former proves Next 16 discovered and ran proxy.ts.
  for (const path of ['/week', '/standings', '/history/x/compare']) {
    const result = await request(path)
    const target = result.location ? new URL(result.location, BASE) : null
    const callbackUrl = target?.searchParams.get('callbackUrl') ?? ''
    check(
      `GET ${path} is redirected to sign-in by proxy.ts`,
      result.status === 307 && target?.pathname === '/api/auth/signin' && callbackUrl.endsWith(path),
      `${result.status} -> ${target ? `${target.pathname}?callbackUrl=${callbackUrl}` : 'none'}`
    )
  }
  checkStatus('GET /api/players without session is 401', 401, (await request('/api/players')).status)
  checkStatus(
    'GET /api/players with a malformed Bearer token is 401',
    401,
    (await request('/api/players', { headers: { authorization: 'Bearer not-a-token' } })).status
  )
  checkStatus(
    'GET /api/players with a garbage session cookie is 401',
    401,
    (await request('/api/players', { headers: { cookie: 'next-auth.session-token=garbage' } })).status
  )
  checkStatus('POST /api/seasons without session is 401', 401, (await request('/api/seasons', { method: 'POST', json: {} })).status)
  checkStatus('PUT /api/courses/[id] without session is 401', 401, (await request('/api/courses/x', { method: 'PUT', json: {} })).status)
  await page('GET /login', '/login', 200)
  await page('GET /public/standings', '/public/standings', 200)
  await page('GET /public/schedule', '/public/schedule', 200)
}

async function signIn() {
  console.log('== sign in')
  const badJar: Jar = new Map()
  const badCsrf = await request('/api/auth/csrf', { jar: badJar })
  const badToken = String(asObject(badCsrf.json).csrfToken ?? '')
  const bad = await request('/api/auth/callback/credentials', {
    jar: badJar,
    method: 'POST',
    form: { csrfToken: badToken, username: 'commissioner', password: 'wrong-password', json: 'true' }
  })
  check('wrong password is rejected', bad.status === 401 && !badJar.has('next-auth.session-token'), String(bad.status))

  const jar: Jar = new Map()
  const csrf = await request('/api/auth/csrf', { jar })
  const csrfToken = need(asObject(csrf.json).csrfToken as string | undefined, 'GET /api/auth/csrf returned no csrfToken')
  await request('/api/auth/callback/credentials', {
    jar,
    method: 'POST',
    form: { csrfToken, username: 'commissioner', password: 'changeme', json: 'true' }
  })
  const session = await request('/api/auth/session', { jar })
  const user = asObject(asObject(session.json).user)
  check('seeded commissioner signs in', user.name === 'commissioner', `user.name=${String(user.name)}`)
  if (user.name !== 'commissioner') {
    throw new SetupError('could not sign in as the seeded commissioner (did `npm run db:seed` run?)')
  }
  await page('GET /week when signed in', '/week', 200, { jar })
  return jar
}

async function proveSameDatabase(jar: Jar) {
  const sentinelName = `${THROWAWAY_PREFIX} sentinel ${Date.now()}`
  const sentinel = await prisma.course.create({
    data: { name: sentinelName, nineHolePar: 36, nineHoleRating: 36, nineHoleSlope: 113 }
  })
  try {
    const courses = asArray((await request('/api/courses', { jar })).json)
    const seen = courses.some((course) => course.id === sentinel.id)
    check('server and script share DATABASE_URL (sentinel visible via API)', seen)
    if (!seen) {
      throw new SetupError('the server is not using the guarded DATABASE_URL; refusing to write through its API')
    }
  } finally {
    await prisma.course.delete({ where: { id: sentinel.id } })
  }
}

async function courseCrud(jar: Jar) {
  console.log('== courses/[id]')
  const holes = Array.from({ length: 9 }, (_, index) => ({
    holeNumber: index + 1,
    par: index === 3 ? 3 : 4,
    strokeIndex: index + 1,
    womenStrokeIndex: index + 1
  }))
  const created = await api(jar, 'POST /api/courses (throwaway)', '/api/courses', 'POST', 201, {
    name: `${THROWAWAY_PREFIX} Course`,
    nineHolePar: 35,
    nineHoleRating: 34,
    nineHoleSlope: 113,
    tees: [{ color: 'white', gender: 'man', nineHolePar: 35, nineHoleRating: 34, nineHoleSlope: 113 }],
    holes
  })
  const courseId = need(asObject(created.json).id as string | undefined, 'POST /api/courses returned no id')
  const renamed = `${THROWAWAY_PREFIX} Course Renamed`
  const updated = await api(jar, 'PUT /api/courses/[id]', `/api/courses/${courseId}`, 'PUT', 200, {
    name: renamed,
    nineHolePar: 35,
    nineHoleRating: 34.5,
    nineHoleSlope: 115,
    tees: [{ color: 'white', gender: 'man', nineHolePar: 35, nineHoleRating: 34.5, nineHoleSlope: 115 }],
    holes
  })
  check('PUT /api/courses/[id] updated the addressed course', asObject(updated.json).id === courseId && asObject(updated.json).name === renamed)
  await api(jar, 'DELETE /api/courses/[id]', `/api/courses/${courseId}`, 'DELETE', 200)
  check('DELETE /api/courses/[id] removed it', (await prisma.course.findUnique({ where: { id: courseId } })) === null)
}

async function createSeasonAndPlayers(jar: Jar) {
  console.log('== season + players')
  const weekDates = [phoenixDate(0), phoenixDate(7), phoenixDate(14)]
  const seasonResult = await api(jar, 'POST /api/seasons', '/api/seasons', 'POST', 201, {
    name: SEASON_NAME,
    type: 'summer',
    startDate: weekDates[0],
    weekDates
  })
  const season = asObject(seasonResult.json)
  const seasonId = need(season.id as string | undefined, 'POST /api/seasons returned no id')
  const weekId = need(asArray(season.weeks)[0]?.id as string | undefined, 'POST /api/seasons returned no weeks')

  const playerIds: string[] = []
  const playerNames: string[] = []
  for (let index = 1; index <= PLAYER_COUNT; index += 1) {
    const name = `E2E Smoke Player ${index}`
    const result = await request('/api/players', {
      jar,
      method: 'POST',
      json: { name, seedHandicap: index * 2, defaultTeeColor: 'white' }
    })
    const id = asObject(result.json).id
    if (result.status === 201 && typeof id === 'string') {
      playerIds.push(id)
      playerNames.push(name)
    }
  }
  check(`POST /api/players x${PLAYER_COUNT}`, playerIds.length === PLAYER_COUNT, `${playerIds.length} created`)
  if (playerIds.length !== PLAYER_COUNT) {
    throw new SetupError('could not create players')
  }

  console.log('== players/[id]')
  const throwaway = await api(jar, 'POST /api/players (throwaway)', '/api/players', 'POST', 201, {
    name: `${THROWAWAY_PREFIX} Player`,
    defaultTeeColor: 'white'
  })
  const throwawayId = need(asObject(throwaway.json).id as string | undefined, 'POST /api/players returned no id')
  const patched = await api(jar, 'PATCH /api/players/[id]', `/api/players/${throwawayId}`, 'PATCH', 200, {
    name: `${THROWAWAY_PREFIX} Player Renamed`,
    seedHandicap: 12.5
  })
  check(
    'PATCH /api/players/[id] updated the addressed player',
    asObject(patched.json).id === throwawayId && asObject(patched.json).name === `${THROWAWAY_PREFIX} Player Renamed`
  )
  const deleted = await api(jar, 'DELETE /api/players/[id]', `/api/players/${throwawayId}`, 'DELETE', 200)
  check('DELETE /api/players/[id] deleted the addressed player', asObject(deleted.json).id === throwawayId)
  checkStatus('DELETE /api/players/[id] again is 404', 404, (await request(`/api/players/${throwawayId}`, { jar, method: 'DELETE' })).status)

  return { seasonId, weekId, playerIds, playerNames }
}

async function fridayFlow(jar: Jar, weekId: string, playerIds: string[]) {
  console.log('== weeks/[id] setup')
  const courses = asArray((await request('/api/courses', { jar })).json)
  const course = need(
    courses.find((candidate) => candidate.name === 'Oakwood - Palms') ?? courses[0],
    'no seeded course (did `npm run db:seed` run?)'
  )
  const par3Holes = asArray(course.holes)
    .filter((hole) => hole.par === 3)
    .map((hole) => Number(hole.holeNumber))
  const ctpHole = need(par3Holes[0], `course ${String(course.name)} has no par 3`)
  const lpHole = par3Holes[1] ?? ctpHole

  await api(jar, 'PATCH /api/weeks/[id] course + prize holes', `/api/weeks/${weekId}`, 'PATCH', 200, {
    courseId: course.id,
    ctpHoleNumber: ctpHole,
    longestPuttHoleNumber: lpHole
  })
  await api(jar, 'PATCH /api/weeks/[id] rejects a non-par-3 CTP hole', `/api/weeks/${weekId}`, 'PATCH', 400, {
    ctpHoleNumber: asArray(course.holes).map((hole) => Number(hole.holeNumber)).find((n) => !par3Holes.includes(n))
  })
  await api(jar, 'POST /api/weeks/[id]/start', `/api/weeks/${weekId}/start`, 'POST', 200)
  const current = await request('/api/weeks?current=true', { jar })
  check('started week is the current week', asObject(current.json).id === weekId)

  let checkedIn = 0
  for (const playerId of playerIds) {
    const result = await request(`/api/weeks/${weekId}/attendance`, { jar, method: 'POST', json: { playerId, present: true } })
    if (result.status === 200) {
      checkedIn += 1
    }
  }
  check(`POST /api/weeks/[id]/attendance x${playerIds.length}`, checkedIn === playerIds.length, `${checkedIn} checked in`)

  console.log('== pairings')
  let generated = 0
  let lastError = ''
  for (let attempt = 0; attempt < playerIds.length; attempt += 1) {
    const result = await request(`/api/weeks/${weekId}/pairings`, { jar, method: 'POST', json: {} })
    if (result.status !== 200) {
      lastError = errorOf(result)
      break
    }
    generated += Number(asObject(result.json).matchesCreated ?? 0)
  }
  check('POST /api/weeks/[id]/pairings fills the week', generated === playerIds.length / 2, `${generated} matches`)
  check('POST /api/weeks/[id]/pairings stops when everyone is paired', /Need at least 2 unmatched/.test(lastError), lastError)

  const matchesBefore = await prisma.match.findMany({ where: { weekId }, orderBy: { createdAt: 'asc' } })
  const firstMatch = need(matchesBefore[0], 'no matches were created')

  console.log('== pairings/[matchId]')
  await api(jar, 'PATCH /api/weeks/[id]/pairings/[matchId] tee override', `/api/weeks/${weekId}/pairings/${firstMatch.id}`, 'PATCH', 200, {
    player1TeeOverrideColor: 'yellow'
  })
  const overridden = await prisma.match.findUnique({ where: { id: firstMatch.id } })
  check('PATCH /api/weeks/[id]/pairings/[matchId] changed the addressed match', overridden?.player1TeeOverrideColor === 'yellow')
  await api(jar, 'PATCH /api/weeks/[id]/pairings/[matchId] clears override', `/api/weeks/${weekId}/pairings/${firstMatch.id}`, 'PATCH', 200, {
    player1TeeOverrideColor: null
  })
  checkStatus(
    'PATCH /api/weeks/[id]/pairings/[matchId] with a foreign week is 404',
    404,
    (await request(`/api/weeks/not-a-week/pairings/${firstMatch.id}`, { jar, method: 'PATCH', json: { player1TeeOverrideColor: null } })).status
  )
  await api(jar, 'DELETE /api/weeks/[id]/pairings/[matchId]', `/api/weeks/${weekId}/pairings/${firstMatch.id}`, 'DELETE', 200)
  check('DELETE removed the addressed match', (await prisma.match.findUnique({ where: { id: firstMatch.id } })) === null)

  console.log('== pairings/manual')
  const manual = await api(jar, 'POST /api/weeks/[id]/pairings/manual', `/api/weeks/${weekId}/pairings/manual`, 'POST', 200, {
    player1Id: firstMatch.player1Id,
    player2Id: firstMatch.player2Id
  })
  check('manual pairing returned a match id', typeof asObject(manual.json).matchId === 'string')

  console.log('== pairings/lock')
  await api(jar, 'POST /api/weeks/[id]/pairings/lock', `/api/weeks/${weekId}/pairings/lock`, 'POST', 200)
  await api(jar, 'DELETE /api/weeks/[id]/pairings/lock (unlock)', `/api/weeks/${weekId}/pairings/lock`, 'DELETE', 200)
  check('unlock cleared the week lock', (await prisma.week.findUnique({ where: { id: weekId } }))?.locked === false)
  await api(jar, 'POST /api/weeks/[id]/pairings/lock (relock)', `/api/weeks/${weekId}/pairings/lock`, 'POST', 200)

  const matches = await prisma.match.findMany({
    where: { weekId },
    include: { player1: { select: { name: true } } },
    orderBy: { createdAt: 'asc' }
  })
  check('week has one match per pair of players', matches.length === playerIds.length / 2, `${matches.length} matches`)
  return matches
}

async function scoreAndClose(jar: Jar, weekId: string, matches: Array<{ id: string; player1: { name: string } }>) {
  console.log('== match pages before results')
  for (const [index, match] of matches.entries()) {
    await page(`GET /week/matches/[matchId] #${index + 1}`, `/week/matches/${match.id}`, 200, { jar, contains: match.player1.name })
    await page(`GET /public/weeks/[id]/matches/[matchId] #${index + 1} hidden before close`, `/public/weeks/${weekId}/matches/${match.id}`, 404)
  }

  // Value: protects=the score page's returnTo wiring (array value, rejected value, kept value) as rendered by
  //   `next start`; fails_when=the page stops routing returnTo through getSafeReturnPath or the array type crashes it;
  //   why_new=lib/__tests__/return-path.test.ts covers the helper, not the page; seam=none;
  //   no_claim=client-side router.push after saving (no browser here)
  console.log('== match page returnTo')
  const matchPath = `/week/matches/${matches[0].id}`
  const backHref = (html: string) => /href="([^"]*)"[^>]*>Back to /.exec(html)?.[1] ?? ''
  const kept = await page('GET /week/matches/[matchId] keeps an allowed returnTo', `${matchPath}?returnTo=%2Fhistory%2Fx%2Fcompare`, 200, { jar })
  check('allowed returnTo becomes the back link', backHref(kept.text) === '/history/x/compare', backHref(kept.text))
  const rejected = await page('GET /week/matches/[matchId] with an off-site returnTo', `${matchPath}?returnTo=%2F%2Fexample.com`, 200, { jar })
  check('off-site returnTo falls back to /week', backHref(rejected.text) === '/week', backHref(rejected.text))
  const repeated = await page('GET /week/matches/[matchId] with a repeated returnTo', `${matchPath}?returnTo=%2Fhistory&returnTo=%2Fweek`, 200, { jar })
  check('repeated returnTo falls back to /week', backHref(repeated.text) === '/week', backHref(repeated.text))

  console.log('== scores')
  const scoresBody = { player1Scores: PLAYER1_SCORES, player2Scores: PLAYER2_SCORES }
  for (const [index, match] of matches.entries()) {
    await api(jar, `POST /api/weeks/[id]/matches/[matchId]/scores #${index + 1}`, `/api/weeks/${weekId}/matches/${match.id}/scores`, 'POST', 200, scoresBody)
  }
  const first = matches[0]
  const scoresPath = `/api/weeks/${weekId}/matches/${first.id}/scores`
  const read = await api(jar, 'GET /api/weeks/[id]/matches/[matchId]/scores', scoresPath, 'GET', 200)
  check('GET scores returns the addressed match', asObject(asObject(read.json).match).id === first.id)
  checkStatus(
    'GET scores with a foreign week is 404',
    404,
    (await request(`/api/weeks/not-a-week/matches/${first.id}/scores`, { jar })).status
  )
  await api(jar, 'DELETE /api/weeks/[id]/matches/[matchId]/scores', scoresPath, 'DELETE', 200)
  check('DELETE cleared that match\'s hole scores', (await prisma.holeScore.count({ where: { matchId: first.id } })) === 0)
  await api(jar, 'POST /api/weeks/[id]/close refuses while scores are missing', `/api/weeks/${weekId}/close`, 'POST', 409)
  await api(jar, 'POST scores again after DELETE', scoresPath, 'POST', 200, scoresBody)

  console.log('== close')
  await api(jar, 'POST /api/weeks/[id]/close', `/api/weeks/${weekId}/close`, 'POST', 200)
}

async function readPaths(jar: Jar, seasonId: string, weekId: string, playerIds: string[], playerNames: string[], matchIds: string[]) {
  console.log('== read paths after close')
  const standings = await api(jar, 'GET /api/standings', `/api/standings?seasonId=${seasonId}`, 'GET', 200)
  const rows = asArray(standings.json)
  check(
    'standings rank every player with points',
    rows.length === playerIds.length && rows.every((row) => typeof row.totalPoints === 'number') && rows.some((row) => Number(row.totalPoints) > 0),
    `${rows.length} rows`
  )

  for (const path of ['/week', '/standings', '/roster', '/history', '/week/check-in-sheet']) {
    await page(`GET ${path}`, path, 200, { jar })
  }
  await page('GET /week/check-in-sheet?week=[id]', `/week/check-in-sheet?week=${weekId}`, 200, { jar, contains: SEASON_NAME })
  await page('GET /history/[weekId]/compare', `/history/${weekId}/compare`, 200, { jar, contains: playerNames[0] })
  for (const path of ['/public/week', '/public/standings', '/public/roster', '/public/schedule']) {
    await page(`GET ${path}`, path, 200, { jar })
  }
  await page('GET /public/schedule?season=[id]', `/public/schedule?season=${seasonId}`, 200, { contains: SEASON_NAME })

  const weekRedirect = await request(`/public/weeks/${weekId}`)
  check('GET /public/weeks/[id] redirects to the date slug', weekRedirect.status === 308 && Boolean(weekRedirect.location), `${weekRedirect.status} -> ${weekRedirect.location}`)
  await page('GET /public/weeks/[id] (followed)', `/public/weeks/${weekId}`, 200, { contains: playerNames[0] })
  await page('GET /public/weeks/[id]/print (followed)', `/public/weeks/${weekId}/print`, 200, { contains: playerNames[0] })
  await page('GET /public/weeks/[id] unknown week is 404', '/public/weeks/not-a-week', 404)

  for (const [index, matchId] of matchIds.entries()) {
    await page(`GET /public/weeks/[id]/matches/[matchId] #${index + 1} after close`, `/public/weeks/${weekId}/matches/${matchId}`, 200)
  }

  await page('GET /public/roster/[id] is 404 while the roster is private', `/public/roster/${playerIds[0]}`, 404)
  await prisma.commissioner.updateMany({ data: { publicRosterEnabled: true } })
  await page('GET /public/roster/[id] when the roster is public', `/public/roster/${playerIds[0]}`, 200, { contains: playerNames[0] })
  await page('GET /public/roster/[id] unknown player is 404', '/public/roster/not-a-player', 404)
}

async function seasonCrud(jar: Jar) {
  console.log('== seasons/[id]')
  const dates = [phoenixDate(70), phoenixDate(77)]
  const created = await api(jar, 'POST /api/seasons (throwaway)', '/api/seasons', 'POST', 201, {
    name: `${THROWAWAY_PREFIX} Season`,
    type: 'spring',
    startDate: dates[0],
    weekDates: dates
  })
  const seasonId = need(asObject(created.json).id as string | undefined, 'POST /api/seasons returned no id')
  const renamed = `${THROWAWAY_PREFIX} Season Renamed`
  const patched = await api(jar, 'PATCH /api/seasons/[id]', `/api/seasons/${seasonId}`, 'PATCH', 200, { name: renamed })
  check('PATCH /api/seasons/[id] updated the addressed season', asObject(patched.json).id === seasonId && asObject(patched.json).name === renamed)
  await api(jar, 'DELETE /api/seasons/[id]', `/api/seasons/${seasonId}`, 'DELETE', 200)
  checkStatus('DELETE /api/seasons/[id] again is 404', 404, (await request(`/api/seasons/${seasonId}`, { jar, method: 'DELETE' })).status)
}

async function main() {
  const started = Date.now()
  console.log(`e2e-smoke against ${BASE}`)
  await signedOutChecks()
  const jar = await signIn()
  // Prove the server reads the guarded DATABASE_URL before deleting anything in it.
  await proveSameDatabase(jar)
  await resetLeagueData()
  await courseCrud(jar)
  const { seasonId, weekId, playerIds, playerNames } = await createSeasonAndPlayers(jar)
  const matches = await fridayFlow(jar, weekId, playerIds)
  await scoreAndClose(jar, weekId, matches)
  await readPaths(jar, seasonId, weekId, playerIds, playerNames, matches.map((match) => match.id))
  await seasonCrud(jar)
  console.log(`== ${passed} passed, ${failed} failed in ${((Date.now() - started) / 1000).toFixed(1)}s`)
}

main()
  .catch((error) => {
    failed += 1
    const reason = error instanceof SetupError ? error.message : error instanceof Error ? error.stack ?? error.message : String(error)
    console.log(`FAIL setup aborted: ${reason}`)
    console.log(`== ${passed} passed, ${failed} failed (aborted)`)
  })
  .finally(async () => {
    await prisma.$disconnect()
    process.exit(failed > 0 ? 1 : 0)
  })

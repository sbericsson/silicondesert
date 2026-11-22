// Value: protects=proxy.ts gates /week /standings /roster /history behind a valid next-auth JWT and leaves
//   public, login and API paths to their own handling; fails_when=the matcher drops or widens a prefix, or the
//   proxy wrapper stops passing request/event to withAuth or lets missing/forged tokens through;
//   why_new=no test imported middleware.ts or proxy.ts, and the Next 16 rename replaced the re-export with a
//   hand-written wrapper; seam=none; no_claim=that Next 16 discovers proxy.ts at build/run time (unit only, real
//   next-auth and Next matcher; covered manually by the next start smoke run)
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest, type NextFetchEvent } from 'next/server'
import { encode } from 'next-auth/jwt'
import type { NextRequestWithAuth } from 'next-auth/middleware'
import { unstable_doesMiddlewareMatch } from 'next/experimental/testing/server'
import proxy, { config } from '@/proxy'

const SECRET = 'proxy-auth-gate-test-secret'
const ORIGIN = 'http://localhost:3000'
const SESSION_COOKIE = 'next-auth.session-token'

const event = { waitUntil: () => {} } as unknown as NextFetchEvent

function requestFor(path: string, sessionToken?: string) {
  const headers = new Headers()
  if (sessionToken !== undefined) {
    headers.set('cookie', `${SESSION_COOKIE}=${sessionToken}`)
  }
  // Next hands the proxy a plain NextRequest; next-auth only adds `nextauth` after authorizing.
  return new NextRequest(new URL(path, ORIGIN), { headers }) as NextRequestWithAuth
}

function expectSignInRedirect(response: Response | void | null | undefined, path: string) {
  expect(response).toBeInstanceOf(Response)
  const res = response as Response
  expect(res.status).toBe(307)
  const location = new URL(res.headers.get('location') ?? '', ORIGIN)
  expect(location.pathname).toMatch(/^\/(api\/auth\/signin|login)$/)
  expect(location.searchParams.get('callbackUrl')).toBe(path)
}

function expectPassThrough(response: Response | void | null | undefined) {
  if (response) {
    expect(response.status).toBeLessThan(300)
    expect(response.headers.get('location')).toBeNull()
  }
}

describe('proxy matcher', () => {
  it.each([
    '/week',
    '/week/matches/abc',
    '/week/check-in-sheet?week=w1',
    '/standings',
    '/roster',
    '/roster/player-1',
    '/history',
    '/history/week-1/compare'
  ])('runs the auth proxy for commissioner path %s', (path) => {
    expect(unstable_doesMiddlewareMatch({ config, url: `${ORIGIN}${path}` })).toBe(true)
  })

  it.each([
    '/',
    '/login',
    '/public/week',
    '/public/weeks/2026-07-31',
    '/public/roster/player-1',
    '/public/schedule',
    '/api/auth/signin',
    '/api/weeks/w1/close',
    '/weekly-report'
  ])('leaves %s to its own handling', (path) => {
    expect(unstable_doesMiddlewareMatch({ config, url: `${ORIGIN}${path}` })).toBe(false)
  })
})

describe('proxy auth gate', () => {
  beforeAll(() => {
    vi.stubEnv('NEXTAUTH_SECRET', SECRET)
    vi.stubEnv('NEXTAUTH_URL', ORIGIN)
  })

  afterAll(() => {
    vi.unstubAllEnvs()
  })

  it('redirects a request with no session to sign-in and keeps the callback path', async () => {
    const path = '/week/check-in-sheet?week=w1'
    expectSignInRedirect(await proxy(requestFor(path), event), path)
  })

  it('redirects a garbage session cookie to sign-in', async () => {
    expectSignInRedirect(await proxy(requestFor('/standings', 'not-a-jwt'), event), '/standings')
  })

  it('redirects a session token signed with a different secret', async () => {
    const forged = await encode({ token: { sub: 'commissioner-1', name: 'admin' }, secret: 'some-other-secret' })
    expectSignInRedirect(await proxy(requestFor('/roster', forged), event), '/roster')
  })

  it('lets a valid commissioner session through', async () => {
    const token = await encode({ token: { sub: 'commissioner-1', name: 'admin' }, secret: SECRET })
    expectPassThrough(await proxy(requestFor('/history', token), event))
  })
})

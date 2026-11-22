import type { NextFetchEvent } from 'next/server'
import { withAuth, type NextRequestWithAuth } from 'next-auth/middleware'

// Next 16 renamed middleware to proxy and requires a statically visible function
// export, so the old `export { default } from 'next-auth/middleware'` no longer works.
// Calling withAuth(request, event) keeps the exact behaviour of that default export.
export default function proxy(request: NextRequestWithAuth, event: NextFetchEvent) {
  return withAuth(request, event)
}

export const config = {
  matcher: ['/week/:path*', '/standings/:path*', '/roster/:path*', '/history/:path*']
}

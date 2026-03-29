export { default } from 'next-auth/middleware'

export const config = {
  matcher: ['/week/:path*', '/standings/:path*', '/roster/:path*', '/history/:path*']
}

export function getPublicBaseUrl(origin?: string) {
  return (
    process.env.NEXT_PUBLIC_PUBLIC_BASE_URL ||
    process.env.NEXTAUTH_URL ||
    origin ||
    ''
  ).replace(/\/$/, '')
}

export function buildPublicUrl(path: string, origin?: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const baseUrl = getPublicBaseUrl(origin)

  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath
}

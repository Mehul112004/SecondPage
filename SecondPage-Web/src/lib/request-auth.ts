export function bearerToken(header: string | null): string | null {
  return header?.match(/^Bearer ([^\s]+)$/i)?.[1] || null
}

export function mutationOriginAllowed(request: Request): boolean {
  const origin = request.headers.get('origin')
  // Browser cookies still require same-origin CSRF protection. A native request
  // has no Origin and must independently pass verified bearer authentication.
  return origin === new URL(request.url).origin ||
    (origin === null && bearerToken(request.headers.get('authorization')) !== null)
}

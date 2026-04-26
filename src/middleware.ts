import { defineMiddleware } from 'astro:middleware'

const SESSION_COOKIE = 'uwc_marketing_session'
const LOGIN_PATH = '/marketing-admin/login'

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url

  // A7: Add security headers to all responses
  const isAdmin = pathname.startsWith('/marketing-admin') || pathname.startsWith('/api/marketing-admin') || pathname.startsWith('/keystatic')
  const response = isAdmin
    ? await handleAdminAuth(context, next)
    : await next()

  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  if (!pathname.startsWith('/api/') && !pathname.startsWith('/keystatic')) {
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://connect.facebook.net https://www.googletagmanager.com; img-src 'self' https://www.facebook.com data:; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.anthropic.com; frame-ancestors 'none'"
    )
  }

  return response
})

function getAuthEmail(request: Request): string | null {
  // Try header first (injected by CF Access for Workers)
  const header = request.headers.get('cf-access-authenticated-user-email')
  if (header) return header

  // Fallback: decode email from CF_Authorization JWT cookie (CF Pages)
  const cookie = request.headers.get('cookie')
  if (!cookie) return null
  const match = cookie.match(/CF_Authorization=([^;]+)/)
  if (!match) return null
  try {
    const payload = JSON.parse(atob(match[1].split('.')[1]))
    return payload.email || null
  } catch {
    return null
  }
}

function getSessionEmail(context: any): boolean {
  const sessionToken = context.cookies.get(SESSION_COOKIE)?.value
  if (!sessionToken) return false
  try {
    const [timestampStr] = sessionToken.split(':')
    const timestamp = parseInt(timestampStr, 10)
    const now = Date.now()
    const twentyFourHours = 24 * 60 * 60 * 1000
    if (!isNaN(timestamp) && now - timestamp < twentyFourHours) {
      return true
    }
    context.cookies.delete(SESSION_COOKIE, { path: '/' })
  } catch {
    context.cookies.delete(SESSION_COOKIE, { path: '/' })
  }
  return false
}

function handleAdminAuth(context: any, next: () => Promise<Response>): Response | Promise<Response> {
  const { pathname } = context.url

  // Skip login page, auth API, and OAuth callback
  if (
    pathname === LOGIN_PATH ||
    pathname === '/api/marketing-admin/auth' ||
    pathname === '/api/marketing-admin/google-callback' ||
    pathname === '/api/marketing-admin/auth-logout'
  ) {
    return next()
  }

  // In local dev, skip auth check (CF Access isn't running locally)
  if (import.meta.env.DEV) {
    return next()
  }

  // Check 1: CF Access header or JWT cookie
  const cfEmail = getAuthEmail(context.request)
  if (cfEmail) return next()

  // Check 2: Google OAuth session cookie
  if (getSessionEmail(context)) return next()

  // Not authenticated — redirect pages, 401 for API
  if (pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return context.redirect(`${LOGIN_PATH}?next=${encodeURIComponent(pathname)}`)
}

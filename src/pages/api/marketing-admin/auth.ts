import type { APIRoute } from 'astro'
import { getEnv } from '../../../lib/env'
import { buildGoogleAuthUrl } from '../../../lib/google-oauth'

const SESSION_COOKIE = 'uwc_marketing_session'
const STATE_COOKIE = 'uwc_marketing_oauth_state'
const RATE_LIMIT_PREFIX = 'login_attempt:'
const MAX_ATTEMPTS = 5
const RATE_LIMIT_WINDOW = 15 * 60

export const POST: APIRoute = async (context) => {
  const { request, cookies, locals, url } = context

  const ip = request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'

  let body: { action?: string; password?: string; next?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Handle logout
  if (body.action === 'logout') {
    cookies.delete(SESSION_COOKIE, { path: '/' })
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const env = getEnv(locals)

  // Handle Google OAuth initiation
  if (body.action === 'google') {
    const clientId = env.GOOGLE_CLIENT_ID
    if (!clientId) {
      return new Response(JSON.stringify({ error: 'Google OAuth not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const siteUrl = env.SITE_URL || url.origin
    const redirectUri = `${siteUrl}/api/marketing-admin/google-callback`
    const nextUrl = body.next || '/marketing-admin/'

    const stateToken = crypto.randomUUID()
    const state = `${stateToken}:${nextUrl}`

    cookies.set(STATE_COOKIE, state, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 10 * 60,
    })

    const authUrl = buildGoogleAuthUrl({ clientId, clientSecret: '', redirectUri }, state)

    return new Response(JSON.stringify({ redirect: authUrl }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Handle password login
  // Rate limiting via KV
  try {
    if (env.RATE_LIMIT) {
      const key = `${RATE_LIMIT_PREFIX}${ip}`
      const attempts = parseInt(await env.RATE_LIMIT.get(key) || '0', 10)
      if (attempts >= MAX_ATTEMPTS) {
        return new Response(JSON.stringify({
          error: 'Too many login attempts. Try again in 15 minutes.'
        }), { status: 429, headers: { 'Content-Type': 'application/json' } })
      }
    }
  } catch {}

  const adminPassword = env.ADMIN_PASSWORD
  if (!adminPassword) {
    return new Response(JSON.stringify({ error: 'Admin password not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!body.password || body.password !== adminPassword) {
    try {
      if (env.RATE_LIMIT) {
        const key = `${RATE_LIMIT_PREFIX}${ip}`
        const attempts = parseInt(await env.RATE_LIMIT.get(key) || '0', 10)
        await env.RATE_LIMIT.put(key, String(attempts + 1), {
          expirationTtl: RATE_LIMIT_WINDOW,
        })
      }
    } catch {}

    return new Response(JSON.stringify({ error: 'Invalid password' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Password correct — create session
  const token = `${Date.now()}:${crypto.randomUUID()}`

  cookies.set(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60,
  })

  // Clear rate limit on success
  try {
    if (env.RATE_LIMIT) {
      await env.RATE_LIMIT.delete(`${RATE_LIMIT_PREFIX}${ip}`)
    }
  } catch {}

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

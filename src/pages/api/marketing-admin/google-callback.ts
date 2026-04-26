import type { APIRoute } from 'astro'
import { getEnv } from '../../../lib/env'
import { exchangeCodeForTokens, getGoogleUserInfo, isEmailAllowed } from '../../../lib/google-oauth'

const SESSION_COOKIE = 'uwc_marketing_session'
const STATE_COOKIE = 'uwc_marketing_oauth_state'
const LOGIN_PATH = '/marketing-admin/login'

export const GET: APIRoute = async ({ url, cookies, locals, redirect }) => {
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (error) {
    return redirect(`${LOGIN_PATH}?error=${encodeURIComponent(error)}`)
  }

  if (!code || !state) {
    return redirect(`${LOGIN_PATH}?error=missing_params`)
  }

  // Validate state to prevent CSRF
  const savedState = cookies.get(STATE_COOKIE)?.value
  cookies.delete(STATE_COOKIE, { path: '/' })

  if (!savedState || savedState !== state) {
    return redirect(`${LOGIN_PATH}?error=invalid_state`)
  }

  // Parse next URL from state (format: random:nextUrl)
  const nextUrl = state.split(':').slice(1).join(':') || '/marketing-admin/'

  const env = getEnv(locals)
  const clientId = env.GOOGLE_CLIENT_ID
  const clientSecret = env.GOOGLE_CLIENT_SECRET
  const allowedEmails = env.ALLOWED_ADMIN_EMAILS

  if (!clientId || !clientSecret) {
    return redirect(`${LOGIN_PATH}?error=oauth_not_configured`)
  }

  const siteUrl = env.SITE_URL || url.origin
  const redirectUri = `${siteUrl}/api/marketing-admin/google-callback`

  try {
    const tokens = await exchangeCodeForTokens(
      { clientId, clientSecret, redirectUri },
      code
    )

    const userInfo = await getGoogleUserInfo(tokens.access_token)

    if (!userInfo.verified_email) {
      return redirect(`${LOGIN_PATH}?error=email_not_verified`)
    }

    if (allowedEmails && !isEmailAllowed(userInfo.email, allowedEmails)) {
      return redirect(`${LOGIN_PATH}?error=not_authorized`)
    }

    // Set session cookie
    const sessionToken = `${Date.now()}:${crypto.randomUUID()}`
    cookies.set(SESSION_COOKIE, sessionToken, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60,
    })

    return redirect(nextUrl)
  } catch (err) {
    console.error('Google OAuth callback error:', err)
    return redirect(`${LOGIN_PATH}?error=auth_failed`)
  }
}

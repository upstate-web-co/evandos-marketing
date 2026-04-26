import { getEnv } from '../../lib/env'
import type { APIContext } from 'astro'
import { Resend } from 'resend'
import { verifyUnsubscribeToken } from '../../lib/unsubscribe-token'

export async function GET({ request, locals }: APIContext) {
  const env = getEnv(locals)
  const db = env.DB
  const url = new URL(request.url)
  const token = url.searchParams.get('token')

  if (!token || !db) {
    return new Response(unsubscribePage('Invalid unsubscribe link.', false), {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
    })
  }

  try {
    const hmacSecret = env.SOCIAL_TOKEN_ENCRYPTION_KEY ?? 'fallback-unsubscribe-secret'
    const email = await verifyUnsubscribeToken(token, hmacSecret)

    if (!email) {
      return new Response(unsubscribePage('Invalid or expired unsubscribe link.', false), {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
      })
    }

    await db.prepare(
      "UPDATE email_subscribers SET status = 'unsubscribed', unsubscribed_at = datetime('now') WHERE email = ? AND status = 'active'"
    ).bind(email).run()

    // Sync unsubscribe to Resend Contacts
    if (env.RESEND_API_KEY) {
      try {
        const resend = new Resend(env.RESEND_API_KEY)
        await resend.contacts.remove({ email })
      } catch (e) {
        console.error('[unsubscribe] Resend contact removal failed:', e)
      }
    }

    return new Response(unsubscribePage("You've been unsubscribed. Sorry to see you go!", true), {
      headers: { 'Content-Type': 'text/html' },
    })
  } catch {
    return new Response(unsubscribePage('Something went wrong. Please try again.', false), {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
    })
  }
}

function unsubscribePage(message: string, success: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Unsubscribe — Upstate Web Co.</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #F7F4EF; color: #1A1814; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { max-width: 400px; text-align: center; padding: 2rem; }
    .icon { font-size: 2rem; margin-bottom: 1rem; }
    h1 { font-size: 1.25rem; margin-bottom: 0.5rem; }
    p { color: rgba(26,24,20,0.6); font-size: 0.875rem; }
    a { color: #B85C38; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? '&#10003;' : '&#10007;'}</div>
    <h1>${message}</h1>
    <p><a href="/">Back to Upstate Web Co.</a></p>
  </div>
</body>
</html>`
}

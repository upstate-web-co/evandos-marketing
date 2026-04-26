/**
 * POST /api/broadcast — send a broadcast email to all active subscribers
 * Body: { subject, body_html, body_text?, schedule_at? }
 *
 * Sends individually via Resend (not Resend Broadcasts API) to maintain
 * per-subscriber unsubscribe links. Processes in batches of 10.
 */

import { getEnv } from '../../lib/env'
import type { APIContext } from 'astro'
import { z } from 'zod'
import { Resend } from 'resend'
import { createUnsubscribeToken } from '../../lib/unsubscribe-token'

const broadcastSchema = z.object({
  subject: z.string().min(1).max(500),
  body_html: z.string().min(1).max(200000),
  body_text: z.string().max(50000).optional(),
  test_email: z.string().email().optional(),
})

export async function POST({ request, locals }: APIContext) {
  try {
    const env = getEnv(locals)
    const db = env.DB
    const resendKey = env.RESEND_API_KEY

    if (!db || !resendKey) {
      return Response.json({ error: 'Not configured', code: 'NOT_CONFIGURED' }, { status: 500 })
    }

    const body = await request.json()
    const result = broadcastSchema.safeParse(body)
    if (!result.success) {
      return Response.json({ error: 'Invalid payload', code: 'VALIDATION_ERROR' }, { status: 400 })
    }

    const { subject, body_html, body_text, test_email } = result.data
    const resend = new Resend(resendKey)
    const siteUrl = env.SITE_URL ?? 'https://upstate-web.com'
    const hmacSecret = env.SOCIAL_TOKEN_ENCRYPTION_KEY ?? 'fallback-unsubscribe-secret'

    // Test mode: send only to test_email
    if (test_email) {
      const token = await createUnsubscribeToken(test_email, hmacSecret)
      const unsubUrl = `${siteUrl}/api/unsubscribe?token=${encodeURIComponent(token)}`
      const html = body_html.replace('{{{UNSUBSCRIBE_URL}}}', unsubUrl)

      await resend.emails.send({
        from: 'Upstate Web Co <hello@upstate-web.com>',
        to: test_email,
        subject: `[TEST] ${subject}`,
        html,
        text: body_text || undefined,
      })

      return Response.json({ ok: true, sent: 1, test: true })
    }

    // Production: send to all active subscribers
    const subscribers = await db.prepare(
      "SELECT email FROM email_subscribers WHERE status = 'active' ORDER BY subscribed_at DESC"
    ).all()

    const emails = (subscribers.results as { email: string }[]) || []
    if (emails.length === 0) {
      return Response.json({ ok: true, sent: 0, message: 'No active subscribers' })
    }

    let sent = 0
    let failed = 0

    // Send in batches of 10
    for (let i = 0; i < emails.length; i += 10) {
      const batch = emails.slice(i, i + 10)
      const promises = batch.map(async (sub) => {
        try {
          const token = await createUnsubscribeToken(sub.email, hmacSecret)
          const unsubUrl = `${siteUrl}/api/unsubscribe?token=${encodeURIComponent(token)}`
          const html = body_html.replace('{{{UNSUBSCRIBE_URL}}}', unsubUrl)

          await resend.emails.send({
            from: 'Upstate Web Co <hello@upstate-web.com>',
            to: sub.email,
            subject,
            html,
            text: body_text || undefined,
          })
          sent++
        } catch (e) {
          console.error(`[broadcast] Failed to send to ${sub.email}:`, e)
          failed++
        }
      })
      await Promise.all(promises)
    }

    return Response.json({ ok: true, sent, failed, total: emails.length })
  } catch (err) {
    console.error('[broadcast] Error:', err)
    return Response.json({ error: 'Broadcast failed', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

import { getEnv } from '../../lib/env'
import type { APIContext } from 'astro'
import { z } from 'zod'
import { Resend } from 'resend'
import { sendWelcomeEmail, sendLeadMagnetEmail } from '../../lib/email'
import { createUnsubscribeToken } from '../../lib/unsubscribe-token'

const subscribeSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().max(200).optional(),
  source: z.enum(['website', 'blog', 'lead-magnet', 'manual']).default('website'),
  industry: z.enum(['retail', 'food-service', 'professional-services', 'personal-care', 'home-services', 'saas', 'other']).optional(),
})

const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW = 3600

export async function POST({ request, locals }: APIContext) {
  try {
    const env = getEnv(locals)
    const db = env.DB

    if (!db) {
      return Response.json({ error: 'Database not configured', code: 'DB_NOT_CONFIGURED' }, { status: 500 })
    }

    // Rate limiting
    const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimitKey = `subscribe:${ip}`

    if (env.RATE_LIMIT) {
      const current = await env.RATE_LIMIT.get(rateLimitKey)
      const count = current ? parseInt(current, 10) : 0

      if (count >= RATE_LIMIT_MAX) {
        return Response.json({ error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' }, { status: 429 })
      }

      await env.RATE_LIMIT.put(rateLimitKey, String(count + 1), {
        expirationTtl: RATE_LIMIT_WINDOW,
      })
    }

    const body = await request.json()
    const result = subscribeSchema.safeParse(body)

    if (!result.success) {
      return Response.json({ error: 'Invalid email address', code: 'VALIDATION_ERROR' }, { status: 400 })
    }

    const { email, name, source, industry } = result.data

    // Check for existing subscriber
    const existing = await db.prepare('SELECT id, status FROM email_subscribers WHERE email = ?').bind(email).first()

    if (existing) {
      if (existing.status === 'unsubscribed') {
        // Re-subscribe
        await db.prepare(
          "UPDATE email_subscribers SET status = 'active', source = ?, unsubscribed_at = NULL, subscribed_at = datetime('now') WHERE id = ?"
        ).bind(source, existing.id).run()
      } else {
        return Response.json({ ok: true, message: "You're already subscribed!" })
      }
    } else {
      // Calculate when to send the first nurture email (1 day from now)
      const nextNurture = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().replace('T', ' ').slice(0, 19)
      await db.prepare(
        'INSERT INTO email_subscribers (email, name, source, nurture_step, next_nurture_at, industry) VALUES (?, ?, ?, 0, ?, ?)'
      ).bind(email, name ?? null, source, nextNurture, industry ?? null).run()
    }

    // Send welcome email
    const resendKey = env.RESEND_API_KEY
    if (resendKey) {
      const siteUrl = env.SITE_URL ?? 'https://uwc-marketing-site.pages.dev'
      const hmacSecret = env.SOCIAL_TOKEN_ENCRYPTION_KEY ?? 'fallback-unsubscribe-secret'
      const unsubscribeToken = await createUnsubscribeToken(email, hmacSecret)
      const unsubscribeUrl = `${siteUrl}/api/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`

      if (source === 'lead-magnet') {
        const downloadUrl = `${siteUrl}/checklist`
        await sendLeadMagnetEmail(resendKey, email, downloadUrl, unsubscribeUrl)
      } else {
        await sendWelcomeEmail(resendKey, email, unsubscribeUrl)
      }

      // Sync to Resend Contacts for broadcast capability
      try {
        const resend = new Resend(resendKey)
        await resend.contacts.create({
          email,
          firstName: name ?? '',
          unsubscribed: false,
        })
      } catch (e) {
        console.error('[subscribe] Resend contact sync failed:', e)
      }
    }

    return Response.json({ ok: true, message: 'Subscribed!' })
  } catch (err) {
    console.error('[subscribe] Error:', err)
    return Response.json({ error: 'Something went wrong', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

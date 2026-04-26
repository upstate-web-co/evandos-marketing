import { getEnv } from '../../lib/env'
import type { APIContext } from 'astro'
import { sendNurtureEmail, NURTURE_STEPS } from '../../lib/email'
import { createUnsubscribeToken } from '../../lib/unsubscribe-token'

/**
 * POST /api/nurture-send
 * Called by the cron worker to process due nurture emails.
 * Protected by CRON_SECRET (same as social/cron).
 */
export async function POST({ request, locals }: APIContext) {
  const env = getEnv(locals)

  // Auth: require cron secret
  const cronSecret = request.headers.get('x-cron-secret')
  if (!env.CRON_SECRET || cronSecret !== env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }

  const db = env.DB
  if (!db) {
    return Response.json({ error: 'Database not configured', code: 'DB_NOT_CONFIGURED' }, { status: 500 })
  }

  const resendKey = env.RESEND_API_KEY
  if (!resendKey) {
    return Response.json({ error: 'Email service not configured', code: 'SERVICE_NOT_CONFIGURED' }, { status: 500 })
  }

  const siteUrl = env.SITE_URL ?? 'https://upstate-web.com'
  const hmacSecret = env.SOCIAL_TOKEN_ENCRYPTION_KEY ?? 'fallback-unsubscribe-secret'
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  try {
    // Find subscribers due for next nurture email
    const due = await db.prepare(
      `SELECT id, email, nurture_step, industry FROM email_subscribers
       WHERE status = 'active'
         AND nurture_step < ?
         AND next_nurture_at IS NOT NULL
         AND next_nurture_at <= ?
       ORDER BY next_nurture_at ASC
       LIMIT 20`
    ).bind(NURTURE_STEPS.length, now).all<{
      id: string
      email: string
      nurture_step: number
      industry: string | null
    }>()

    let sent = 0
    let failed = 0

    for (const subscriber of due.results) {
      const nextStep = subscriber.nurture_step + 1
      const stepConfig = NURTURE_STEPS.find(s => s.step === nextStep)

      if (!stepConfig) {
        // Subscriber has completed all nurture steps — clear next_nurture_at
        await db.prepare(
          'UPDATE email_subscribers SET next_nurture_at = NULL WHERE id = ?'
        ).bind(subscriber.id).run()
        continue
      }

      // Generate unsubscribe URL
      const unsubscribeToken = await createUnsubscribeToken(subscriber.email, hmacSecret)
      const unsubscribeUrl = `${siteUrl}/api/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`

      const success = await sendNurtureEmail(
        { apiKey: resendKey, to: subscriber.email, unsubscribeUrl, siteUrl, industry: subscriber.industry },
        nextStep
      )

      if (success) {
        // Calculate next nurture time
        const nextStepConfig = NURTURE_STEPS.find(s => s.step === nextStep + 1)
        let nextNurtureAt: string | null = null

        if (nextStepConfig) {
          const daysDiff = nextStepConfig.delayDays - stepConfig.delayDays
          const nextDate = new Date(Date.now() + daysDiff * 24 * 60 * 60 * 1000)
          nextNurtureAt = nextDate.toISOString().replace('T', ' ').slice(0, 19)
        }

        await db.prepare(
          'UPDATE email_subscribers SET nurture_step = ?, next_nurture_at = ? WHERE id = ?'
        ).bind(nextStep, nextNurtureAt, subscriber.id).run()

        sent++
      } else {
        failed++
      }
    }

    return Response.json({ ok: true, sent, failed, checked: due.results.length })
  } catch (err) {
    console.error('[nurture-send] Error:', err)
    return Response.json({ error: 'Nurture processing failed', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

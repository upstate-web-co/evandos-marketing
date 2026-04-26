import { getEnv } from '../../lib/env'
import type { APIContext } from 'astro'
import { z } from 'zod'
import { sendContactEmail } from '../../lib/email'

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email address'),
  business: z.string().max(200).optional().default(''),
  message: z.string().min(10, 'Message must be at least 10 characters').max(5000),
})

const RATE_LIMIT_MAX = 3
const RATE_LIMIT_WINDOW = 3600 // 1 hour in seconds

export async function POST({ request, locals }: APIContext) {
  try {
    const env = getEnv(locals)

    // Rate limiting via KV
    const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimitKey = `contact:${ip}`

    if (env.RATE_LIMIT) {
      const current = await env.RATE_LIMIT.get(rateLimitKey)
      const count = current ? parseInt(current, 10) : 0

      if (count >= RATE_LIMIT_MAX) {
        return new Response(
          JSON.stringify({ error: 'Too many submissions. Please try again later.', code: 'RATE_LIMITED' }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        )
      }

      await env.RATE_LIMIT.put(rateLimitKey, String(count + 1), {
        expirationTtl: RATE_LIMIT_WINDOW,
      })
    }

    // Parse and validate body
    const body = await request.json()
    const result = contactSchema.safeParse(body)

    if (!result.success) {
      return new Response(
        JSON.stringify({ error: 'Validation failed', issues: result.error.issues }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Send email
    const resendKey = env.RESEND_API_KEY
    if (!resendKey) {
      console.error('[contact] RESEND_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'Email service not configured', code: 'SERVICE_NOT_CONFIGURED' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    await sendContactEmail(resendKey, result.data)

    // Store in D1 for tracking/retargeting (best-effort, don't fail the request)
    const db = env.DB
    if (db) {
      try {
        await db.prepare(
          'INSERT INTO contact_submissions (name, email, business, message) VALUES (?, ?, ?, ?)'
        ).bind(
          result.data.name,
          result.data.email,
          result.data.business || null,
          result.data.message
        ).run()
      } catch (dbErr) {
        console.error('[contact] DB storage failed (non-fatal):', dbErr)
      }
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('[contact] Error:', err)
    return new Response(
      JSON.stringify({ error: 'Something went wrong. Please try again.', code: 'INTERNAL_ERROR' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

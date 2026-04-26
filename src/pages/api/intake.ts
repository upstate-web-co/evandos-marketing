import { getEnv } from '../../lib/env'
import type { APIContext } from 'astro'
import { z } from 'zod'
import { sendLeadConfirmationEmail, sendLeadNotificationEmail } from '../../lib/email'
import { callClaude } from '../../lib/ai'

const IntakeSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  phone: z.string().max(50).optional().default(''),
  business_name: z.string().min(1).max(200),
  business_description: z.string().min(10).max(1000),
  service_area: z.string().max(300).optional().default(''),
  site_type: z.enum(['starter', 'business', 'store', 'app', 'spark', 'unsure']),
  pages_needed: z.array(z.enum(['Home', 'About', 'Services', 'Gallery', 'Testimonials', 'Contact', 'Blog', 'FAQ', 'Booking', 'Store'])).max(10).optional().default([]),
  needs_payments: z.enum(['no', 'one_time', 'recurring', 'unsure']),
  has_existing_site: z.enum(['yes', 'no']),
  existing_site_url: z.string().max(500).optional().default(''),
  project_description: z.string().min(10).max(2000),
  budget_range: z.enum(['under_750', '750_1500', '1500_3500', '3500_plus', 'unsure']),
  timeline: z.enum(['asap', '1_2_weeks', '1_month', '2_3_months', 'no_rush']),
  how_found_us: z.enum(['google', 'social', 'referral', 'ad', 'other']),
  anything_else: z.string().max(2000).optional().default(''),
  // App-specific fields (only sent when site_type === 'app')
  current_tools: z.string().max(500).optional().default(''),
  user_count: z.enum(['just_me', '2_10', '10_50', '50_plus', 'public', '']).optional().default(''),
  app_payments: z.enum(['stripe', 'no', 'unsure', '']).optional().default(''),
  // Spark-specific fields (only sent when site_type === 'spark')
  spark_idea: z.string().max(500).optional().default(''),
  spark_audience: z.string().max(500).optional().default(''),
  spark_validated: z.enum(['yes_paying', 'yes_interest', 'no', '']).optional().default(''),
  // Anti-spam fields
  website: z.string().max(500).optional().default(''), // honeypot — must be empty
  _loaded_at: z.string().optional().default(''), // timing check
  // UTM tracking
  utm_source: z.string().max(100).optional().default(''),
  utm_medium: z.string().max(100).optional().default(''),
  utm_campaign: z.string().max(100).optional().default(''),
})

const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW = 3600 // 1 hour in seconds

export async function POST({ request, locals }: APIContext) {
  try {
    const env = getEnv(locals)

    // Rate limiting via KV
    const ip = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimitKey = `intake:${ip}`

    if (env.RATE_LIMIT) {
      const current = await env.RATE_LIMIT.get(rateLimitKey)
      const count = current ? parseInt(current, 10) : 0
      if (count >= RATE_LIMIT_MAX) {
        return Response.json(
          { error: 'Too many submissions. Please try again later.', code: 'RATE_LIMITED' },
          { status: 429 }
        )
      }
      await env.RATE_LIMIT.put(rateLimitKey, String(count + 1), { expirationTtl: RATE_LIMIT_WINDOW })
    }

    // Parse and validate body
    const body = await request.json()
    const result = IntakeSchema.safeParse(body)

    if (!result.success) {
      return Response.json(
        { error: 'Validation failed', issues: result.error.issues },
        { status: 400 }
      )
    }

    const data = result.data

    // Honeypot check — bots fill hidden fields
    if (data.website) {
      return Response.json({ ok: true }, { status: 200 }) // silent accept
    }

    // Timing check — reject if submitted in under 3 seconds
    if (data._loaded_at) {
      const loadedAt = parseInt(data._loaded_at, 10)
      if (!isNaN(loadedAt) && Date.now() - loadedAt < 3000) {
        return Response.json({ ok: true }, { status: 200 }) // silent accept
      }
    }

    if (!env.DB) {
      console.error('[intake] DB not configured')
      return Response.json(
        { error: 'Service not configured', code: 'SERVICE_NOT_CONFIGURED' },
        { status: 500 }
      )
    }

    // Duplicate email check (same email in last 24h)
    const existing = await env.DB.prepare(
      "SELECT id FROM leads WHERE email = ? AND created_at > datetime('now', '-1 day')"
    ).bind(data.email.toLowerCase()).first()

    if (existing) {
      return Response.json(
        { ok: true, message: "We already have your inquiry — we'll be in touch soon!" },
        { status: 200 }
      )
    }

    // Insert lead into D1
    const isApp = data.site_type === 'app'
    const isSpark = data.site_type === 'spark'

    const lead = await env.DB.prepare(
      `INSERT INTO leads (name, email, phone, business_name, business_description, service_area,
        site_type, pages_needed_json, needs_payments, has_existing_site, existing_site_url,
        project_description, budget_range, timeline, how_found_us, anything_else, source_page,
        current_tools, user_count, spark_idea, spark_audience, spark_validated,
        utm_source, utm_medium, utm_campaign)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
    ).bind(
      data.name,
      data.email.toLowerCase(),
      data.phone || null,
      data.business_name,
      data.business_description,
      data.service_area || null,
      data.site_type,
      JSON.stringify(data.pages_needed || []),
      isApp && data.app_payments ? data.app_payments : (data.needs_payments || 'unsure'),
      data.has_existing_site || 'no',
      data.existing_site_url || null,
      data.project_description,
      data.budget_range,
      data.timeline,
      data.how_found_us,
      data.anything_else || null,
      '/get-started',
      data.current_tools || null,
      data.user_count || null,
      isSpark ? (data.spark_idea || null) : null,
      isSpark ? (data.spark_audience || null) : null,
      isSpark ? (data.spark_validated || null) : null,
      data.utm_source || null,
      data.utm_medium || null,
      data.utm_campaign || null,
    ).first<{ id: string }>()

    // Send emails (fire-and-forget — don't fail the request)
    const resendKey = env.RESEND_API_KEY
    if (resendKey && lead) {
      const emailData = {
        id: lead.id,
        name: data.name,
        email: data.email,
        business_name: data.business_name,
        site_type: data.site_type,
        budget_range: data.budget_range,
        timeline: data.timeline,
        project_description: data.project_description,
      }
      try { await sendLeadConfirmationEmail(resendKey, emailData) } catch (e) { console.error('[intake] Confirmation email error:', e) }
      try { await sendLeadNotificationEmail(resendKey, emailData) } catch (e) { console.error('[intake] Notification email error:', e) }
    }

    // Auto-score lead via AI (fire-and-forget — don't block response)
    if (env.ANTHROPIC_API_KEY && lead) {
      try {
        const scorePrompt = [
          `Business: ${data.business_name}`,
          `Description: ${data.business_description}`,
          data.service_area ? `Service area: ${data.service_area}` : '',
          `Site type requested: ${data.site_type}`,
          `Pages needed: ${JSON.stringify(data.pages_needed)}`,
          `Needs payments: ${data.needs_payments}`,
          `Has existing site: ${data.has_existing_site}${data.existing_site_url ? ` (${data.existing_site_url})` : ''}`,
          `Project description: ${data.project_description}`,
          `Budget range: ${data.budget_range}`,
          `Timeline: ${data.timeline}`,
          `How they found us: ${data.how_found_us}`,
          data.current_tools ? `Current tools: ${data.current_tools}` : '',
          data.user_count ? `Expected users: ${data.user_count}` : '',
          data.spark_idea ? `Spark idea: ${data.spark_idea}` : '',
          data.spark_audience ? `Target audience: ${data.spark_audience}` : '',
          data.spark_validated ? `Validated: ${data.spark_validated}` : '',
          data.anything_else ? `Additional notes: ${data.anything_else}` : '',
        ].filter(Boolean).join('\n')

        const LEAD_SCORING_PROMPT = `You are a lead qualification analyst for Upstate Web Co, a web design and app development agency in Greenville, SC.

Tiers:
- Starter ($750-1,200): 1-page presence site, contact form, GBP setup
- Business ($1,800-3,500): 5-7 pages, CMS, Stripe, blog, SEO
- Store ($3,500-7,500): E-commerce, product catalog, cart/checkout
- Spark ($1,500-5,000): Rapid prototype for creatives with an idea — MVP in 2-4 weeks
- App ($3,500-15,000+): Custom web application — full-featured, production-grade

Determine:
1. SUGGESTED TIER: starter, business, store, spark, or app
2. QUALIFICATION: Hot, Warm, or Cold
3. ESTIMATED VALUE: Dollar range
4. KEY NOTES: 2-3 bullets for the project manager

Be concise — under 200 words. Output as plain text with section headers.`

        const result = await callClaude(env.ANTHROPIC_API_KEY, LEAD_SCORING_PROMPT, scorePrompt, 512)
        const tierMatch = result.match(/SUGGESTED TIER:\s*(starter|business|store|spark|app)/i)
        const suggestedTier = tierMatch ? tierMatch[1].toLowerCase() : null

        // Save score + auto-advance to 'contacted' (scored = contacted)
        await env.DB.prepare(
          "UPDATE leads SET suggested_tier = ?, ai_summary = ?, status = 'contacted', contacted_at = datetime('now') WHERE id = ? AND status = 'new'"
        ).bind(suggestedTier, result, lead.id).run()
      } catch (e) {
        console.error('[intake] Auto-score error:', e)
      }
    }

    return Response.json({ ok: true }, { status: 200 })
  } catch (err) {
    console.error('[intake] Error:', err)
    return Response.json(
      { error: 'Something went wrong. Please try again.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }
}

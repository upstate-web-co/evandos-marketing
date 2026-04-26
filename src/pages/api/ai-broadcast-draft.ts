/**
 * POST /api/ai-broadcast-draft — generate a broadcast email draft
 * Body: { context }
 */

import { getEnv } from '../../lib/env'
import type { APIContext } from 'astro'
import { callClaude } from '../../lib/ai'
import { z } from 'zod'

const schema = z.object({
  context: z.string().min(1).max(2000),
})

export async function POST({ request, locals }: APIContext) {
  try {
    const env = getEnv(locals)
    if (!env.ANTHROPIC_API_KEY) {
      return Response.json({ error: 'AI not configured', code: 'NOT_CONFIGURED' }, { status: 500 })
    }

    const body = await request.json()
    const result = schema.safeParse(body)
    if (!result.success) {
      return Response.json({ error: 'Invalid payload', code: 'VALIDATION_ERROR' }, { status: 400 })
    }

    const system = `You write newsletter/broadcast emails for Upstate Web Co, a web development agency for solopreneurs and small businesses.

Tone: friendly, conversational, useful — like a helpful neighbor who happens to be a web expert. Not salesy. Not corporate.
Length: 3-5 short paragraphs. Under 250 words.
Always include {{{UNSUBSCRIBE_URL}}} as the unsubscribe link at the bottom.
Write the email in simple HTML with inline styles. Use <p> tags. Keep styling minimal.
Sign off as "Joshua — Upstate Web Co".

Return ONLY a JSON object:
- subject: the subject line
- body_html: the HTML email body

Return valid JSON only, no markdown fences.`

    const text = await callClaude(
      env.ANTHROPIC_API_KEY,
      system,
      `Write a broadcast email about: ${result.data.context}`,
      1500
    )

    let parsed: { subject: string; body_html: string }
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = { subject: '', body_html: text }
    }

    return Response.json({ data: parsed })
  } catch (err) {
    console.error('[ai-broadcast-draft] Error:', err)
    return Response.json({ error: 'AI generation failed', code: 'AI_ERROR' }, { status: 500 })
  }
}

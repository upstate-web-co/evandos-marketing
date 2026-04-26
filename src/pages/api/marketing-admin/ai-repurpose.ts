import type { APIContext } from 'astro'
import { callClaude, getApiKey } from '../../../lib/ai'
import { AiRepurposeSchema } from '../../../lib/schemas'
import { getEnv } from '../../../lib/env'

const SYSTEM_PROMPT = `You are a social media content strategist for Upstate Web Co., a web design studio in Greenville, South Carolina.

Your job: take existing content and adapt it for different social media platforms while preserving the core message.

ALWAYS respond in valid JSON with this exact structure:
{
  "facebook": "Facebook version (conversational, 1-3 paragraphs, soft CTA)",
  "instagram": "Instagram version (caption style, emoji-light, 5-10 relevant hashtags at the end)",
  "linkedin": "LinkedIn version (professional but personable, thought leadership angle, 2-3 paragraphs)",
  "gbp": "Google Business Profile version (brief, professional, include service keywords, 2-3 sentences max)"
}

Guidelines:
- Facebook: casual, community-focused, ask a question or invite engagement
- Instagram: visual-first language, brief, hashtags like #GreenvilleSC #WebDesign #SmallBusiness
- LinkedIn: position as expertise/insight, professional tone, no hashtags in body
- GBP: brief and direct, focus on services and location keywords for local SEO`

export async function POST({ request, locals }: APIContext) {
  try {
    const env = getEnv(locals)
    const apiKey = getApiKey(env)

    if (!apiKey) {
      return Response.json({ error: 'ANTHROPIC_API_KEY not configured', code: 'AI_SERVICE_ERROR' }, { status: 200 })
    }

    const body = await request.json()
    const parsed = AiRepurposeSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', issues: parsed.error.issues }, { status: 400 })
    }

    const { content, sourcePlatform } = parsed.data

    const userMessage = [
      `Repurpose this ${sourcePlatform ? sourcePlatform + ' post' : 'content'} for all 4 platforms:`,
      '',
      content,
    ].join('\n')

    const result = await callClaude(apiKey, SYSTEM_PROMPT, userMessage, 2048)

    try {
      const parsed = JSON.parse(result)
      return Response.json({ versions: parsed })
    } catch {
      return Response.json({ error: 'Failed to parse AI response', code: 'AI_SERVICE_ERROR', raw: result }, { status: 500 })
    }
  } catch (err) {
    console.error('[ai-repurpose] Error:', err)
    return Response.json({ error: 'Failed to repurpose content', code: 'AI_SERVICE_ERROR' }, { status: 500 })
  }
}

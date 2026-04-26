import type { APIContext } from 'astro'
import { callClaude, getApiKey } from '../../../lib/ai'
import { AiSubjectLinesSchema } from '../../../lib/schemas'
import { getEnv } from '../../../lib/env'

const SYSTEM_PROMPT = `You are an email marketing specialist for Upstate Web Co., a web design studio in Greenville, South Carolina.

Generate email subject line options for newsletter broadcasts to small business owners in Upstate SC.

ALWAYS respond in valid JSON with this exact structure:
{
  "subject_lines": [
    { "text": "The subject line", "reasoning": "Brief explanation of why this works" }
  ]
}

Guidelines:
- Generate exactly 5 options
- Keep subject lines under 50 characters for mobile preview
- Use curiosity, urgency, or benefit-driven language
- Avoid spam trigger words (free, guarantee, act now)
- Personalize to SC small business owners when possible
- Mix styles: question, number/list, how-to, statement, curiosity gap`

export async function POST({ request, locals }: APIContext) {
  try {
    const env = getEnv(locals)
    const apiKey = getApiKey(env)

    if (!apiKey) {
      return Response.json({ error: 'ANTHROPIC_API_KEY not configured', code: 'AI_SERVICE_ERROR' }, { status: 200 })
    }

    const body = await request.json()
    const parsed = AiSubjectLinesSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', issues: parsed.error.issues }, { status: 400 })
    }

    const { topic } = parsed.data

    const result = await callClaude(apiKey, SYSTEM_PROMPT, `Generate 5 email subject lines for a newsletter about: ${topic}`)

    try {
      const parsed = JSON.parse(result)
      return Response.json(parsed)
    } catch {
      return Response.json({ error: 'Failed to parse AI response', code: 'AI_SERVICE_ERROR', raw: result }, { status: 500 })
    }
  } catch (err) {
    console.error('[ai-subject-lines] Error:', err)
    return Response.json({ error: 'Failed to generate subject lines', code: 'AI_SERVICE_ERROR' }, { status: 500 })
  }
}

import { getEnv } from '../../../lib/env'
import type { APIContext } from 'astro'
import { AiDraftSchema } from '../../../lib/schemas'
import { AI_MODEL } from '../../../lib/ai'

const SYSTEM_PROMPT = `You are a social media copywriter for Upstate Web Co., a web design studio in Greenville, South Carolina.

Your audience: small business owners in Upstate SC (Greenville, Spartanburg, Anderson).
Your tone: friendly, direct, confident — not corporate. Write like a local neighbor who happens to build great websites.
Your goal: drive engagement and inquiries for web design services.

Guidelines:
- Keep posts concise and punchy
- Use natural language, avoid jargon
- Reference local SC context when relevant (Greenville's growth, Main Street businesses, etc.)
- Include a clear call-to-action when appropriate
- For Facebook/LinkedIn: 1-3 short paragraphs
- For Instagram: caption style with relevant hashtags
- For Google Business: brief and professional, include service keywords`

export async function POST({ request, locals }: APIContext) {
  try {
    const env = getEnv(locals)
    const apiKey = env.ANTHROPIC_API_KEY

    if (!apiKey) {
      return Response.json(
        { error: 'ANTHROPIC_API_KEY not configured. Add it as a CF Pages secret.' },
        { status: 200 }
      )
    }

    const body = await request.json()
    const parsed = AiDraftSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', issues: parsed.error.issues }, { status: 400 })
    }

    const { prompt, platform, existingContent } = parsed.data

    const userMessage = buildUserPrompt(prompt, platform, existingContent)

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('[ai-draft] Anthropic error:', errText)
      return Response.json({ error: 'AI service error', code: 'AI_SERVICE_ERROR' }, { status: 502 })
    }

    const data = await response.json()
    const draft = data.content?.[0]?.text ?? ''

    return Response.json({ draft })
  } catch (err) {
    console.error('[ai-draft] Error:', err)
    return Response.json({ error: 'Failed to generate draft', code: 'AI_SERVICE_ERROR' }, { status: 500 })
  }
}

function buildUserPrompt(prompt: string, platform?: string, existingContent?: string): string {
  let message = prompt

  if (platform) {
    message += `\n\nPlatform: ${platform}`
  }

  if (existingContent) {
    message += `\n\nHere's what I have so far — refine or expand on it:\n${existingContent}`
  }

  return message
}

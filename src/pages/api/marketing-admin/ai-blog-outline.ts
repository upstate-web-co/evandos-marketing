import type { APIContext } from 'astro'
import { callClaude, getApiKey } from '../../../lib/ai'
import { AiBlogOutlineSchema } from '../../../lib/schemas'
import { getEnv } from '../../../lib/env'

const SYSTEM_PROMPT = `You are a content strategist for Upstate Web Co., a web design studio in Greenville, South Carolina.

Generate blog post outlines targeting small business owners in Upstate SC who are searching for web design, SEO, and digital marketing information.

ALWAYS respond in valid JSON with this exact structure:
{
  "title": "Blog post title (compelling, includes primary keyword)",
  "slug": "url-friendly-slug",
  "metaDescription": "Meta description (max 155 chars)",
  "targetKeywords": ["keyword1", "keyword2", "keyword3"],
  "sections": [
    { "heading": "H2 heading", "notes": "2-3 sentences on what to cover" }
  ],
  "internalLinks": ["suggested paths to link to, e.g. /services, /contact"],
  "estimatedWordCount": 1200
}

Guidelines:
- Title should be specific to Upstate SC when relevant
- Include 5-7 sections with actionable, helpful content
- Target long-tail local keywords (e.g. "web design Greenville SC" not just "web design")
- Suggest internal links to relevant pages on the site
- Content should position Upstate Web Co. as the local expert`

export async function POST({ request, locals }: APIContext) {
  try {
    const env = getEnv(locals)
    const apiKey = getApiKey(env)

    if (!apiKey) {
      return Response.json({ error: 'ANTHROPIC_API_KEY not configured', code: 'AI_SERVICE_ERROR' }, { status: 200 })
    }

    const body = await request.json()
    const parsed = AiBlogOutlineSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', issues: parsed.error.issues }, { status: 400 })
    }

    const { topic } = parsed.data

    const result = await callClaude(apiKey, SYSTEM_PROMPT, `Create a blog post outline about: ${topic}`, 2048)

    try {
      const parsed = JSON.parse(result)
      return Response.json(parsed)
    } catch {
      return Response.json({ error: 'Failed to parse AI response', code: 'AI_SERVICE_ERROR', raw: result }, { status: 500 })
    }
  } catch (err) {
    console.error('[ai-blog-outline] Error:', err)
    return Response.json({ error: 'Failed to generate outline', code: 'AI_SERVICE_ERROR' }, { status: 500 })
  }
}

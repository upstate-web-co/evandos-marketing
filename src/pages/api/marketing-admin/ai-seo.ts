import type { APIContext } from 'astro'
import { callClaude, getApiKey } from '../../../lib/ai'
import { AiSeoSchema } from '../../../lib/schemas'
import { getEnv } from '../../../lib/env'

const SYSTEM_PROMPT = `You are an SEO specialist for Upstate Web Co., a web design studio in Greenville, South Carolina.

Generate SEO metadata for web pages targeting small business owners in Upstate SC (Greenville, Spartanburg, Anderson).

ALWAYS respond in valid JSON with this exact structure:
{
  "title": "Page title (max 60 characters, include primary keyword + location)",
  "description": "Meta description (max 155 characters, compelling, include call-to-action)",
  "keywords": ["keyword1", "keyword2", "keyword3"]
}

Guidelines:
- Title: include the primary service/topic + "Greenville SC" or "Upstate SC"
- Description: benefit-driven, include a soft CTA like "Get a free quote" or "Learn more"
- Keywords: 5-8 relevant local SEO keywords
- Think like a local business owner searching Google for these services`

export async function POST({ request, locals }: APIContext) {
  try {
    const env = getEnv(locals)
    const apiKey = getApiKey(env)

    if (!apiKey) {
      return Response.json({ error: 'ANTHROPIC_API_KEY not configured', code: 'AI_SERVICE_ERROR' }, { status: 200 })
    }

    const body = await request.json()
    const parsed = AiSeoSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', issues: parsed.error.issues }, { status: 400 })
    }

    const { path, currentTitle, currentDescription } = parsed.data

    const userMessage = [
      `Generate SEO metadata for the page at path: ${path}`,
      currentTitle ? `Current title: ${currentTitle}` : null,
      currentDescription ? `Current description: ${currentDescription}` : null,
      `The site is Upstate Web Co. — custom web design for small businesses in Greenville, Spartanburg, and Anderson SC.`,
      pathContext(path),
    ].filter(Boolean).join('\n')

    const result = await callClaude(apiKey, SYSTEM_PROMPT, userMessage)

    try {
      const parsed = JSON.parse(result)
      return Response.json(parsed)
    } catch {
      return Response.json({ title: '', description: '', keywords: [], raw: result })
    }
  } catch (err) {
    console.error('[ai-seo] Error:', err)
    return Response.json({ error: 'Failed to generate SEO suggestions', code: 'AI_SERVICE_ERROR' }, { status: 500 })
  }
}

function pathContext(path: string): string {
  const contexts: Record<string, string> = {
    '/': 'This is the homepage/landing page. Hero section with pricing tiers ($750-$3500), why-us section, CTA.',
    '/services': 'Services page with 3 project tiers (Starter $750, Business $1800, E-commerce $3500), monthly retainer plans, and 4-step process.',
    '/about': 'About page — studio story, differentiators, team info.',
    '/contact': 'Contact form page for free website quotes.',
    '/work': 'Portfolio/case studies page.',
    '/blog': 'Blog index — web design tips for SC small businesses.',
  }
  return contexts[path] ?? `This is a page at ${path}.`
}

# content_ops.md — Content Calendar & AI Drafting

## AI Draft Worker (src/pages/api/marketing-admin/ai-draft.ts)

```typescript
import type { APIContext } from 'astro'
import { z } from 'zod'

const DraftSchema = z.object({
  platform: z.enum(['facebook', 'instagram', 'linkedin', 'gbp']),
  topic: z.string().min(10),
  tone: z.enum(['professional', 'casual', 'promotional', 'educational']).default('casual'),
  includeHashtags: z.boolean().default(true),
  targetIndustry: z.string().optional(),
})

const PLATFORM_LIMITS = {
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
  gbp: 1500,
}

const PLATFORM_CONTEXT = {
  facebook: 'Facebook Business Page post for a SC Upstate web design agency. Friendly, local, helpful tone. Greenville/Spartanburg audience.',
  instagram: 'Instagram Business post. Visual-first caption. Under 200 words ideally. Include relevant hashtags at end: #GreenvilleSC #UpstateSC #SCSmallBusiness #WebDesign',
  linkedin: 'LinkedIn Company Page post. Professional audience of SC business owners, accountants, realtors. Demonstrate expertise. Can be longer-form (300-500 words).',
  gbp: 'Google Business Profile post. Local business update. Under 1,500 characters. Include a call to action.',
}

export async function POST({ request, locals }: APIContext) {
  const { ANTHROPIC_API_KEY } = locals.runtime.env
  const parsed = DraftSchema.safeParse(await request.json())
  if (!parsed.success) return Response.json({ error: 'Validation failed' }, { status: 400 })

  const { platform, topic, tone, includeHashtags, targetIndustry } = parsed.data

  const prompt = `You are writing a social media post for Upstate Web Co., a web design agency serving Greenville, Spartanburg, and Anderson, SC.

Platform context: ${PLATFORM_CONTEXT[platform]}
Topic to cover: ${topic}
Tone: ${tone}
${targetIndustry ? `Target industry: ${targetIndustry} businesses in the Upstate SC area` : ''}
${includeHashtags && platform === 'instagram' ? 'Include 5-8 relevant hashtags at the end.' : ''}
Character limit: ${PLATFORM_LIMITS[platform]}

Write the post content only. No preamble, no explanations, just the post text.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) return Response.json({ error: 'AI service error' }, { status: 502 })
  const data = await response.json()
  const draft = data.content[0].text

  return Response.json({ draft, characterCount: draft.length, limit: PLATFORM_LIMITS[platform] })
}
```

## Content Calendar Query

```typescript
// Get posts for a date range (for calendar view)
export async function getCalendarPosts(DB: D1Database, startDate: string, endDate: string) {
  return await DB.prepare(`
    SELECT sp.*, cd.title as draft_title
    FROM social_posts sp
    LEFT JOIN content_drafts cd ON cd.id = sp.content_draft_id
    WHERE sp.scheduled_at BETWEEN ? AND ?
      AND sp.status != 'cancelled'
    ORDER BY sp.scheduled_at ASC
  `).bind(startDate, endDate).all()
}
```

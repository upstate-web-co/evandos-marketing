import type { APIContext } from 'astro'
import { callClaude, getApiKey } from '../../../lib/ai'
import { getEnv } from '../../../lib/env'

const SYSTEM_PROMPT = `You are a social media content strategist for Upstate Web Co., a web design studio in Greenville, South Carolina.

Generate a week of social media content suggestions based on the business context and recent posting history.

ALWAYS respond in valid JSON with this exact structure:
{
  "suggestions": [
    {
      "day": "Monday",
      "platform": "facebook",
      "topic": "Short topic description",
      "content_idea": "2-3 sentence content idea with specific angle",
      "best_time": "10:00 AM"
    }
  ]
}

Guidelines:
- Suggest 5-7 posts spread across the week (not every day needs a post)
- Mix platforms: Facebook, Instagram, LinkedIn, Google Business Profile
- Mix content types: tips, behind-the-scenes, client wins, local community, service highlights
- Best times: Facebook 10am-1pm, Instagram 11am-2pm, LinkedIn 8-10am, GBP anytime
- Keep it relevant to Upstate SC small business web design
- If recent posts are provided, avoid repeating similar topics`

export async function POST({ request, locals }: APIContext) {
  try {
    const env = getEnv(locals)
    const apiKey = getApiKey(env)
    const db = env.DB

    if (!apiKey) {
      return Response.json({ error: 'ANTHROPIC_API_KEY not configured', code: 'AI_SERVICE_ERROR' }, { status: 200 })
    }

    // Fetch recent posts for context
    let recentContext = ''
    if (db) {
      try {
        const recent = await db.prepare(
          `SELECT platform, content, posted_at FROM social_posts
           WHERE status = 'posted' AND posted_at >= datetime('now', '-30 days')
           ORDER BY posted_at DESC LIMIT 10`
        ).all()

        if (recent.results?.length) {
          recentContext = '\n\nRecent posts (avoid repeating):\n' +
            recent.results.map((p: any) => `- ${p.platform}: ${p.content.slice(0, 100)}`).join('\n')
        }
      } catch {
        // DB not available, continue without context
      }
    }

    const userMessage = `Suggest a week of social media posts for Upstate Web Co. starting next week.${recentContext}`
    const result = await callClaude(apiKey, SYSTEM_PROMPT, userMessage, 2048)

    try {
      const parsed = JSON.parse(result)
      return Response.json(parsed)
    } catch {
      return Response.json({ error: 'Failed to parse AI response', code: 'AI_SERVICE_ERROR', raw: result }, { status: 500 })
    }
  } catch (err) {
    console.error('[ai-calendar] Error:', err)
    return Response.json({ error: 'Failed to generate suggestions', code: 'AI_SERVICE_ERROR' }, { status: 500 })
  }
}

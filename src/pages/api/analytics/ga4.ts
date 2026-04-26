import { getEnv } from '../../../lib/env'
import type { APIContext } from 'astro'

export async function GET({ request, locals }: APIContext) {
  try {
    const env = getEnv(locals)
    const db = env.DB

    if (!db) {
      return Response.json({ error: 'Database not configured', code: 'DB_NOT_CONFIGURED', data: [] }, { status: 200 })
    }

    const url = new URL(request.url)
    const days = Math.min(parseInt(url.searchParams.get('days') ?? '30'), 90)

    const { results } = await db
      .prepare('SELECT * FROM analytics_daily ORDER BY date DESC LIMIT ?1')
      .bind(days)
      .all()

    return Response.json({ data: results })
  } catch (err) {
    console.error('[analytics/ga4] Error:', err)
    return Response.json({ error: 'Failed to fetch analytics', code: 'FETCH_FAILED' }, { status: 500 })
  }
}

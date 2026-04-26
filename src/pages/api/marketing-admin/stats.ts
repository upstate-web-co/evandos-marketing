import { getEnv } from '../../../lib/env'
import type { APIContext } from 'astro'

export async function GET({ locals }: APIContext) {
  try {
    const env = getEnv(locals)
    const db = env.DB
    if (!db) return Response.json({ error: 'Database not configured', code: 'DB_NOT_CONFIGURED' }, { status: 500 })

    const [postsThisWeek, scheduled, platforms, failedCount, draftsCount] = await Promise.all([
      db.prepare(
        `SELECT COUNT(*) as count FROM social_posts
         WHERE status = 'posted' AND posted_at >= datetime('now', '-7 days')`
      ).first(),
      db.prepare(
        `SELECT COUNT(*) as count FROM social_posts WHERE status = 'scheduled'`
      ).first(),
      db.prepare(
        `SELECT COUNT(DISTINCT platform) as count FROM social_tokens`
      ).first(),
      db.prepare(
        `SELECT COUNT(*) as count FROM social_posts WHERE status = 'failed'`
      ).first(),
      db.prepare(
        `SELECT COUNT(*) as count FROM content_drafts WHERE status = 'draft'`
      ).first(),
    ])

    return Response.json({
      posts_this_week: postsThisWeek?.count ?? 0,
      scheduled: scheduled?.count ?? 0,
      platforms_connected: platforms?.count ?? 0,
      failed: failedCount?.count ?? 0,
      drafts: draftsCount?.count ?? 0,
    })
  } catch (err) {
    console.error('[stats] Error:', err)
    return Response.json({ error: 'Failed to fetch stats', code: 'FETCH_FAILED' }, { status: 500 })
  }
}

import { getEnv } from '../../../lib/env'
import type { APIContext } from 'astro'

export async function GET({ locals }: APIContext) {
  try {
    const env = getEnv(locals)
    const db = env.DB

    if (!db) {
      return Response.json({ error: 'Database not configured', code: 'DB_NOT_CONFIGURED' }, { status: 500 })
    }

    const subscribers = await db.prepare(
      'SELECT id, email, name, source, status, subscribed_at, unsubscribed_at FROM email_subscribers ORDER BY subscribed_at DESC'
    ).all()

    const activeCount = await db.prepare(
      "SELECT COUNT(*) as count FROM email_subscribers WHERE status = 'active'"
    ).first()

    const totalCount = await db.prepare(
      'SELECT COUNT(*) as count FROM email_subscribers'
    ).first()

    return Response.json({
      subscribers: subscribers.results ?? [],
      stats: {
        active: activeCount?.count ?? 0,
        total: totalCount?.count ?? 0,
      },
    })
  } catch (err) {
    console.error('[subscribers] Error:', err)
    return Response.json({ error: 'Failed to load subscribers', code: 'FETCH_FAILED' }, { status: 500 })
  }
}

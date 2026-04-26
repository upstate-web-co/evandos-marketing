import { getEnv } from '../../../lib/env'
import type { APIContext } from 'astro'
import { SchedulePostSchema, CancelPostSchema } from '../../../lib/schemas'

export async function GET({ request, locals }: APIContext) {
  try {
    const env = getEnv(locals)
    const db = env.DB
    if (!db) return Response.json({ error: 'Database not configured', code: 'DB_NOT_CONFIGURED' }, { status: 500 })

    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const days = parseInt(url.searchParams.get('days') ?? '30')

    let query = `
      SELECT sp.*, cd.title as draft_title, cd.body as draft_body
      FROM social_posts sp
      LEFT JOIN content_drafts cd ON cd.id = sp.content_draft_id
    `
    const conditions: string[] = []
    const binds: any[] = []

    if (status) {
      conditions.push(`sp.status = ?${binds.length + 1}`)
      binds.push(status)
    }

    conditions.push(`sp.scheduled_at >= datetime('now', '-${days} days')`)

    if (conditions.length) {
      query += ' WHERE ' + conditions.join(' AND ')
    }

    query += ' ORDER BY sp.scheduled_at ASC LIMIT 100'

    const stmt = binds.length ? db.prepare(query).bind(...binds) : db.prepare(query)
    const { results } = await stmt.all()

    return Response.json({ posts: results })
  } catch (err) {
    console.error('[schedule] GET error:', err)
    return Response.json({ error: 'Failed to fetch scheduled posts', code: 'FETCH_FAILED' }, { status: 500 })
  }
}

export async function POST({ request, locals }: APIContext) {
  try {
    const env = getEnv(locals)
    const db = env.DB
    if (!db) return Response.json({ error: 'Database not configured', code: 'DB_NOT_CONFIGURED' }, { status: 500 })

    const body = await request.json()
    const parsed = SchedulePostSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', issues: parsed.error.issues }, { status: 400 })
    }

    const { content_draft_id, platform, content, scheduled_at, media_r2_key, media_url } = parsed.data

    // C11: Per-platform daily post limit (prevent rate limit bans)
    const MAX_POSTS_PER_PLATFORM_PER_DAY = 10
    const scheduleDate = scheduled_at.split('T')[0]
    const dayCount = await db.prepare(
      `SELECT COUNT(*) as count FROM social_posts
       WHERE platform = ?1 AND scheduled_at >= ?2 AND scheduled_at < date(?2, '+1 day')
       AND status != 'cancelled'`
    ).bind(platform, scheduleDate).first()
    if (dayCount && dayCount.count >= MAX_POSTS_PER_PLATFORM_PER_DAY) {
      return Response.json(
        { error: `Daily limit reached: max ${MAX_POSTS_PER_PLATFORM_PER_DAY} posts per platform per day`, code: 'DAILY_LIMIT_REACHED' },
        { status: 429 }
      )
    }

    // Propagate ai_generated flag from linked draft (C2: AI content disclosure)
    let aiGenerated = 0
    if (content_draft_id) {
      const draft = await db.prepare('SELECT ai_generated FROM content_drafts WHERE id = ?1').bind(content_draft_id).first()
      if (draft?.ai_generated) aiGenerated = 1
    }

    await db
      .prepare(
        `INSERT INTO social_posts (content_draft_id, platform, content, scheduled_at, media_r2_key, media_url, ai_generated, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'scheduled')`
      )
      .bind(content_draft_id || null, platform, content, scheduled_at, media_r2_key || null, media_url || null, aiGenerated)
      .run()

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[schedule] POST error:', err)
    return Response.json({ error: 'Failed to schedule post', code: 'CREATE_FAILED' }, { status: 500 })
  }
}

export async function DELETE({ request, locals }: APIContext) {
  try {
    const env = getEnv(locals)
    const db = env.DB
    if (!db) return Response.json({ error: 'Database not configured', code: 'DB_NOT_CONFIGURED' }, { status: 500 })

    const body = await request.json()
    const parsed = CancelPostSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', issues: parsed.error.issues }, { status: 400 })
    }

    const { id } = parsed.data

    await db
      .prepare("UPDATE social_posts SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?1")
      .bind(id)
      .run()

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[schedule] DELETE error:', err)
    return Response.json({ error: 'Failed to cancel post', code: 'UPDATE_FAILED' }, { status: 500 })
  }
}

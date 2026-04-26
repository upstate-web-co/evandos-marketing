import { getEnv } from '../../../lib/env'
import type { APIContext } from 'astro'
import { CreateDraftSchema, UpdateDraftSchema } from '../../../lib/schemas'

export async function GET({ request, locals }: APIContext) {
  try {
    const env = getEnv(locals)
    const db = env.DB
    if (!db) return Response.json({ error: 'Database not configured', code: 'DB_NOT_CONFIGURED' }, { status: 500 })

    const url = new URL(request.url)
    const status = url.searchParams.get('status')

    let query = 'SELECT * FROM content_drafts'
    const binds: string[] = []

    if (status) {
      query += ' WHERE status = ?1'
      binds.push(status)
    }

    query += ' ORDER BY updated_at DESC LIMIT 50'

    const stmt = binds.length ? db.prepare(query).bind(...binds) : db.prepare(query)
    const { results } = await stmt.all()

    return Response.json({ drafts: results })
  } catch (err) {
    console.error('[drafts] GET error:', err)
    return Response.json({ error: 'Failed to fetch drafts', code: 'FETCH_FAILED' }, { status: 500 })
  }
}

export async function POST({ request, locals }: APIContext) {
  try {
    const env = getEnv(locals)
    const db = env.DB
    if (!db) return Response.json({ error: 'Database not configured', code: 'DB_NOT_CONFIGURED' }, { status: 500 })

    const body = await request.json()
    const parsed = CreateDraftSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', issues: parsed.error.issues }, { status: 400 })
    }

    const { title, body: content, platforms, media_r2_keys } = parsed.data
    const platformsJson = JSON.stringify(platforms)
    const mediaKeysJson = JSON.stringify(media_r2_keys)

    const row = await db
      .prepare(
        `INSERT INTO content_drafts (title, body, platforms_json, media_r2_keys_json, status)
         VALUES (?1, ?2, ?3, ?4, 'draft') RETURNING *`
      )
      .bind(title || null, content, platformsJson, mediaKeysJson)
      .first()

    return Response.json({ ok: true, draft: row })
  } catch (err) {
    console.error('[drafts] POST error:', err)
    return Response.json({ error: 'Failed to create draft', code: 'CREATE_FAILED' }, { status: 500 })
  }
}

export async function PUT({ request, locals }: APIContext) {
  try {
    const env = getEnv(locals)
    const db = env.DB
    if (!db) return Response.json({ error: 'Database not configured', code: 'DB_NOT_CONFIGURED' }, { status: 500 })

    const body = await request.json()
    const parsed = UpdateDraftSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', issues: parsed.error.issues }, { status: 400 })
    }

    const { id, title, body: content, platforms, status } = parsed.data

    await db
      .prepare(
        `UPDATE content_drafts SET
          title = COALESCE(?2, title),
          body = COALESCE(?3, body),
          platforms_json = COALESCE(?4, platforms_json),
          status = COALESCE(?5, status),
          updated_at = datetime('now')
        WHERE id = ?1`
      )
      .bind(id, title ?? null, content ?? null, platforms ? JSON.stringify(platforms) : null, status ?? null)
      .run()

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[drafts] PUT error:', err)
    return Response.json({ error: 'Failed to update draft', code: 'UPDATE_FAILED' }, { status: 500 })
  }
}

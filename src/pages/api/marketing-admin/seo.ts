import { getEnv } from '../../../lib/env'
import type { APIContext } from 'astro'
import { UpsertSeoSchema, DeleteSeoSchema } from '../../../lib/schemas'

export async function GET({ locals }: APIContext) {
  try {
    const env = getEnv(locals)
    const db = env.DB

    if (!db) {
      return Response.json({ error: 'Database not configured', code: 'DB_NOT_CONFIGURED' }, { status: 500 })
    }

    const { results } = await db
      .prepare('SELECT id, path, title, description, og_image_r2_key, schema_json, noindex, updated_at FROM seo_pages ORDER BY path ASC')
      .all()

    return Response.json({ pages: results })
  } catch (err) {
    console.error('[seo] GET error:', err)
    return Response.json({ error: 'Failed to fetch SEO pages', code: 'FETCH_FAILED' }, { status: 500 })
  }
}

export async function POST({ request, locals }: APIContext) {
  try {
    const env = getEnv(locals)
    const db = env.DB

    if (!db) {
      return Response.json({ error: 'Database not configured', code: 'DB_NOT_CONFIGURED' }, { status: 500 })
    }

    const body = await request.json()
    const parsed = UpsertSeoSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', issues: parsed.error.issues }, { status: 400 })
    }

    const { path, title, description, schema_json, noindex } = parsed.data

    await db
      .prepare(
        `INSERT INTO seo_pages (path, title, description, schema_json, noindex, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))
         ON CONFLICT(path) DO UPDATE SET
           title = ?2,
           description = ?3,
           schema_json = ?4,
           noindex = ?5,
           updated_at = datetime('now')`
      )
      .bind(path, title ?? null, description ?? null, schema_json ?? null, noindex ? 1 : 0)
      .run()

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[seo] POST error:', err)
    return Response.json({ error: 'Failed to save SEO page', code: 'CREATE_FAILED' }, { status: 500 })
  }
}

export async function DELETE({ request, locals }: APIContext) {
  try {
    const env = getEnv(locals)
    const db = env.DB

    if (!db) {
      return Response.json({ error: 'Database not configured', code: 'DB_NOT_CONFIGURED' }, { status: 500 })
    }

    const body = await request.json()
    const parsed = DeleteSeoSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', issues: parsed.error.issues }, { status: 400 })
    }

    await db.prepare('DELETE FROM seo_pages WHERE path = ?1').bind(parsed.data.path).run()

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[seo] DELETE error:', err)
    return Response.json({ error: 'Failed to delete SEO page', code: 'DELETE_FAILED' }, { status: 500 })
  }
}

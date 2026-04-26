import { getEnv } from '../../../../lib/env'
import type { APIContext } from 'astro'
import { UpdatePostSchema } from '../../../../lib/schemas'

export async function GET({ params, locals }: APIContext) {
  try {
    const env = getEnv(locals)
    const db = env.DB
    if (!db) return Response.json({ error: 'Database not configured', code: 'DB_NOT_CONFIGURED' }, { status: 500 })

    const { id } = params
    if (!id) return Response.json({ error: 'id is required', code: 'VALIDATION_ERROR' }, { status: 400 })

    const post = await db
      .prepare(
        `SELECT sp.*, cd.title as draft_title, cd.body as draft_body, cd.platforms_json as draft_platforms, cd.media_r2_keys_json
         FROM social_posts sp
         LEFT JOIN content_drafts cd ON cd.id = sp.content_draft_id
         WHERE sp.id = ?1`
      )
      .bind(id)
      .first()

    if (!post) return Response.json({ error: 'Post not found', code: 'NOT_FOUND' }, { status: 404 })

    return Response.json({ post })
  } catch (err) {
    console.error('[post] GET error:', err)
    return Response.json({ error: 'Failed to fetch post', code: 'FETCH_FAILED' }, { status: 500 })
  }
}

export async function PUT({ params, request, locals }: APIContext) {
  try {
    const env = getEnv(locals)
    const db = env.DB
    if (!db) return Response.json({ error: 'Database not configured', code: 'DB_NOT_CONFIGURED' }, { status: 500 })

    const { id } = params
    if (!id) return Response.json({ error: 'id is required', code: 'VALIDATION_ERROR' }, { status: 400 })

    const body = await request.json()
    const parsed = UpdatePostSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', issues: parsed.error.issues }, { status: 400 })
    }

    const { content, scheduled_at, status } = parsed.data

    // C1: Content audit trail — save previous content before overwriting
    if (content !== undefined) {
      const existing = await db.prepare('SELECT content, content_history_json FROM social_posts WHERE id = ?1').bind(id).first()
      if (existing && existing.content !== content) {
        const history = existing.content_history_json ? JSON.parse(existing.content_history_json) : []
        history.push({ content: existing.content, changed_at: new Date().toISOString() })
        await db
          .prepare('UPDATE social_posts SET content_history_json = ?2 WHERE id = ?1')
          .bind(id, JSON.stringify(history))
          .run()
      }
    }

    const updates: string[] = []
    const binds: any[] = [id]
    let bindIndex = 2

    if (content !== undefined) {
      updates.push(`content = ?${bindIndex}`)
      binds.push(content)
      bindIndex++
    }
    if (scheduled_at !== undefined) {
      updates.push(`scheduled_at = ?${bindIndex}`)
      binds.push(scheduled_at)
      bindIndex++
    }
    if (status !== undefined) {
      updates.push(`status = ?${bindIndex}`)
      binds.push(status)
      bindIndex++
    }

    updates.push("updated_at = datetime('now')")

    await db
      .prepare(`UPDATE social_posts SET ${updates.join(', ')} WHERE id = ?1`)
      .bind(...binds)
      .run()

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[post] PUT error:', err)
    return Response.json({ error: 'Failed to update post', code: 'UPDATE_FAILED' }, { status: 500 })
  }
}

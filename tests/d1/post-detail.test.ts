import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDB } from './setup'

let db: any
let sqlite: any

beforeEach(() => {
  const test = createTestDB()
  db = test.db
  sqlite = test.sqlite
})

// Tests the queries used by /api/marketing-admin/post/[id].ts

describe('post detail GET (JOIN with content_drafts)', () => {
  it('returns post with linked draft data', async () => {
    sqlite.exec(
      `INSERT INTO content_drafts (id, title, body, platforms_json, media_r2_keys_json, status)
       VALUES ('cd1', 'Draft Title', 'Draft body text', '["facebook","instagram"]', '["social/2026-03/abc.jpg"]', 'scheduled')`
    )
    sqlite.exec(
      `INSERT INTO social_posts (id, content_draft_id, platform, content, scheduled_at, status)
       VALUES ('sp1', 'cd1', 'facebook', 'Posted version', '2026-04-01T12:00:00Z', 'scheduled')`
    )

    const post = await db.prepare(
      `SELECT sp.*, cd.title as draft_title, cd.body as draft_body, cd.platforms_json as draft_platforms, cd.media_r2_keys_json
       FROM social_posts sp
       LEFT JOIN content_drafts cd ON cd.id = sp.content_draft_id
       WHERE sp.id = ?1`
    ).bind('sp1').first()

    expect(post).not.toBeNull()
    expect(post.id).toBe('sp1')
    expect(post.content).toBe('Posted version')
    expect(post.draft_title).toBe('Draft Title')
    expect(post.draft_body).toBe('Draft body text')
    expect(post.draft_platforms).toBe('["facebook","instagram"]')
    expect(post.media_r2_keys_json).toBe('["social/2026-03/abc.jpg"]')
  })

  it('returns post with null draft fields when no linked draft', async () => {
    sqlite.exec(
      `INSERT INTO social_posts (id, platform, content, scheduled_at, status)
       VALUES ('sp1', 'linkedin', 'Standalone post', '2026-04-01T12:00:00Z', 'scheduled')`
    )

    const post = await db.prepare(
      `SELECT sp.*, cd.title as draft_title, cd.body as draft_body, cd.platforms_json as draft_platforms, cd.media_r2_keys_json
       FROM social_posts sp
       LEFT JOIN content_drafts cd ON cd.id = sp.content_draft_id
       WHERE sp.id = ?1`
    ).bind('sp1').first()

    expect(post).not.toBeNull()
    expect(post.content).toBe('Standalone post')
    expect(post.draft_title).toBeNull()
    expect(post.draft_body).toBeNull()
  })

  it('returns null for nonexistent post ID', async () => {
    const post = await db.prepare(
      `SELECT sp.* FROM social_posts sp WHERE sp.id = ?1`
    ).bind('nonexistent').first()

    expect(post).toBeNull()
  })
})

describe('post detail PUT (dynamic field updates)', () => {
  beforeEach(() => {
    sqlite.exec(
      `INSERT INTO social_posts (id, platform, content, scheduled_at, status)
       VALUES ('sp1', 'facebook', 'Original content', '2026-04-01T12:00:00Z', 'scheduled')`
    )
  })

  it('updates content only', async () => {
    await db.prepare(
      `UPDATE social_posts SET content = ?2, updated_at = datetime('now') WHERE id = ?1`
    ).bind('sp1', 'Updated content').run()

    const row = await db.prepare('SELECT * FROM social_posts WHERE id = ?1').bind('sp1').first()
    expect(row.content).toBe('Updated content')
    expect(row.scheduled_at).toBe('2026-04-01T12:00:00Z') // unchanged
    expect(row.status).toBe('scheduled') // unchanged
  })

  it('updates scheduled_at only (reschedule)', async () => {
    await db.prepare(
      `UPDATE social_posts SET scheduled_at = ?2, updated_at = datetime('now') WHERE id = ?1`
    ).bind('sp1', '2026-05-01T15:00:00Z').run()

    const row = await db.prepare('SELECT * FROM social_posts WHERE id = ?1').bind('sp1').first()
    expect(row.content).toBe('Original content') // unchanged
    expect(row.scheduled_at).toBe('2026-05-01T15:00:00Z')
  })

  it('updates status (retry: failed → scheduled)', async () => {
    // Set to failed first
    sqlite.exec(`UPDATE social_posts SET status = 'failed', error_message = 'API error', retry_count = 1 WHERE id = 'sp1'`)

    await db.prepare(
      `UPDATE social_posts SET status = ?2, updated_at = datetime('now') WHERE id = ?1`
    ).bind('sp1', 'scheduled').run()

    const row = await db.prepare('SELECT * FROM social_posts WHERE id = ?1').bind('sp1').first()
    expect(row.status).toBe('scheduled')
    expect(row.error_message).toBe('API error') // preserved — not cleared
  })

  it('updates multiple fields at once', async () => {
    await db.prepare(
      `UPDATE social_posts SET content = ?2, scheduled_at = ?3, status = ?4, updated_at = datetime('now') WHERE id = ?1`
    ).bind('sp1', 'New content', '2026-06-01T10:00:00Z', 'cancelled').run()

    const row = await db.prepare('SELECT * FROM social_posts WHERE id = ?1').bind('sp1').first()
    expect(row.content).toBe('New content')
    expect(row.scheduled_at).toBe('2026-06-01T10:00:00Z')
    expect(row.status).toBe('cancelled')
  })
})

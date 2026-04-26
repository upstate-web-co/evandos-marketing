import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDB, clearAllTables } from './setup'

let db: any
let sqlite: any

beforeEach(() => {
  const test = createTestDB()
  db = test.db
  sqlite = test.sqlite
})

// These tests verify the D1 query patterns used by src/pages/api/marketing-admin/drafts.ts

describe('content_drafts CRUD', () => {
  it('inserts a draft with auto-generated id and timestamps', async () => {
    await db
      .prepare(
        `INSERT INTO content_drafts (title, body, platforms_json, status)
         VALUES (?1, ?2, ?3, 'draft')`
      )
      .bind('Test Post', 'Hello world content', '["facebook","instagram"]')
      .run()

    const row = await db
      .prepare('SELECT * FROM content_drafts ORDER BY created_at DESC LIMIT 1')
      .first()

    expect(row).not.toBeNull()
    expect(row.id).toBeDefined()
    expect(row.id.length).toBe(32) // hex(randomblob(16))
    expect(row.title).toBe('Test Post')
    expect(row.body).toBe('Hello world content')
    expect(row.platforms_json).toBe('["facebook","instagram"]')
    expect(row.status).toBe('draft')
    expect(row.ai_generated).toBe(0)
    expect(row.created_at).toBeDefined()
  })

  it('allows null title', async () => {
    await db
      .prepare(`INSERT INTO content_drafts (body, status) VALUES (?1, 'draft')`)
      .bind('Content without title')
      .run()

    const row = await db.prepare('SELECT * FROM content_drafts LIMIT 1').first()
    expect(row.title).toBeNull()
    expect(row.body).toBe('Content without title')
  })

  it('updates draft fields with COALESCE pattern', async () => {
    await db
      .prepare(`INSERT INTO content_drafts (id, title, body, status) VALUES ('d1', 'Original', 'Body', 'draft')`)
      .run()

    // Update only title, body stays the same (COALESCE with null)
    await db
      .prepare(
        `UPDATE content_drafts SET
          title = COALESCE(?2, title),
          body = COALESCE(?3, body),
          status = COALESCE(?4, status),
          updated_at = datetime('now')
        WHERE id = ?1`
      )
      .bind('d1', 'New Title', null, null)
      .run()

    const row = await db.prepare('SELECT * FROM content_drafts WHERE id = ?1').bind('d1').first()
    expect(row.title).toBe('New Title')
    expect(row.body).toBe('Body') // unchanged
    expect(row.status).toBe('draft') // unchanged
  })

  it('filters by status', async () => {
    await db.prepare(`INSERT INTO content_drafts (id, body, status) VALUES ('d1', 'A', 'draft')`).run()
    await db.prepare(`INSERT INTO content_drafts (id, body, status) VALUES ('d2', 'B', 'archived')`).run()
    await db.prepare(`INSERT INTO content_drafts (id, body, status) VALUES ('d3', 'C', 'draft')`).run()

    const { results } = await db
      .prepare('SELECT * FROM content_drafts WHERE status = ?1 ORDER BY updated_at DESC LIMIT 50')
      .bind('draft')
      .all()

    expect(results).toHaveLength(2)
    expect(results.every((r: any) => r.status === 'draft')).toBe(true)
  })

  it('stores media_r2_keys_json', async () => {
    const keys = JSON.stringify(['social/2026-03/abc.jpg', 'social/2026-03/def.png'])
    await db
      .prepare(`INSERT INTO content_drafts (id, body, media_r2_keys_json, status) VALUES ('d1', 'With media', ?1, 'draft')`)
      .bind(keys)
      .run()

    const row = await db.prepare('SELECT * FROM content_drafts WHERE id = ?1').bind('d1').first()
    expect(JSON.parse(row.media_r2_keys_json)).toEqual(['social/2026-03/abc.jpg', 'social/2026-03/def.png'])
  })
})

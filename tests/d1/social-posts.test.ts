import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDB } from './setup'

let db: any
let sqlite: any

beforeEach(() => {
  const test = createTestDB()
  db = test.db
  sqlite = test.sqlite
})

// These tests verify D1 query patterns used by schedule.ts, scheduler.ts, and the cron endpoint

describe('social_posts scheduling', () => {
  it('inserts a scheduled post with all fields', async () => {
    await db
      .prepare(
        `INSERT INTO social_posts (id, platform, content, scheduled_at, media_url, status)
         VALUES ('sp1', 'facebook', 'Hello FB!', '2026-04-01T12:00:00Z', 'https://example.com/img.jpg', 'scheduled')`
      )
      .run()

    const row = await db.prepare('SELECT * FROM social_posts WHERE id = ?1').bind('sp1').first()
    expect(row.platform).toBe('facebook')
    expect(row.content).toBe('Hello FB!')
    expect(row.status).toBe('scheduled')
    expect(row.media_url).toBe('https://example.com/img.jpg')
    expect(row.retry_count).toBe(0)
  })

  it('links to content_draft via foreign key', async () => {
    await db.prepare(`INSERT INTO content_drafts (id, body, status) VALUES ('cd1', 'Draft body', 'draft')`).run()
    await db
      .prepare(
        `INSERT INTO social_posts (id, content_draft_id, platform, content, scheduled_at, status)
         VALUES ('sp1', 'cd1', 'instagram', 'Post from draft', '2026-04-01T12:00:00Z', 'scheduled')`
      )
      .run()

    const row = await db.prepare('SELECT * FROM social_posts WHERE id = ?1').bind('sp1').first()
    expect(row.content_draft_id).toBe('cd1')
  })

  it('creates multiple posts for cross-platform scheduling', async () => {
    await db.prepare(`INSERT INTO content_drafts (id, body, status) VALUES ('cd1', 'Same content', 'draft')`).run()

    const platforms = ['facebook', 'instagram', 'linkedin', 'gbp']
    for (const platform of platforms) {
      await db
        .prepare(
          `INSERT INTO social_posts (content_draft_id, platform, content, scheduled_at, status)
           VALUES ('cd1', ?1, 'Same content', '2026-04-01T12:00:00Z', 'scheduled')`
        )
        .bind(platform)
        .run()
    }

    const { results } = await db
      .prepare('SELECT * FROM social_posts WHERE content_draft_id = ?1')
      .bind('cd1')
      .all()

    expect(results).toHaveLength(4)
    expect(results.map((r: any) => r.platform).sort()).toEqual(['facebook', 'gbp', 'instagram', 'linkedin'])
  })
})

describe('social_posts cron queries', () => {
  it('finds due posts (scheduled_at in the past)', async () => {
    // Past: should be picked up
    await db
      .prepare(
        `INSERT INTO social_posts (id, platform, content, scheduled_at, status)
         VALUES ('past', 'facebook', 'Past post', '2020-01-01T00:00:00Z', 'scheduled')`
      )
      .run()

    // Future: should not be picked up
    await db
      .prepare(
        `INSERT INTO social_posts (id, platform, content, scheduled_at, status)
         VALUES ('future', 'facebook', 'Future post', '2099-01-01T00:00:00Z', 'scheduled')`
      )
      .run()

    const { results } = await db
      .prepare(
        `SELECT * FROM social_posts
         WHERE (status = 'scheduled' AND scheduled_at <= datetime('now'))
            OR (status = 'failed' AND retry_count < ?1 AND scheduled_at <= datetime('now'))
         ORDER BY scheduled_at ASC LIMIT 10`
      )
      .bind(3)
      .all()

    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('past')
  })

  it('includes failed posts eligible for retry', async () => {
    await db
      .prepare(
        `INSERT INTO social_posts (id, platform, content, scheduled_at, status, retry_count)
         VALUES ('retryable', 'linkedin', 'Retry me', '2020-01-01T00:00:00Z', 'failed', 1)`
      )
      .run()

    await db
      .prepare(
        `INSERT INTO social_posts (id, platform, content, scheduled_at, status, retry_count)
         VALUES ('maxed-out', 'linkedin', 'Gave up', '2020-01-01T00:00:00Z', 'failed', 3)`
      )
      .run()

    const { results } = await db
      .prepare(
        `SELECT * FROM social_posts
         WHERE (status = 'scheduled' AND scheduled_at <= datetime('now'))
            OR (status = 'failed' AND retry_count < ?1 AND scheduled_at <= datetime('now'))
         ORDER BY scheduled_at ASC LIMIT 10`
      )
      .bind(3)
      .all()

    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('retryable')
  })

  it('updates status to posted with external_id', async () => {
    await db
      .prepare(
        `INSERT INTO social_posts (id, platform, content, scheduled_at, status)
         VALUES ('sp1', 'facebook', 'Posted!', '2020-01-01T00:00:00Z', 'posting')`
      )
      .run()

    await db
      .prepare(
        `UPDATE social_posts SET
          status = 'posted',
          posted_at = datetime('now'),
          external_id = ?2,
          updated_at = datetime('now')
        WHERE id = ?1`
      )
      .bind('sp1', '12345_67890')
      .run()

    const row = await db.prepare('SELECT * FROM social_posts WHERE id = ?1').bind('sp1').first()
    expect(row.status).toBe('posted')
    expect(row.external_id).toBe('12345_67890')
    expect(row.posted_at).toBeDefined()
  })

  it('records error_message and increments retry_count on failure', async () => {
    await db
      .prepare(
        `INSERT INTO social_posts (id, platform, content, scheduled_at, status, retry_count)
         VALUES ('sp1', 'instagram', 'Will fail', '2020-01-01T00:00:00Z', 'posting', 0)`
      )
      .run()

    await db
      .prepare(
        `UPDATE social_posts SET
          status = 'failed',
          error_message = ?2,
          retry_count = ?3,
          updated_at = datetime('now')
        WHERE id = ?1`
      )
      .bind('sp1', 'Instagram requires a media URL', 1)
      .run()

    const row = await db.prepare('SELECT * FROM social_posts WHERE id = ?1').bind('sp1').first()
    expect(row.status).toBe('failed')
    expect(row.error_message).toBe('Instagram requires a media URL')
    expect(row.retry_count).toBe(1)
  })

  it('cancels a post by updating status', async () => {
    await db
      .prepare(
        `INSERT INTO social_posts (id, platform, content, scheduled_at, status)
         VALUES ('sp1', 'gbp', 'Cancel me', '2026-04-01T00:00:00Z', 'scheduled')`
      )
      .run()

    await db
      .prepare("UPDATE social_posts SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?1")
      .bind('sp1')
      .run()

    const row = await db.prepare('SELECT * FROM social_posts WHERE id = ?1').bind('sp1').first()
    expect(row.status).toBe('cancelled')
  })
})

describe('social_posts indexes', () => {
  it('has index on status column', () => {
    const indexes = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='social_posts'")
      .all()
    const names = indexes.map((i: any) => i.name)
    expect(names).toContain('idx_social_posts_status')
  })

  it('has index on scheduled_at column', () => {
    const indexes = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='social_posts'")
      .all()
    const names = indexes.map((i: any) => i.name)
    expect(names).toContain('idx_social_posts_scheduled_at')
  })

  it('has index on platform column', () => {
    const indexes = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='social_posts'")
      .all()
    const names = indexes.map((i: any) => i.name)
    expect(names).toContain('idx_social_posts_platform')
  })

  it('has index on content_draft_id column', () => {
    const indexes = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='social_posts'")
      .all()
    const names = indexes.map((i: any) => i.name)
    expect(names).toContain('idx_social_posts_draft_id')
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDB } from './setup'

let db: any
let sqlite: any

beforeEach(() => {
  const test = createTestDB()
  db = test.db
  sqlite = test.sqlite
})

// Tests the queries used by /api/marketing-admin/schedule.ts GET

describe('schedule GET with JOIN + filtering', () => {
  beforeEach(() => {
    // Seed a draft and some posts across platforms and statuses
    sqlite.exec(`INSERT INTO content_drafts (id, title, body, status) VALUES ('cd1', 'Weekly Update', 'Body text', 'scheduled')`)

    sqlite.exec(
      `INSERT INTO social_posts (id, content_draft_id, platform, content, scheduled_at, status)
       VALUES ('sp1', 'cd1', 'facebook', 'FB version', '2026-04-01T12:00:00Z', 'scheduled')`
    )
    sqlite.exec(
      `INSERT INTO social_posts (id, content_draft_id, platform, content, scheduled_at, status)
       VALUES ('sp2', 'cd1', 'instagram', 'IG version', '2026-04-01T12:00:00Z', 'scheduled')`
    )
    sqlite.exec(
      `INSERT INTO social_posts (id, platform, content, scheduled_at, status, posted_at)
       VALUES ('sp3', 'linkedin', 'LI standalone', datetime('now', '-2 days'), 'posted', datetime('now', '-2 days'))`
    )
    sqlite.exec(
      `INSERT INTO social_posts (id, platform, content, scheduled_at, status, error_message, retry_count)
       VALUES ('sp4', 'gbp', 'GBP failed', datetime('now', '-1 day'), 'failed', 'Token expired', 3)`
    )
  })

  it('returns all posts with draft data via LEFT JOIN', async () => {
    const { results } = await db.prepare(
      `SELECT sp.*, cd.title as draft_title, cd.body as draft_body
       FROM social_posts sp
       LEFT JOIN content_drafts cd ON cd.id = sp.content_draft_id
       ORDER BY sp.scheduled_at ASC LIMIT 100`
    ).all()

    expect(results.length).toBe(4)

    // Posts linked to draft should have draft_title
    const fb = results.find((r: any) => r.id === 'sp1')
    expect(fb.draft_title).toBe('Weekly Update')

    // Standalone posts should have null draft_title
    const li = results.find((r: any) => r.id === 'sp3')
    expect(li.draft_title).toBeNull()
  })

  it('filters by status', async () => {
    const { results } = await db.prepare(
      `SELECT sp.*, cd.title as draft_title
       FROM social_posts sp
       LEFT JOIN content_drafts cd ON cd.id = sp.content_draft_id
       WHERE sp.status = ?1
       ORDER BY sp.scheduled_at ASC LIMIT 100`
    ).bind('scheduled').all()

    expect(results.length).toBe(2)
    expect(results.every((r: any) => r.status === 'scheduled')).toBe(true)
  })

  it('filters by failed status to show problem posts', async () => {
    const { results } = await db.prepare(
      `SELECT sp.* FROM social_posts sp WHERE sp.status = ?1 ORDER BY sp.scheduled_at ASC`
    ).bind('failed').all()

    expect(results.length).toBe(1)
    expect(results[0].error_message).toBe('Token expired')
    expect(results[0].retry_count).toBe(3)
  })

  it('orders by scheduled_at ASC (upcoming first)', async () => {
    const { results } = await db.prepare(
      `SELECT sp.scheduled_at FROM social_posts sp ORDER BY sp.scheduled_at ASC`
    ).all()

    for (let i = 1; i < results.length; i++) {
      expect(results[i].scheduled_at >= results[i - 1].scheduled_at).toBe(true)
    }
  })
})

describe('schedule POST validation patterns', () => {
  it('enforces NOT NULL on platform', () => {
    expect(() => {
      sqlite.exec(
        `INSERT INTO social_posts (id, content, scheduled_at, status)
         VALUES ('bad1', 'No platform', '2026-04-01T00:00:00Z', 'scheduled')`
      )
    }).toThrow()
  })

  it('enforces NOT NULL on content', () => {
    expect(() => {
      sqlite.exec(
        `INSERT INTO social_posts (id, platform, scheduled_at, status)
         VALUES ('bad2', 'facebook', '2026-04-01T00:00:00Z', 'scheduled')`
      )
    }).toThrow()
  })

  it('enforces NOT NULL on scheduled_at', () => {
    expect(() => {
      sqlite.exec(
        `INSERT INTO social_posts (id, platform, content, status)
         VALUES ('bad3', 'facebook', 'Content', 'scheduled')`
      )
    }).toThrow()
  })

  it('allows any string for platform (no enum constraint in DB)', () => {
    // DB doesn't enforce platform enum — validation happens in app layer
    sqlite.exec(
      `INSERT INTO social_posts (id, platform, content, scheduled_at, status)
       VALUES ('ok1', 'tiktok', 'TikTok post', '2026-04-01T00:00:00Z', 'scheduled')`
    )
    const row = sqlite.prepare('SELECT platform FROM social_posts WHERE id = ?').get('ok1') as any
    expect(row.platform).toBe('tiktok')
  })
})

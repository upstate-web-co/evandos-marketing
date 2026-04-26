import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDB } from './setup'

let db: any
let sqlite: any

beforeEach(() => {
  const test = createTestDB()
  db = test.db
  sqlite = test.sqlite
})

// Tests the exact queries used by /api/marketing-admin/stats.ts

describe('dashboard stats queries', () => {
  it('counts posts this week', async () => {
    // Posted 1 day ago — should count
    sqlite.exec(
      `INSERT INTO social_posts (id, platform, content, scheduled_at, status, posted_at)
       VALUES ('recent', 'facebook', 'Recent', '2020-01-01T00:00:00Z', 'posted', datetime('now', '-1 day'))`
    )
    // Posted 30 days ago — should not count
    sqlite.exec(
      `INSERT INTO social_posts (id, platform, content, scheduled_at, status, posted_at)
       VALUES ('old', 'facebook', 'Old', '2020-01-01T00:00:00Z', 'posted', datetime('now', '-30 days'))`
    )

    const row = await db.prepare(
      `SELECT COUNT(*) as count FROM social_posts
       WHERE status = 'posted' AND posted_at >= datetime('now', '-7 days')`
    ).first()

    expect(row.count).toBe(1)
  })

  it('counts scheduled posts', async () => {
    sqlite.exec(
      `INSERT INTO social_posts (id, platform, content, scheduled_at, status)
       VALUES ('s1', 'facebook', 'A', '2099-01-01T00:00:00Z', 'scheduled')`
    )
    sqlite.exec(
      `INSERT INTO social_posts (id, platform, content, scheduled_at, status)
       VALUES ('s2', 'instagram', 'B', '2099-01-01T00:00:00Z', 'scheduled')`
    )
    sqlite.exec(
      `INSERT INTO social_posts (id, platform, content, scheduled_at, status)
       VALUES ('s3', 'facebook', 'C', '2020-01-01T00:00:00Z', 'posted')`
    )

    const row = await db.prepare(
      `SELECT COUNT(*) as count FROM social_posts WHERE status = 'scheduled'`
    ).first()

    expect(row.count).toBe(2)
  })

  it('counts distinct connected platforms', async () => {
    sqlite.exec(
      `INSERT INTO social_tokens (id, platform, access_token, expires_at, account_id)
       VALUES ('t1', 'facebook', 'enc1', '2099-01-01T00:00:00Z', 'fb-page')`
    )
    sqlite.exec(
      `INSERT INTO social_tokens (id, platform, access_token, expires_at, account_id)
       VALUES ('t2', 'instagram', 'enc2', '2099-01-01T00:00:00Z', 'ig-acct')`
    )

    const row = await db.prepare(
      `SELECT COUNT(DISTINCT platform) as count FROM social_tokens`
    ).first()

    expect(row.count).toBe(2)
  })

  it('counts failed posts', async () => {
    sqlite.exec(
      `INSERT INTO social_posts (id, platform, content, scheduled_at, status, retry_count)
       VALUES ('f1', 'linkedin', 'Failed 1', '2020-01-01T00:00:00Z', 'failed', 3)`
    )
    sqlite.exec(
      `INSERT INTO social_posts (id, platform, content, scheduled_at, status, retry_count)
       VALUES ('f2', 'gbp', 'Failed 2', '2020-01-01T00:00:00Z', 'failed', 1)`
    )
    sqlite.exec(
      `INSERT INTO social_posts (id, platform, content, scheduled_at, status)
       VALUES ('ok', 'facebook', 'OK', '2020-01-01T00:00:00Z', 'posted')`
    )

    const row = await db.prepare(
      `SELECT COUNT(*) as count FROM social_posts WHERE status = 'failed'`
    ).first()

    expect(row.count).toBe(2)
  })

  it('returns 0 for all stats on empty database', async () => {
    const [postsThisWeek, scheduled, platforms, failed] = await Promise.all([
      db.prepare(`SELECT COUNT(*) as count FROM social_posts WHERE status = 'posted' AND posted_at >= datetime('now', '-7 days')`).first(),
      db.prepare(`SELECT COUNT(*) as count FROM social_posts WHERE status = 'scheduled'`).first(),
      db.prepare(`SELECT COUNT(DISTINCT platform) as count FROM social_tokens`).first(),
      db.prepare(`SELECT COUNT(*) as count FROM social_posts WHERE status = 'failed'`).first(),
    ])

    expect(postsThisWeek.count).toBe(0)
    expect(scheduled.count).toBe(0)
    expect(platforms.count).toBe(0)
    expect(failed.count).toBe(0)
  })
})

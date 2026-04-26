import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDB } from './setup'
import { isTokenExpired, isTokenExpiringSoon } from '../../src/lib/social/tokens'

let db: any
let sqlite: any

beforeEach(() => {
  const test = createTestDB()
  db = test.db
  sqlite = test.sqlite
})

// Tests the queries and logic used by /api/marketing-admin/tokens.ts GET

describe('token status queries', () => {
  it('returns token metadata without exposing encrypted tokens', async () => {
    sqlite.exec(
      `INSERT INTO social_tokens (id, platform, access_token, refresh_token, expires_at, account_id, scope)
       VALUES ('t1', 'facebook', 'encrypted_access_token_abc', 'encrypted_refresh_xyz', '2099-01-01T00:00:00Z', 'page-123', 'pages_manage_posts')`
    )

    const { results } = await db.prepare(
      'SELECT platform, expires_at, account_id, scope, updated_at FROM social_tokens ORDER BY platform ASC'
    ).all()

    expect(results).toHaveLength(1)
    const token = results[0]
    expect(token.platform).toBe('facebook')
    expect(token.account_id).toBe('page-123')
    expect(token.scope).toBe('pages_manage_posts')
    // Should NOT include access_token or refresh_token
    expect(token.access_token).toBeUndefined()
    expect(token.refresh_token).toBeUndefined()
  })

  it('derives valid/expiring_soon/expired status correctly', () => {
    const farFuture = '2099-01-01T00:00:00Z'
    const in30min = new Date(Date.now() + 30 * 60_000).toISOString()
    const past = '2020-01-01T00:00:00Z'

    function deriveStatus(expiresAt: string): string {
      if (isTokenExpired(expiresAt)) return 'expired'
      if (isTokenExpiringSoon(expiresAt, 60)) return 'expiring_soon'
      return 'valid'
    }

    expect(deriveStatus(farFuture)).toBe('valid')
    expect(deriveStatus(in30min)).toBe('expiring_soon')
    expect(deriveStatus(past)).toBe('expired')
  })

  it('returns all four platforms when configured', async () => {
    const platforms = ['facebook', 'instagram', 'linkedin', 'gbp']
    for (const p of platforms) {
      sqlite.exec(
        `INSERT INTO social_tokens (id, platform, access_token, expires_at, account_id)
         VALUES ('t_${p}', '${p}', 'enc_${p}', '2099-01-01T00:00:00Z', '${p}-id')`
      )
    }

    const { results } = await db.prepare(
      'SELECT platform FROM social_tokens ORDER BY platform ASC'
    ).all()

    expect(results.map((r: any) => r.platform)).toEqual(['facebook', 'gbp', 'instagram', 'linkedin'])
  })

  it('enforces UNIQUE on platform (upsert pattern)', async () => {
    sqlite.exec(
      `INSERT INTO social_tokens (id, platform, access_token, expires_at, account_id)
       VALUES ('t1', 'facebook', 'old_token', '2025-01-01T00:00:00Z', 'old-page')`
    )

    // Upsert — same platform, new token
    await db.prepare(
      `INSERT INTO social_tokens (platform, access_token, refresh_token, expires_at, account_id, scope, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))
       ON CONFLICT(platform) DO UPDATE SET
         access_token = ?2,
         refresh_token = ?3,
         expires_at = ?4,
         account_id = ?5,
         scope = ?6,
         updated_at = datetime('now')`
    ).bind('facebook', 'new_token', 'new_refresh', '2099-01-01T00:00:00Z', 'new-page', 'pages_manage_posts').run()

    const { results } = await db.prepare('SELECT * FROM social_tokens WHERE platform = ?1').bind('facebook').all()
    expect(results).toHaveLength(1) // only one row, not two
    expect(results[0].access_token).toBe('new_token')
    expect(results[0].account_id).toBe('new-page')
  })
})

describe('analytics_daily queries', () => {
  it('returns snapshots ordered by date DESC with limit', async () => {
    sqlite.exec(`INSERT INTO analytics_daily (id, date, page_views, unique_visitors) VALUES ('a1', '2026-03-22', 150, 80)`)
    sqlite.exec(`INSERT INTO analytics_daily (id, date, page_views, unique_visitors) VALUES ('a2', '2026-03-23', 200, 120)`)
    sqlite.exec(`INSERT INTO analytics_daily (id, date, page_views, unique_visitors) VALUES ('a3', '2026-03-24', 175, 95)`)

    const { results } = await db.prepare(
      'SELECT * FROM analytics_daily ORDER BY date DESC LIMIT ?1'
    ).bind(2).all()

    expect(results).toHaveLength(2)
    expect(results[0].date).toBe('2026-03-24') // most recent first
    expect(results[1].date).toBe('2026-03-23')
  })

  it('enforces UNIQUE on date', () => {
    sqlite.exec(`INSERT INTO analytics_daily (id, date, page_views, unique_visitors) VALUES ('a1', '2026-03-24', 100, 50)`)

    expect(() => {
      sqlite.exec(`INSERT INTO analytics_daily (id, date, page_views, unique_visitors) VALUES ('a2', '2026-03-24', 200, 100)`)
    }).toThrow(/UNIQUE/)
  })

  it('stores and retrieves JSON columns', async () => {
    const topPages = JSON.stringify([{ path: '/', views: 50 }, { path: '/blog', views: 30 }])
    const sources = JSON.stringify([{ source: 'google', sessions: 40 }])

    sqlite.exec(
      `INSERT INTO analytics_daily (id, date, page_views, unique_visitors, top_pages_json, source_json)
       VALUES ('a1', '2026-03-24', 100, 50, '${topPages}', '${sources}')`
    )

    const row = await db.prepare('SELECT * FROM analytics_daily WHERE date = ?1').bind('2026-03-24').first()
    expect(JSON.parse(row.top_pages_json)).toHaveLength(2)
    expect(JSON.parse(row.source_json)[0].source).toBe('google')
  })

  it('returns empty array for empty analytics table', async () => {
    const { results } = await db.prepare(
      'SELECT * FROM analytics_daily ORDER BY date DESC LIMIT ?1'
    ).bind(30).all()

    expect(results).toEqual([])
  })
})

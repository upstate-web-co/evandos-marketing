import { describe, it, expect, beforeEach } from 'vitest'
import { createTestDB } from './setup'
import { getSeoOverride } from '../../src/lib/seo'

let db: any
let sqlite: any

beforeEach(() => {
  const test = createTestDB()
  db = test.db
  sqlite = test.sqlite
})

describe('getSeoOverride', () => {
  it('returns null when no override exists', async () => {
    const result = await getSeoOverride(db, '/about')
    expect(result).toBeNull()
  })

  it('returns null when db is null (prerendered pages)', async () => {
    const result = await getSeoOverride(null, '/')
    expect(result).toBeNull()
  })

  it('returns override for matching path', async () => {
    sqlite.exec(
      `INSERT INTO seo_pages (id, path, title, description, noindex)
       VALUES ('test1', '/', 'Custom Home Title', 'Custom description', 0)`
    )

    const result = await getSeoOverride(db, '/')
    expect(result).not.toBeNull()
    expect(result!.title).toBe('Custom Home Title')
    expect(result!.description).toBe('Custom description')
    expect(result!.noindex).toBe(0)
  })

  it('returns noindex flag correctly', async () => {
    sqlite.exec(
      `INSERT INTO seo_pages (id, path, title, noindex) VALUES ('test2', '/hidden', 'Hidden', 1)`
    )

    const result = await getSeoOverride(db, '/hidden')
    expect(result!.noindex).toBe(1)
  })

  it('returns null for non-matching path', async () => {
    sqlite.exec(
      `INSERT INTO seo_pages (id, path, title, noindex) VALUES ('test3', '/about', 'About', 0)`
    )

    const result = await getSeoOverride(db, '/services')
    expect(result).toBeNull()
  })

  it('returns schema_json when set', async () => {
    const schema = JSON.stringify({ '@type': 'LocalBusiness', name: 'UWC' })
    sqlite.exec(
      `INSERT INTO seo_pages (id, path, schema_json, noindex) VALUES ('test4', '/contact', '${schema}', 0)`
    )

    const result = await getSeoOverride(db, '/contact')
    expect(result!.schema_json).toBe(schema)
  })

  it('returns null fields when only path is set', async () => {
    sqlite.exec(
      `INSERT INTO seo_pages (id, path, noindex) VALUES ('test5', '/services', 0)`
    )

    const result = await getSeoOverride(db, '/services')
    expect(result).not.toBeNull()
    expect(result!.title).toBeNull()
    expect(result!.description).toBeNull()
    expect(result!.og_image_r2_key).toBeNull()
    expect(result!.schema_json).toBeNull()
  })
})

// ─── SEO Page CRUD (D1 patterns from /api/marketing-admin/seo.ts) ────

describe('seo_pages CRUD', () => {
  it('enforces UNIQUE on path', () => {
    sqlite.exec(`INSERT INTO seo_pages (id, path, noindex) VALUES ('s1', '/', 0)`)
    expect(() => {
      sqlite.exec(`INSERT INTO seo_pages (id, path, noindex) VALUES ('s2', '/', 0)`)
    }).toThrow(/UNIQUE/)
  })

  it('upserts on path conflict (INSERT ON CONFLICT)', async () => {
    sqlite.exec(`INSERT INTO seo_pages (id, path, title, noindex) VALUES ('s1', '/', 'Old Title', 0)`)

    await db.prepare(
      `INSERT INTO seo_pages (path, title, description, schema_json, noindex, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))
       ON CONFLICT(path) DO UPDATE SET
         title = ?2, description = ?3, schema_json = ?4, noindex = ?5, updated_at = datetime('now')`
    ).bind('/', 'New Title', 'New desc', null, 1).run()

    const { results } = await db.prepare('SELECT * FROM seo_pages WHERE path = ?1').bind('/').all()
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('New Title')
    expect(results[0].description).toBe('New desc')
    expect(results[0].noindex).toBe(1)
  })

  it('deletes SEO override by path', async () => {
    sqlite.exec(`INSERT INTO seo_pages (id, path, title, noindex) VALUES ('s1', '/about', 'About', 0)`)

    await db.prepare('DELETE FROM seo_pages WHERE path = ?1').bind('/about').run()

    const result = await getSeoOverride(db, '/about')
    expect(result).toBeNull()
  })

  it('lists all SEO pages ordered by path', async () => {
    sqlite.exec(`INSERT INTO seo_pages (id, path, title, noindex) VALUES ('s1', '/services', 'Services', 0)`)
    sqlite.exec(`INSERT INTO seo_pages (id, path, title, noindex) VALUES ('s2', '/about', 'About', 0)`)
    sqlite.exec(`INSERT INTO seo_pages (id, path, title, noindex) VALUES ('s3', '/contact', 'Contact', 0)`)

    const { results } = await db.prepare(
      'SELECT id, path, title, description, og_image_r2_key, schema_json, noindex, updated_at FROM seo_pages ORDER BY path ASC'
    ).all()

    expect(results).toHaveLength(3)
    expect(results[0].path).toBe('/about')
    expect(results[1].path).toBe('/contact')
    expect(results[2].path).toBe('/services')
  })

  it('has index on path for fast lookups', () => {
    const indexes = sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='seo_pages'")
      .all()
    expect(indexes.map((i: any) => i.name)).toContain('idx_seo_pages_path')
  })
})

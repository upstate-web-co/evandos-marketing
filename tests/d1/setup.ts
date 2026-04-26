import Database from 'better-sqlite3'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Creates an in-memory SQLite database that implements the D1Database interface.
 * Runs all marketing-site migrations so tests operate against the real schema.
 *
 * Tables: content_drafts, social_posts, social_tokens, seo_pages, analytics_daily
 */
export function createTestDB() {
  const sqlite = new Database(':memory:')

  // Apply migrations in order
  const migrationDir = join(__dirname, '../../migrations')
  const migration1 = readFileSync(join(migrationDir, '0001_marketing_schema.sql'), 'utf-8')
  const migration2 = readFileSync(join(migrationDir, '0002_add_retry_count.sql'), 'utf-8')
  const migration3 = readFileSync(join(migrationDir, '0003_indexes_ai_flag_history.sql'), 'utf-8')

  for (const sql of [...migration1.split(';'), ...migration2.split(';'), ...migration3.split(';')]) {
    const trimmed = sql.trim()
    if (trimmed) sqlite.exec(trimmed)
  }

  // D1 uses ?1, ?2, ... placeholders; better-sqlite3 uses positional ?
  // Convert D1-style to SQLite-style and reorder values accordingly
  function convertQuery(query: string, values: unknown[]): { sql: string; params: unknown[] } {
    if (values.length === 0) return { sql: query, params: [] }

    // Replace ?N with ? and collect the ordering
    const params: unknown[] = []
    const sql = query.replace(/\?(\d+)/g, (_match, num) => {
      params.push(values[parseInt(num, 10) - 1]) // ?1 = values[0]
      return '?'
    })
    return { sql, params }
  }

  // Wrap better-sqlite3 to match the D1Database interface used by our lib functions
  function makeMethods(query: string, values: unknown[]) {
    return {
      first<T = unknown>(_column?: string): Promise<T | null> {
        try {
          const { sql, params } = convertQuery(query, values)
          const stmt = sqlite.prepare(sql)
          const row = stmt.get(...params) as T | undefined
          return Promise.resolve(row ?? null)
        } catch (err) {
          return Promise.reject(err)
        }
      },
      all<T = unknown>(): Promise<{ results: T[]; success: boolean; meta: { duration: number } }> {
        try {
          const { sql, params } = convertQuery(query, values)
          const stmt = sqlite.prepare(sql)
          const rows = stmt.all(...params) as T[]
          return Promise.resolve({ results: rows, success: true, meta: { duration: 0 } })
        } catch (err) {
          return Promise.reject(err)
        }
      },
      run(): Promise<{ success: boolean; meta: { duration: number } }> {
        try {
          const { sql, params } = convertQuery(query, values)
          const stmt = sqlite.prepare(sql)
          stmt.run(...params)
          return Promise.resolve({ success: true, meta: { duration: 0 } })
        } catch (err) {
          return Promise.reject(err)
        }
      },
      bind(...newValues: unknown[]) {
        return makeMethods(query, newValues)
      },
    }
  }

  const db = {
    prepare(query: string) {
      return makeMethods(query, [])
    },
    batch() {
      return Promise.resolve([])
    },
  }

  return { db: db as any, sqlite }
}

/**
 * Clears all data from all marketing tables (preserves schema).
 * Order matters — foreign key dependencies.
 */
export function clearAllTables(sqlite: Database.Database) {
  sqlite.exec('DELETE FROM social_posts')
  sqlite.exec('DELETE FROM content_drafts')
  sqlite.exec('DELETE FROM social_tokens')
  sqlite.exec('DELETE FROM seo_pages')
  sqlite.exec('DELETE FROM analytics_daily')
}

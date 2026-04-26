import type { APIContext } from 'astro'

/**
 * Typed Cloudflare environment bindings.
 * Eliminates (locals as any).runtime?.env pattern across all API routes.
 *
 * Usage:
 *   const env = getEnv(locals)
 *   const db = env.DB
 */
export interface CloudflareEnv {
  DB: D1Database | undefined
  MEDIA: R2Bucket | undefined
  RATE_LIMIT: KVNamespace | undefined
  RESEND_API_KEY: string | undefined
  ANTHROPIC_API_KEY: string | undefined
  SOCIAL_TOKEN_ENCRYPTION_KEY: string | undefined
  CRON_SECRET: string | undefined
  CF_ANALYTICS_TOKEN: string | undefined
  CF_ZONE_ID: string | undefined
  SITE_URL: string | undefined
  R2_PUBLIC_URL: string | undefined
  LINKEDIN_CLIENT_ID: string | undefined
  LINKEDIN_CLIENT_SECRET: string | undefined
  GOOGLE_CLIENT_ID: string | undefined
  GOOGLE_CLIENT_SECRET: string | undefined
  META_PIXEL_ID: string | undefined
  GOOGLE_ADS_ID: string | undefined
  ALLOWED_ADMIN_EMAILS: string | undefined
  ADMIN_PASSWORD: string | undefined
  ALERT_EMAIL: string | undefined
  ENVIRONMENT: string | undefined
}

// D1Database and R2Bucket types from CF Workers
interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = unknown>(column?: string): Promise<T | null>
  all<T = unknown>(): Promise<{ results: T[]; success: boolean; meta: { duration: number } }>
  run(): Promise<{ success: boolean; meta: { duration: number } }>
}

interface D1Result<T = unknown> {
  results: T[]
  success: boolean
  meta: { duration: number }
}

interface R2Bucket {
  put(key: string, value: ArrayBuffer | ReadableStream, options?: Record<string, unknown>): Promise<R2Object>
  get(key: string): Promise<R2ObjectBody | null>
  delete(key: string): Promise<void>
}

interface R2Object {
  key: string
  size: number
  httpMetadata?: { contentType?: string }
}

interface R2ObjectBody extends R2Object {
  body: ReadableStream
}

interface KVNamespace {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
}

export function getEnv(locals: APIContext['locals']): CloudflareEnv {
  return ((locals as Record<string, unknown>).runtime as { env: CloudflareEnv } | undefined)?.env ?? {} as CloudflareEnv
}

export function requireDB(locals: APIContext['locals']): { db: D1Database; env: CloudflareEnv } {
  const env = getEnv(locals)
  if (!env.DB) throw new DBNotConfiguredError()
  return { db: env.DB, env }
}

export class DBNotConfiguredError extends Error {
  constructor() {
    super('Database not configured')
  }
}

export function dbErrorResponse() {
  return Response.json({ error: 'Database not configured', code: 'DB_NOT_CONFIGURED' }, { status: 500 })
}

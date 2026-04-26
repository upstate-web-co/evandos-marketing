import { getEnv } from '../../../lib/env'
import type { APIContext } from 'astro'
import { processScheduledPosts } from '../../../lib/social/scheduler'

// This endpoint is called by a standalone CF Worker cron trigger (Phase 10)
// or can be manually triggered from the admin for testing.
// In production, protect with a shared secret header.

export async function POST({ request, locals }: APIContext) {
  try {
    const env = getEnv(locals)

    // Verify cron secret — REQUIRED, fail closed if not configured
    const cronSecret = env.CRON_SECRET
    if (!cronSecret) {
      console.error('CRON_SECRET not configured — rejecting cron request')
      return Response.json({ error: 'Cron not configured', code: 'NOT_CONFIGURED' }, { status: 500 })
    }
    const authHeader = request.headers.get('x-cron-secret')
    if (authHeader !== cronSecret) {
      return Response.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const db = env.DB
    const encryptionKey = env.SOCIAL_TOKEN_ENCRYPTION_KEY

    if (!db || !encryptionKey) {
      return Response.json({ error: 'Database or encryption key not configured', code: 'DB_NOT_CONFIGURED' }, { status: 500 })
    }

    const result = await processScheduledPosts({
      DB: db,
      SOCIAL_TOKEN_ENCRYPTION_KEY: encryptionKey,
      SITE_URL: env.SITE_URL,
      LINKEDIN_CLIENT_ID: env.LINKEDIN_CLIENT_ID,
      LINKEDIN_CLIENT_SECRET: env.LINKEDIN_CLIENT_SECRET,
      GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET,
    })

    return Response.json(result)
  } catch (err) {
    console.error('[cron] Error:', err)
    return Response.json({ error: 'Cron processing failed', code: 'CRON_FAILED' }, { status: 500 })
  }
}

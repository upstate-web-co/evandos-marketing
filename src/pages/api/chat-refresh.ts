/**
 * POST /api/chat-refresh
 *
 * Busts the cached chat context, forcing the next chat request
 * to fetch fresh data from agency-admin. Call this after deploys
 * or significant changes (new projects, pricing updates, etc.)
 *
 * No auth — the endpoint only clears a cache, doesn't expose data.
 */

import type { APIContext } from 'astro'
import { bustCache } from '../../lib/chat-context'

export async function POST(_context: APIContext) {
  bustCache()
  return Response.json({ ok: true, message: 'Chat context cache cleared. Next chat request will fetch fresh data.' })
}

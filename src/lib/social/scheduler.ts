// Cron handler: query D1 for posts due, post them, update status
// Called by a standalone CF Worker cron trigger (Phase 10)

import { getValidToken, isTokenExpired, isTokenExpiringSoon, storeToken } from './tokens'
import { postToFacebook, postToInstagram } from './meta'
import { postToLinkedIn, refreshLinkedInToken } from './linkedin'
import { postToGbp, refreshGoogleToken } from './gbp'

const SITE_URL = 'https://uwc-marketing-site.pages.dev'

interface Env {
  DB: any
  SOCIAL_TOKEN_ENCRYPTION_KEY: string
  SITE_URL?: string
  LINKEDIN_CLIENT_ID?: string
  LINKEDIN_CLIENT_SECRET?: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
}

export async function processScheduledPosts(env: Env): Promise<{ processed: number; errors: string[] }> {
  const { DB, SOCIAL_TOKEN_ENCRYPTION_KEY } = env
  const errors: string[] = []
  let processed = 0

  const MAX_RETRIES = 3

  // Find posts that are due (including failed retries and stale "posting" posts)
  const { results: duePosts } = await DB
    .prepare(
      `SELECT * FROM social_posts
       WHERE (status = 'scheduled' AND scheduled_at <= datetime('now'))
          OR (status = 'failed' AND retry_count < ?1 AND scheduled_at <= datetime('now'))
          OR (status = 'posting' AND updated_at <= datetime('now', '-10 minutes'))
       ORDER BY scheduled_at ASC
       LIMIT 10`
    )
    .bind(MAX_RETRIES)
    .all()

  for (const post of duePosts) {
    // Mark as posting
    await DB
      .prepare("UPDATE social_posts SET status = 'posting', updated_at = datetime('now') WHERE id = ?1")
      .bind(post.id)
      .run()

    try {
      const token = await getValidToken(DB, post.platform, SOCIAL_TOKEN_ENCRYPTION_KEY)

      if (!token) {
        throw new Error(`No token configured for ${post.platform}`)
      }

      // Refresh token if needed
      if (isTokenExpired(token.expires_at) || isTokenExpiringSoon(token.expires_at)) {
        const refreshed = await refreshTokenIfNeeded(env, post.platform, token)
        if (!refreshed) {
          throw new Error(`Token expired and refresh failed for ${post.platform}`)
        }
        // Re-fetch the updated token
        const freshToken = await getValidToken(DB, post.platform, SOCIAL_TOKEN_ENCRYPTION_KEY)
        if (!freshToken) throw new Error(`Failed to retrieve refreshed token for ${post.platform}`)
        Object.assign(token, freshToken)
      }

      // Resolve media URL to absolute if relative
      let mediaUrl = post.media_url
      if (mediaUrl && mediaUrl.startsWith('/')) {
        mediaUrl = `${env.SITE_URL || SITE_URL}${mediaUrl}`
      }

      // Deduplication: if external_id already set (previous attempt succeeded but DB update failed), skip API call
      if (post.external_id) {
        await DB
          .prepare(
            `UPDATE social_posts SET status = 'posted', posted_at = COALESCE(posted_at, datetime('now')), updated_at = datetime('now') WHERE id = ?1`
          )
          .bind(post.id)
          .run()
        processed++
        continue
      }

      // Post to platform
      const result = await postToPlatform(post.platform, token, post.content, mediaUrl)

      if (result.success) {
        await DB
          .prepare(
            `UPDATE social_posts SET
              status = 'posted',
              posted_at = datetime('now'),
              external_id = ?2,
              updated_at = datetime('now')
            WHERE id = ?1`
          )
          .bind(post.id, result.postId ?? null)
          .run()
        processed++
      } else {
        throw new Error(result.error ?? 'Unknown posting error')
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      errors.push(`Post ${post.id} (${post.platform}): ${errorMsg}`)

      const newRetryCount = (post.retry_count ?? 0) + 1
      const newStatus = newRetryCount >= MAX_RETRIES ? 'failed' : 'failed'

      await DB
        .prepare(
          `UPDATE social_posts SET
            status = ?2,
            error_message = ?3,
            retry_count = ?4,
            updated_at = datetime('now')
          WHERE id = ?1`
        )
        .bind(post.id, newStatus, errorMsg, newRetryCount)
        .run()
    }
  }

  return { processed, errors }
}

async function postToPlatform(
  platform: string,
  token: { access_token: string; account_id: string },
  content: string,
  mediaUrl?: string | null
): Promise<{ success: boolean; postId?: string; error?: string }> {
  switch (platform) {
    case 'facebook':
      return postToFacebook(token.account_id, token.access_token, content, mediaUrl ?? undefined)

    case 'instagram':
      if (!mediaUrl) return { success: false, error: 'Instagram requires a media URL' }
      return postToInstagram(token.account_id, token.access_token, content, mediaUrl)

    case 'linkedin':
      return postToLinkedIn(token.account_id, token.access_token, content)

    case 'gbp':
      return postToGbp(token.account_id, token.access_token, content)

    default:
      return { success: false, error: `Unknown platform: ${platform}` }
  }
}

async function refreshTokenIfNeeded(
  env: Env,
  platform: string,
  token: { refresh_token: string | null; account_id: string; scope: string | null }
): Promise<boolean> {
  if (!token.refresh_token) return false

  if (platform === 'linkedin' && env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET) {
    const result = await refreshLinkedInToken(env.LINKEDIN_CLIENT_ID, env.LINKEDIN_CLIENT_SECRET, token.refresh_token)
    if (!result) return false

    const expiresAt = new Date(Date.now() + result.expires_in * 1000).toISOString()
    await storeToken(
      env.DB, platform, result.access_token,
      result.refresh_token ?? token.refresh_token,
      expiresAt, token.account_id, token.scope, env.SOCIAL_TOKEN_ENCRYPTION_KEY
    )
    return true
  }

  if (platform === 'gbp' && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    const result = await refreshGoogleToken(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, token.refresh_token)
    if (!result) return false

    const expiresAt = new Date(Date.now() + result.expires_in * 1000).toISOString()
    await storeToken(
      env.DB, platform, result.access_token,
      token.refresh_token, // Google doesn't return new refresh tokens
      expiresAt, token.account_id, token.scope, env.SOCIAL_TOKEN_ENCRYPTION_KEY
    )
    return true
  }

  // Facebook/Instagram Page Tokens don't expire (no refresh needed)
  return false
}

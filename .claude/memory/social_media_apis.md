# social_media_apis.md — Platform Integration Patterns

## Token Management (src/lib/social/tokens.ts)

```typescript
import type { D1Database } from '@cloudflare/workers-types'

interface SocialToken {
  id: string
  platform: string
  access_token: string   // encrypted
  refresh_token: string | null  // encrypted
  expires_at: string
  account_id: string
}

// Simple encryption using Web Crypto (available in CF Workers)
async function encrypt(text: string, key: string): Promise<string> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(key.padEnd(32).slice(0, 32)), 'AES-GCM', false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, keyMaterial, enc.encode(text))
  return btoa(String.fromCharCode(...iv)) + '.' + btoa(String.fromCharCode(...new Uint8Array(encrypted)))
}

async function decrypt(encryptedText: string, key: string): Promise<string> {
  const [ivB64, dataB64] = encryptedText.split('.')
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(key.padEnd(32).slice(0, 32)), 'AES-GCM', false, ['decrypt'])
  const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0))
  const data = Uint8Array.from(atob(dataB64), c => c.charCodeAt(0))
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, keyMaterial, data)
  return new TextDecoder().decode(decrypted)
}

export async function getValidToken(DB: D1Database, platform: string, encKey: string): Promise<string | null> {
  const token = await DB.prepare(
    'SELECT * FROM social_tokens WHERE platform = ?'
  ).bind(platform).first<SocialToken>() ?? null
  if (!token) return null

  const expiresAt = new Date(token.expires_at).getTime()
  const nowPlusBuffer = Date.now() + 5 * 60 * 1000  // 5 min buffer

  if (expiresAt < nowPlusBuffer && token.refresh_token) {
    return await refreshToken(DB, token, encKey)
  }

  return await decrypt(token.access_token, encKey)
}

async function refreshToken(DB: D1Database, token: SocialToken, encKey: string): Promise<string | null> {
  // Platform-specific refresh — LinkedIn and GBP need this, Meta Page tokens don't expire
  // Implementation varies per platform — see platform-specific sections below
  return null // placeholder
}
```

---

## Meta — Facebook Page Posts

```typescript
// src/lib/social/meta.ts
export async function postToFacebook(
  accessToken: string,
  pageId: string,
  message: string,
  link?: string
): Promise<{ id: string } | null> {
  const body: Record<string, string> = { message, access_token: accessToken }
  if (link) body.link = link

  const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(`Facebook post failed: ${JSON.stringify(err)}`)
  }
  return await res.json()  // { id: "page_post_id" }
}
```

## Meta — Instagram Posts (Two-Step)

```typescript
export async function postToInstagram(
  accessToken: string,
  igAccountId: string,
  imageUrl: string,    // MUST be a public URL — use R2 public bucket
  caption: string
): Promise<{ id: string } | null> {
  // Step 1: Create container
  const containerRes = await fetch(
    `https://graph.facebook.com/v21.0/${igAccountId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: accessToken }),
  })
  if (!containerRes.ok) throw new Error('IG container creation failed')
  const { id: containerId } = await containerRes.json()

  // Step 2: Publish (wait ~5s for container to process in production)
  const publishRes = await fetch(
    `https://graph.facebook.com/v21.0/${igAccountId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
  })
  if (!publishRes.ok) throw new Error('IG publish failed')
  return await publishRes.json()  // { id: "media_id" }
}
```

## LinkedIn — Company Page Posts

```typescript
// src/lib/social/linkedin.ts
export async function postToLinkedIn(
  accessToken: string,
  orgId: string,
  text: string
): Promise<{ id: string } | null> {
  const body = {
    author: `urn:li:organization:${orgId}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  }
  const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('LinkedIn post failed')
  const location = res.headers.get('x-restli-id')
  return { id: location ?? 'unknown' }
}

// LinkedIn token refresh (expires every 60 days)
export async function refreshLinkedInToken(refreshToken: string, clientId: string, clientSecret: string) {
  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  if (!res.ok) throw new Error('LinkedIn token refresh failed')
  return await res.json()  // { access_token, expires_in, refresh_token }
}
```

## Google Business Profile — Local Posts

```typescript
// src/lib/social/gbp.ts
export async function postToGBP(
  accessToken: string,
  accountName: string,   // e.g. "accounts/123456"
  locationName: string,  // e.g. "accounts/123456/locations/789"
  summary: string,
  callToActionUrl?: string
): Promise<object | null> {
  const body: Record<string, unknown> = {
    languageCode: 'en-US',
    summary,
    topicType: 'STANDARD',
  }
  if (callToActionUrl) {
    body.callToAction = { actionType: 'LEARN_MORE', url: callToActionUrl }
  }
  const res = await fetch(
    `https://mybusiness.googleapis.com/v4/${locationName}/localPosts`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )
  if (!res.ok) throw new Error('GBP post failed')
  return await res.json()
}

// GBP token refresh (expires every 1 hour)
export async function refreshGBPToken(refreshToken: string, clientId: string, clientSecret: string) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  if (!res.ok) throw new Error('GBP token refresh failed')
  return await res.json()  // { access_token, expires_in }
}
```

## Cron Scheduler (src/lib/social/scheduler.ts)

```typescript
// Called by the CF Workers cron trigger every 5 minutes
export async function processDuePosts(DB: D1Database, env: Record<string, string>) {
  const now = new Date().toISOString()

  const due = await DB.prepare(
    "SELECT * FROM social_posts WHERE scheduled_at <= ? AND status = 'scheduled' LIMIT 20"
  ).bind(now).all<SocialPost>()

  for (const post of due.results) {
    // Mark as 'posting' first — prevents double-post if cron overlaps
    await DB.prepare("UPDATE social_posts SET status = 'posting' WHERE id = ?").bind(post.id).run()

    try {
      const token = await getValidToken(DB, post.platform, env.SOCIAL_TOKEN_ENCRYPTION_KEY)
      if (!token) throw new Error(`No valid token for ${post.platform}`)

      let externalId: string | undefined

      switch (post.platform) {
        case 'facebook':
          const fbResult = await postToFacebook(token, env.META_PAGE_ID, post.content)
          externalId = fbResult?.id
          break
        case 'instagram':
          if (!post.media_url) throw new Error('Instagram requires an image')
          const igResult = await postToInstagram(token, env.META_IG_ACCOUNT_ID, post.media_url, post.content)
          externalId = igResult?.id
          break
        case 'linkedin':
          const liResult = await postToLinkedIn(token, env.LINKEDIN_ORG_ID, post.content)
          externalId = liResult?.id
          break
        case 'gbp':
          await postToGBP(token, env.GBP_ACCOUNT_NAME, env.GBP_LOCATION_NAME, post.content)
          externalId = 'gbp-posted'
          break
      }

      await DB.prepare(
        "UPDATE social_posts SET status = 'posted', posted_at = ?, external_id = ? WHERE id = ?"
      ).bind(new Date().toISOString(), externalId ?? null, post.id).run()

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error'
      await DB.prepare(
        "UPDATE social_posts SET status = 'failed', error_message = ? WHERE id = ?"
      ).bind(errorMsg, post.id).run()

      // TODO: send failure alert via Resend to your email
      console.error(`Post ${post.id} failed on ${post.platform}:`, errorMsg)
    }
  }

  return { processed: due.results.length }
}
```

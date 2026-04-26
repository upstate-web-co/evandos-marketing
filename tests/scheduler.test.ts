import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createTestDB } from './d1/setup'

// Mock the social platform modules — we don't want real API calls
vi.mock('../src/lib/social/meta', () => ({
  postToFacebook: vi.fn(),
  postToInstagram: vi.fn(),
}))

vi.mock('../src/lib/social/linkedin', () => ({
  postToLinkedIn: vi.fn(),
  refreshLinkedInToken: vi.fn(),
}))

vi.mock('../src/lib/social/gbp', () => ({
  postToGbp: vi.fn(),
  refreshGoogleToken: vi.fn(),
}))

// Mock token retrieval — we can't use real AES-256-GCM in Node test env
vi.mock('../src/lib/social/tokens', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/social/tokens')>('../src/lib/social/tokens')
  return {
    ...actual,
    getValidToken: vi.fn(),
    storeToken: vi.fn(),
  }
})

import { processScheduledPosts } from '../src/lib/social/scheduler'
import { postToFacebook } from '../src/lib/social/meta'
import { postToLinkedIn } from '../src/lib/social/linkedin'
import { postToGbp } from '../src/lib/social/gbp'
import { getValidToken } from '../src/lib/social/tokens'

const mockedFacebook = vi.mocked(postToFacebook)
const mockedLinkedIn = vi.mocked(postToLinkedIn)
const mockedGbp = vi.mocked(postToGbp)
const mockedGetToken = vi.mocked(getValidToken)

let db: any

function makeEnv(dbOverride?: any) {
  return {
    DB: dbOverride ?? db,
    SOCIAL_TOKEN_ENCRYPTION_KEY: 'test-key-for-testing-only-32ch',
    SITE_URL: 'https://uwc-marketing-site.pages.dev',
  }
}

beforeEach(() => {
  const test = createTestDB()
  db = test.db
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('processScheduledPosts', () => {
  it('returns zero processed when no posts are due', async () => {
    const result = await processScheduledPosts(makeEnv())
    expect(result.processed).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('posts to facebook and marks as posted', async () => {
    // Insert a due post
    await db
      .prepare(
        `INSERT INTO social_posts (id, platform, content, scheduled_at, status)
         VALUES ('sp1', 'facebook', 'Test FB post', '2020-01-01T00:00:00Z', 'scheduled')`
      )
      .run()

    // Mock token retrieval — return a non-expired token
    mockedGetToken.mockResolvedValue({
      platform: 'facebook',
      access_token: 'fb-token-123',
      refresh_token: null,
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
      account_id: 'page-id-456',
      scope: null,
    })

    mockedFacebook.mockResolvedValue({ success: true, postId: 'fb_post_789' })

    const result = await processScheduledPosts(makeEnv())

    expect(result.processed).toBe(1)
    expect(result.errors).toHaveLength(0)
    expect(mockedFacebook).toHaveBeenCalledWith('page-id-456', 'fb-token-123', 'Test FB post', undefined)

    // Verify DB was updated
    const row = await db.prepare('SELECT * FROM social_posts WHERE id = ?1').bind('sp1').first()
    expect(row.status).toBe('posted')
    expect(row.external_id).toBe('fb_post_789')
  })

  it('records error and increments retry_count on platform failure', async () => {
    await db
      .prepare(
        `INSERT INTO social_posts (id, platform, content, scheduled_at, status, retry_count)
         VALUES ('sp1', 'linkedin', 'Test LI post', '2020-01-01T00:00:00Z', 'scheduled', 0)`
      )
      .run()

    mockedGetToken.mockResolvedValue({
      platform: 'linkedin',
      access_token: 'li-token',
      refresh_token: 'li-refresh',
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
      account_id: 'org-123',
      scope: null,
    })

    mockedLinkedIn.mockResolvedValue({ success: false, error: 'LinkedIn API 403: Forbidden' })

    const result = await processScheduledPosts(makeEnv())

    expect(result.processed).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('LinkedIn API 403')

    const row = await db.prepare('SELECT * FROM social_posts WHERE id = ?1').bind('sp1').first()
    expect(row.status).toBe('failed')
    expect(row.retry_count).toBe(1)
    expect(row.error_message).toContain('LinkedIn API 403')
  })

  it('handles missing token gracefully', async () => {
    await db
      .prepare(
        `INSERT INTO social_posts (id, platform, content, scheduled_at, status)
         VALUES ('sp1', 'gbp', 'Test GBP post', '2020-01-01T00:00:00Z', 'scheduled')`
      )
      .run()

    mockedGetToken.mockResolvedValue(null)

    const result = await processScheduledPosts(makeEnv())

    expect(result.processed).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('No token configured for gbp')
  })

  it('resolves relative media URLs to absolute', async () => {
    await db
      .prepare(
        `INSERT INTO social_posts (id, platform, content, scheduled_at, status, media_url)
         VALUES ('sp1', 'facebook', 'With image', '2020-01-01T00:00:00Z', 'scheduled', '/media/social/2026-03/abc.jpg')`
      )
      .run()

    mockedGetToken.mockResolvedValue({
      platform: 'facebook',
      access_token: 'fb-token',
      refresh_token: null,
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
      account_id: 'page-id',
      scope: null,
    })

    mockedFacebook.mockResolvedValue({ success: true, postId: 'fb_123' })

    await processScheduledPosts(makeEnv())

    // Should have resolved the relative URL to absolute
    expect(mockedFacebook).toHaveBeenCalledWith(
      'page-id',
      'fb-token',
      'With image',
      'https://uwc-marketing-site.pages.dev/media/social/2026-03/abc.jpg'
    )
  })

  it('retries failed posts that are under the retry limit', async () => {
    await db
      .prepare(
        `INSERT INTO social_posts (id, platform, content, scheduled_at, status, retry_count)
         VALUES ('sp1', 'gbp', 'Retry post', '2020-01-01T00:00:00Z', 'failed', 1)`
      )
      .run()

    mockedGetToken.mockResolvedValue({
      platform: 'gbp',
      access_token: 'gbp-token',
      refresh_token: 'gbp-refresh',
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
      account_id: 'accounts/123/locations/456',
      scope: null,
    })

    mockedGbp.mockResolvedValue({ success: true, postId: 'gbp_post_1' })

    const result = await processScheduledPosts(makeEnv())
    expect(result.processed).toBe(1)

    const row = await db.prepare('SELECT * FROM social_posts WHERE id = ?1').bind('sp1').first()
    expect(row.status).toBe('posted')
  })

  it('processes multiple due posts in order', async () => {
    await db.prepare(
      `INSERT INTO social_posts (id, platform, content, scheduled_at, status)
       VALUES ('sp1', 'facebook', 'First', '2020-01-01T00:00:00Z', 'scheduled')`
    ).run()
    await db.prepare(
      `INSERT INTO social_posts (id, platform, content, scheduled_at, status)
       VALUES ('sp2', 'facebook', 'Second', '2020-01-02T00:00:00Z', 'scheduled')`
    ).run()

    mockedGetToken.mockResolvedValue({
      platform: 'facebook',
      access_token: 'fb-token',
      refresh_token: null,
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
      account_id: 'page-id',
      scope: null,
    })

    mockedFacebook.mockResolvedValue({ success: true, postId: 'fb_123' })

    const result = await processScheduledPosts(makeEnv())
    expect(result.processed).toBe(2)
  })
})

// ─── Edge Cases ──────────────────────────────────────

describe('processScheduledPosts — edge cases', () => {
  it('does not pick up cancelled posts', async () => {
    await db.prepare(
      `INSERT INTO social_posts (id, platform, content, scheduled_at, status)
       VALUES ('sp1', 'facebook', 'Cancelled', '2020-01-01T00:00:00Z', 'cancelled')`
    ).run()

    const result = await processScheduledPosts(makeEnv())
    expect(result.processed).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('does not pick up already-posted posts', async () => {
    await db.prepare(
      `INSERT INTO social_posts (id, platform, content, scheduled_at, status, posted_at)
       VALUES ('sp1', 'facebook', 'Already done', '2020-01-01T00:00:00Z', 'posted', '2020-01-01T00:01:00Z')`
    ).run()

    const result = await processScheduledPosts(makeEnv())
    expect(result.processed).toBe(0)
  })

  it('does not retry posts at max retry count (3)', async () => {
    await db.prepare(
      `INSERT INTO social_posts (id, platform, content, scheduled_at, status, retry_count)
       VALUES ('sp1', 'facebook', 'Maxed out', '2020-01-01T00:00:00Z', 'failed', 3)`
    ).run()

    const result = await processScheduledPosts(makeEnv())
    expect(result.processed).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('does not pick up future scheduled posts', async () => {
    await db.prepare(
      `INSERT INTO social_posts (id, platform, content, scheduled_at, status)
       VALUES ('sp1', 'facebook', 'Future', '2099-12-31T23:59:59Z', 'scheduled')`
    ).run()

    const result = await processScheduledPosts(makeEnv())
    expect(result.processed).toBe(0)
  })

  it('handles mixed success and failure in same batch', async () => {
    await db.prepare(
      `INSERT INTO social_posts (id, platform, content, scheduled_at, status)
       VALUES ('sp1', 'facebook', 'Will succeed', '2020-01-01T00:00:00Z', 'scheduled')`
    ).run()
    await db.prepare(
      `INSERT INTO social_posts (id, platform, content, scheduled_at, status)
       VALUES ('sp2', 'linkedin', 'Will fail', '2020-01-02T00:00:00Z', 'scheduled')`
    ).run()

    mockedGetToken.mockImplementation(async (_db, platform) => ({
      platform,
      access_token: `${platform}-token`,
      refresh_token: null,
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
      account_id: `${platform}-id`,
      scope: null,
    }))

    mockedFacebook.mockResolvedValue({ success: true, postId: 'fb_ok' })
    mockedLinkedIn.mockResolvedValue({ success: false, error: 'Rate limited' })

    const result = await processScheduledPosts(makeEnv())
    expect(result.processed).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('Rate limited')

    const fb = await db.prepare('SELECT status FROM social_posts WHERE id = ?1').bind('sp1').first()
    const li = await db.prepare('SELECT status FROM social_posts WHERE id = ?1').bind('sp2').first()
    expect(fb.status).toBe('posted')
    expect(li.status).toBe('failed')
  })

  it('preserves absolute media URLs without modification', async () => {
    await db.prepare(
      `INSERT INTO social_posts (id, platform, content, scheduled_at, status, media_url)
       VALUES ('sp1', 'facebook', 'Abs URL', '2020-01-01T00:00:00Z', 'scheduled', 'https://example.com/img.jpg')`
    ).run()

    mockedGetToken.mockResolvedValue({
      platform: 'facebook',
      access_token: 'fb-token',
      refresh_token: null,
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
      account_id: 'page-id',
      scope: null,
    })
    mockedFacebook.mockResolvedValue({ success: true, postId: 'fb_1' })

    await processScheduledPosts(makeEnv())

    expect(mockedFacebook).toHaveBeenCalledWith(
      'page-id', 'fb-token', 'Abs URL', 'https://example.com/img.jpg'
    )
  })

  it('passes null media for text-only posts', async () => {
    await db.prepare(
      `INSERT INTO social_posts (id, platform, content, scheduled_at, status)
       VALUES ('sp1', 'facebook', 'Text only', '2020-01-01T00:00:00Z', 'scheduled')`
    ).run()

    mockedGetToken.mockResolvedValue({
      platform: 'facebook',
      access_token: 'fb-token',
      refresh_token: null,
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
      account_id: 'page-id',
      scope: null,
    })
    mockedFacebook.mockResolvedValue({ success: true, postId: 'fb_1' })

    await processScheduledPosts(makeEnv())

    // media_url is null in DB, so should pass undefined to postToFacebook
    expect(mockedFacebook).toHaveBeenCalledWith('page-id', 'fb-token', 'Text only', undefined)
  })

  it('limits batch to 10 posts per cron run', async () => {
    // Insert 12 due posts
    for (let i = 1; i <= 12; i++) {
      await db.prepare(
        `INSERT INTO social_posts (id, platform, content, scheduled_at, status)
         VALUES ('sp${i}', 'facebook', 'Post ${i}', '2020-01-01T00:00:0${Math.min(i, 9)}Z', 'scheduled')`
      ).run()
    }

    mockedGetToken.mockResolvedValue({
      platform: 'facebook',
      access_token: 'fb-token',
      refresh_token: null,
      expires_at: new Date(Date.now() + 86400_000).toISOString(),
      account_id: 'page-id',
      scope: null,
    })
    mockedFacebook.mockResolvedValue({ success: true, postId: 'fb_ok' })

    const result = await processScheduledPosts(makeEnv())

    // Scheduler query has LIMIT 10
    expect(result.processed).toBe(10)
    expect(mockedFacebook).toHaveBeenCalledTimes(10)
  })
})

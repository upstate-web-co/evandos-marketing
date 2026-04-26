# database_schema.md — uwc-marketing-site D1 Tables

> These are the marketing-specific D1 tables.
> Migrations: 0001_marketing_schema.sql (5 tables), 0002_add_retry_count.sql (retry_count column)
> The shared tables (clients, projects, etc.) are managed by uwc-agency-admin migrations.

---

## Full Schema

```sql
-- ─────────────────────────────────────────
-- CONTENT DRAFTS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_drafts (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title           TEXT,
  body            TEXT NOT NULL,
  platforms_json  TEXT NOT NULL DEFAULT '[]',
  -- JSON array: ["facebook","instagram","linkedin","gbp"]
  media_r2_keys_json TEXT NOT NULL DEFAULT '[]',
  -- JSON array of R2 keys for attached images
  status          TEXT NOT NULL DEFAULT 'draft',
  -- draft | approved | scheduled | posted | archived
  ai_generated    INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────
-- SOCIAL POSTS QUEUE
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_posts (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  content_draft_id TEXT REFERENCES content_drafts(id),
  platform        TEXT NOT NULL,
  -- facebook | instagram | linkedin | gbp
  content         TEXT NOT NULL,
  media_r2_key    TEXT,
  media_url       TEXT,
  -- computed public URL for platform API (set before posting)
  scheduled_at    TEXT NOT NULL,
  posted_at       TEXT,
  status          TEXT NOT NULL DEFAULT 'draft',
  -- draft | scheduled | posting | posted | failed | cancelled
  external_id     TEXT,
  -- platform's post ID after successful post
  error_message   TEXT,
  retry_count     INTEGER NOT NULL DEFAULT 0,
  -- incremented on each failed attempt, max 3 retries
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_social_posts_status ON social_posts(status);
CREATE INDEX idx_social_posts_scheduled_at ON social_posts(scheduled_at);
CREATE INDEX idx_social_posts_platform ON social_posts(platform);
CREATE INDEX idx_social_posts_draft_id ON social_posts(content_draft_id);

-- ─────────────────────────────────────────
-- SOCIAL PLATFORM TOKENS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS social_tokens (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  platform        TEXT NOT NULL UNIQUE,
  -- one active token per platform: facebook | instagram | linkedin | gbp
  access_token    TEXT NOT NULL,
  -- AES-256-GCM encrypted, key = SOCIAL_TOKEN_ENCRYPTION_KEY env var
  refresh_token   TEXT,
  -- AES-256-GCM encrypted (null for non-refreshable tokens like Meta Page tokens)
  expires_at      TEXT NOT NULL,
  account_id      TEXT NOT NULL,
  -- platform-specific: page_id / ig_account_id / org_id / location_name
  scope           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ─────────────────────────────────────────
-- SEO OVERRIDES
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_pages (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  path            TEXT NOT NULL UNIQUE,
  -- e.g. '/' or '/services' or '/blog/my-post-slug'
  title           TEXT,
  -- null = use Keystatic/Astro default
  description     TEXT,
  og_image_r2_key TEXT,
  schema_json     TEXT,
  -- JSON-LD override as raw JSON string. Replaces default schema if set.
  noindex         INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_seo_pages_path ON seo_pages(path);

-- ─────────────────────────────────────────
-- ANALYTICS DAILY SNAPSHOTS
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS analytics_daily (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  date            TEXT NOT NULL UNIQUE,
  -- YYYY-MM-DD UTC
  page_views      INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  top_pages_json  TEXT NOT NULL DEFAULT '[]',
  -- [{ "path": "/", "views": 120 }, ...]
  source_json     TEXT NOT NULL DEFAULT '[]',
  -- [{ "source": "google", "visits": 80 }, ...]
  cf_raw_json     TEXT,
  -- raw CF Analytics API response (for reprocessing)
  ga4_raw_json    TEXT,
  -- raw GA4 Data API response
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## Useful Queries

```sql
-- Posts due in next 2 hours
SELECT * FROM social_posts
WHERE status = 'scheduled'
  AND scheduled_at <= datetime('now', '+2 hours')
ORDER BY scheduled_at ASC;

-- Failed posts (need attention)
SELECT sp.*, cd.title as draft_title
FROM social_posts sp
LEFT JOIN content_drafts cd ON cd.id = sp.content_draft_id
WHERE sp.status = 'failed'
ORDER BY sp.scheduled_at DESC;

-- Posts per platform this month
SELECT platform, COUNT(*) as count
FROM social_posts
WHERE status = 'posted'
  AND posted_at >= datetime('now', 'start of month')
GROUP BY platform;

-- Token expiry status
SELECT platform, expires_at,
  CASE
    WHEN expires_at < datetime('now') THEN 'EXPIRED'
    WHEN expires_at < datetime('now', '+1 day') THEN 'EXPIRING_SOON'
    ELSE 'VALID'
  END as token_status
FROM social_tokens
ORDER BY expires_at ASC;
```

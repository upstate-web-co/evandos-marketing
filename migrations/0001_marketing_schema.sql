-- uwc-marketing-site: marketing tables
-- Run: wrangler d1 migrations apply agency-db --file=migrations/0001_marketing_schema.sql

CREATE TABLE IF NOT EXISTS content_drafts (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title           TEXT,
  body            TEXT NOT NULL,
  platforms_json  TEXT NOT NULL DEFAULT '[]',
  media_r2_keys_json TEXT NOT NULL DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'draft',
  ai_generated    INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS social_posts (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  content_draft_id TEXT REFERENCES content_drafts(id),
  platform        TEXT NOT NULL,
  content         TEXT NOT NULL,
  media_r2_key    TEXT,
  media_url       TEXT,
  scheduled_at    TEXT NOT NULL,
  posted_at       TEXT,
  status          TEXT NOT NULL DEFAULT 'draft',
  external_id     TEXT,
  error_message   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_social_posts_status ON social_posts(status);
CREATE INDEX idx_social_posts_scheduled_at ON social_posts(scheduled_at);
CREATE INDEX idx_social_posts_platform ON social_posts(platform);
CREATE INDEX idx_social_posts_draft_id ON social_posts(content_draft_id);

CREATE TABLE IF NOT EXISTS social_tokens (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  platform        TEXT NOT NULL UNIQUE,
  access_token    TEXT NOT NULL,
  refresh_token   TEXT,
  expires_at      TEXT NOT NULL,
  account_id      TEXT NOT NULL,
  scope           TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS seo_pages (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  path            TEXT NOT NULL UNIQUE,
  title           TEXT,
  description     TEXT,
  og_image_r2_key TEXT,
  schema_json     TEXT,
  noindex         INTEGER NOT NULL DEFAULT 0,
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_seo_pages_path ON seo_pages(path);

CREATE TABLE IF NOT EXISTS analytics_daily (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  date            TEXT NOT NULL UNIQUE,
  page_views      INTEGER NOT NULL DEFAULT 0,
  unique_visitors INTEGER NOT NULL DEFAULT 0,
  top_pages_json  TEXT NOT NULL DEFAULT '[]',
  source_json     TEXT NOT NULL DEFAULT '[]',
  cf_raw_json     TEXT,
  ga4_raw_json    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

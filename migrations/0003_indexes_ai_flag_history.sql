-- S1: Index on posted_at for stats query (WHERE posted_at >= datetime('now', '-7 days'))
CREATE INDEX IF NOT EXISTS idx_social_posts_posted_at ON social_posts(posted_at);

-- S2: Composite index for cron scheduler query (status + scheduled_at + retry_count)
CREATE INDEX IF NOT EXISTS idx_social_posts_cron ON social_posts(status, scheduled_at, retry_count);

-- S5: Index on analytics_daily.date for ORDER BY date DESC queries
CREATE INDEX IF NOT EXISTS idx_analytics_daily_date ON analytics_daily(date);

-- C2: Propagate ai_generated flag to social_posts (from content_drafts)
ALTER TABLE social_posts ADD COLUMN ai_generated INTEGER NOT NULL DEFAULT 0;

-- C1: Content audit trail — store previous content on edit
ALTER TABLE social_posts ADD COLUMN content_history_json TEXT;

-- Add retry_count to social_posts for retry logic
ALTER TABLE social_posts ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;

-- Industry categorization for newsletter content targeting
ALTER TABLE email_subscribers ADD COLUMN industry TEXT;

CREATE INDEX idx_email_subscribers_industry ON email_subscribers(industry);

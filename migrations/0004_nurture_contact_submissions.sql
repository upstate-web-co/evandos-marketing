-- Nurture tracking columns on email_subscribers
ALTER TABLE email_subscribers ADD COLUMN nurture_step INTEGER NOT NULL DEFAULT 0;
ALTER TABLE email_subscribers ADD COLUMN next_nurture_at TEXT;

CREATE INDEX idx_email_subscribers_nurture ON email_subscribers(status, nurture_step, next_nurture_at);

-- Contact form submissions (previously email-only, now also stored in D1)
CREATE TABLE IF NOT EXISTS contact_submissions (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  business    TEXT,
  message     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_contact_submissions_email ON contact_submissions(email);
CREATE INDEX idx_contact_submissions_created ON contact_submissions(created_at);

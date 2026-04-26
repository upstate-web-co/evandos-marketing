CREATE TABLE IF NOT EXISTS email_subscribers (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email           TEXT NOT NULL UNIQUE,
  name            TEXT,
  source          TEXT NOT NULL DEFAULT 'website',
  status          TEXT NOT NULL DEFAULT 'active',
  subscribed_at   TEXT NOT NULL DEFAULT (datetime('now')),
  unsubscribed_at TEXT
);

CREATE INDEX idx_email_subscribers_email ON email_subscribers(email);
CREATE INDEX idx_email_subscribers_status ON email_subscribers(status);

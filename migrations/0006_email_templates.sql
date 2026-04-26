-- Migration 0006: Add email_templates table for editable nurture + marketing emails.
-- Replaces hardcoded email content in email.ts with database-driven templates.

CREATE TABLE email_templates (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  template_type TEXT NOT NULL DEFAULT 'nurture'
    CHECK(template_type IN ('nurture', 'transactional', 'marketing', 'notification')),
  step_number INTEGER,
  delay_days INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  metadata TEXT DEFAULT '{}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_email_templates_slug ON email_templates(slug);
CREATE INDEX idx_email_templates_type ON email_templates(template_type);

-- Seed default nurture templates from current hardcoded emails
INSERT INTO email_templates (id, slug, name, subject, body, template_type, step_number, delay_days) VALUES
  (lower(hex(randomblob(16))), 'nurture-1', 'Nurture Step 1: Mobile Speed', 'Is your website costing you customers?', 'Quick question: when was the last time you checked how your website looks on a phone?\n\nHere''s why it matters:\n- 60% of Google searches happen on mobile\n- Slow sites lose 53% of visitors in under 3 seconds\n- Google ranks mobile-friendly sites higher\n\nIf your site takes more than 2 seconds to load, or if the text is hard to read on a phone, you''re losing customers to competitors who got this right.', 'nurture', 1, 1),
  (lower(hex(randomblob(16))), 'nurture-2', 'Nurture Step 2: Google Business Profile', 'One thing you can do today to get more calls', 'Here''s one free thing you can do today that most small businesses in SC skip:\n\nClaim and complete your Google Business Profile.\n\nIt takes about 15 minutes and it''s completely free. Here''s what to do:\n1. Go to business.google.com and claim your listing\n2. Fill in EVERY field — hours, services, photos, description\n3. Add your website URL\n4. Ask 2-3 happy customers to leave a review\n\nBusinesses with complete GBP profiles get 7x more clicks than incomplete ones.', 'nurture', 2, 3),
  (lower(hex(randomblob(16))), 'nurture-3', 'Nurture Step 3: Case Study', 'How a Greenville business doubled their leads', 'We recently worked with a business in the Upstate that had no website — just a social media page.\n\nThey were losing customers to competitors who showed up on Google.\n\nWe built them a custom website optimized for local search. Within 6 weeks:\n- They appeared on the first page of Google\n- They started getting 3-5 qualified leads per week\n- The site loads in under 2 seconds on any device', 'nurture', 3, 5),
  (lower(hex(randomblob(16))), 'nurture-4', 'Nurture Step 4: CTA', 'Ready to talk about your website?', 'Over the past week, we''ve shared tips on mobile speed, Google Business Profile, and a real case study from the Upstate.\n\nIf any of that resonated — if you know your website could be working harder for your business — we''d love to chat.\n\nNo sales pitch. Just a quick conversation about where you are and what might help.', 'nurture', 4, 7),
  (lower(hex(randomblob(16))), 'nurture-5', 'Nurture Step 5: Pricing', 'What a website actually costs (no surprises)', 'The #1 question we get: how much does a website cost?\n\nStarter Presence ($750-$1,200): 1 page, contact form, GBP setup. Live in 1-2 weeks.\nBusiness Website ($1,800-$3,500): 5-7 pages, blog/CMS, Stripe, SEO. Live in 2-3 weeks.\nOnline Store ($3,500-$7,500): Product catalog, cart, checkout, order management. Live in 3-5 weeks.\n\nNo hidden fees. No monthly platform charges. You own everything.', 'nurture', 5, 10),
  (lower(hex(randomblob(16))), 'nurture-6', 'Nurture Step 6: Testimonials', 'Our clients said it better than we could', 'We could tell you how great we are. Instead, here''s what our clients say:\n\n"The site feels completely different now. Pages load instantly." — MyChama\n\n"Everything a chef needs to run their business is in one place." — Chefs Delight\n\nWhat these projects have in common: a clear goal, a realistic timeline, and working results at every milestone.', 'nurture', 6, 14),
  (lower(hex(randomblob(16))), 'nurture-7', 'Nurture Step 7: Re-engagement', 'Still thinking about it?', 'It''s been a few weeks since you signed up, and we haven''t heard from you.\n\nThat''s totally fine — not everyone is ready right away.\n\nBut if your website is still on your mind, here are two easy next steps:\n\n1. Fill out our quick project form (3 minutes)\n2. Just reply to this email with your question.\n\nEither way, no pressure. We''ll be here when you''re ready.', 'nurture', 7, 21);

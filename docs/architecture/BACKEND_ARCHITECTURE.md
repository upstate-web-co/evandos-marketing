# UWC Marketing Site — Backend Architecture Document
> **Version:** 1.0 | **Date:** 2026-03-24 | **Stack:** Astro 5, Cloudflare Workers, D1, R2, Resend, Anthropic
> **Purpose:** Backend architecture reference — social posting pipeline, scheduler, token management, SEO, media, analytics, and AI integration.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Two Systems in One Repo](#2-two-systems-in-one-repo)
3. [Project Structure](#3-project-structure)
4. [Data Model & D1 Schema](#4-data-model--d1-schema)
5. [Social Posting Pipeline](#5-social-posting-pipeline)
6. [Scheduler (Cron Engine)](#6-scheduler-cron-engine)
7. [Token Management](#7-token-management)
8. [API Route Map](#8-api-route-map)
9. [SEO Override System](#9-seo-override-system)
10. [Media Upload Pipeline](#10-media-upload-pipeline)
11. [AI Draft Assist](#11-ai-draft-assist)
12. [Email System](#12-email-system)
13. [Analytics System](#13-analytics-system)
14. [Error Handling](#14-error-handling)
15. [Environment & Bindings](#15-environment--bindings)
16. [Anti-Patterns](#16-anti-patterns)

---

## 1. System Overview

```
+-------------------------------------------------------------------+
|                     Cloudflare Account                              |
|                                                                     |
|  +-----------------+  +--------------+  +------------------+       |
|  | CF Pages        |  | D1 Database  |  | R2 Bucket        |       |
|  | (uwc-marketing  |  | (agency-db)  |  | (agency-media)   |       |
|  |  -site)          |  |              |  |                  |       |
|  +-----------------+  +--------------+  +------------------+       |
|         |                    |                    |                  |
|  +-----------------+  +--------------+                              |
|  | Cron Worker     |  | KV Namespace |                              |
|  | (workers/cron)  |  | (RATE_LIMIT) |                              |
|  | */5 social      |  |              |                              |
|  | daily analytics |  +--------------+                              |
|  +-----------------+                                                |
|                                                                     |
|   +----------+  +---------+  +---------+  +------------+           |
|   | Resend   |  |Anthropic|  |Meta API |  |LinkedIn API|           |
|   | (email)  |  | (AI)    |  |(FB+IG)  |  |(Company)   |           |
|   +----------+  +---------+  +---------+  +------------+           |
|                                            +----------+            |
|                                            | GBP API  |            |
|                                            | (Google)  |            |
|                                            +----------+            |
+-------------------------------------------------------------------+
```

**Architecture:** Edge-first serverless. Public pages are Astro SSR + prerendered blog. Admin is React islands in Astro shells.
**Key difference from agency-admin:** This repo has TWO deployment targets — CF Pages (the site) and a standalone cron Worker (the scheduler).

---

## 2. Two Systems in One Repo

### System 1 — Public Marketing Site
Static-first Astro pages. Blog powered by Keystatic CMS (git-based, prerendered).
Contact form → CF Worker → Resend. SEO baked in via SEOHead component.

### System 2 — Marketing Admin (/marketing-admin/*)
Full content operations centre. React island components for rich interactivity.
Draft → AI assist → schedule → auto-post via cron → monitor.

**Why one repo?** They share the D1 schema (SEO overrides feed public pages), R2 bucket (media uploaded in admin, served on public site), and the same Astro build.

---

## 3. Project Structure

```
src/
├── lib/                              # Business logic
│   ├── email.ts                      # Resend: contact, welcome, lead magnet emails
│   ├── seo.ts                        # getSeoOverride() — D1 query
│   └── social/
│       ├── tokens.ts                 # AES-256-GCM encrypt/decrypt, store/retrieve, expiry checks
│       ├── meta.ts                   # Facebook Page + Instagram Business API
│       ├── linkedin.ts               # LinkedIn Company Page + token refresh
│       ├── gbp.ts                    # Google Business Profile + token refresh
│       └── scheduler.ts             # Cron engine: query due → post → update status
│
├── components/
│   ├── SEOHead.astro                 # Every public page — meta, OG, JSON-LD
│   └── marketing-admin/
│       ├── PostComposer.tsx          # Draft + AI + image upload + schedule (React)
│       ├── ContentCalendar.tsx       # Calendar view (React)
│       ├── DraftsList.tsx            # Draft management (React)
│       ├── PostDetail.tsx            # Post view/edit/retry (React)
│       ├── SeoEditor.tsx             # Per-page SEO CRUD (React)
│       ├── TrafficDashboard.tsx      # Analytics charts (React)
│       ├── DashboardStats.tsx        # Live stats (React)
│       └── TokenManager.tsx          # Platform connections (React)
│
├── pages/
│   ├── index.astro                   # Public landing page
│   ├── blog/[slug].astro            # Prerendered blog (Keystatic)
│   ├── marketing-admin/*.astro       # Admin pages (Astro shells for React islands)
│   ├── media/[...path].ts           # R2 media serve (cached)
│   └── api/
│       ├── contact.ts                # Public: Zod + KV rate limit + Resend
│       ├── social/cron.ts            # Cron endpoint (secret-protected)
│       └── marketing-admin/
│           ├── ai-draft.ts           # Anthropic claude-sonnet-4-6
│           ├── drafts.ts             # Content drafts CRUD
│           ├── schedule.ts           # Social post queue CRUD
│           ├── seo.ts                # SEO overrides CRUD
│           ├── stats.ts              # Dashboard stats
│           ├── tokens.ts             # Token status + store
│           ├── upload.ts             # Image → R2
│           └── post/[id].ts          # Single post detail + edit
│
workers/
└── cron/                             # Standalone cron Worker (separate deploy)
    ├── wrangler.toml                 # */5 social + daily analytics crons
    └── src/index.ts                  # Calls Pages API endpoints
```

---

## 4. Data Model & D1 Schema

### Entity Relationship

```
content_drafts (1) ---< social_posts (N)
                          |
social_tokens (1 per platform)
seo_pages (1 per path)
analytics_daily (1 per date)
```

### Table Summary

| Table | PK | Notable Columns | Indexes |
|-------|-----|----------------|---------|
| content_drafts | TEXT (hex UUID) | title, body, platforms_json, media_r2_keys_json, status, ai_generated | — |
| social_posts | TEXT | content_draft_id FK, platform, content, media_url, scheduled_at, status, retry_count, error_message, external_id | status, scheduled_at, platform, content_draft_id |
| social_tokens | TEXT | platform UNIQUE, access_token (encrypted), refresh_token (encrypted), expires_at, account_id | — |
| seo_pages | TEXT | path UNIQUE, title, description, og_image_r2_key, schema_json, noindex | path |
| analytics_daily | TEXT | date UNIQUE, page_views, unique_visitors, top_pages_json, source_json | — |

### Key design decisions

1. **One social_posts row per platform** — cross-platform posts create N rows with same content_draft_id, so each can fail/succeed independently
2. **Tokens encrypted at rest** — AES-256-GCM via Web Crypto API, never stored in plaintext
3. **SEO overrides are optional** — pages render fine without them (Keystatic/Astro defaults)
4. **Analytics snapshots are denormalized** — top_pages_json and source_json avoid JOIN complexity

---

## 5. Social Posting Pipeline

```
User drafts in /marketing-admin/compose
    |
    v (optional AI assist via Anthropic)
    |
    v (optional image upload to R2)
    |
Save to content_drafts (D1)
    |
    v
Schedule → creates N social_posts rows (one per platform)
    |
    v (every 5 min)
Cron Worker calls POST /api/social/cron
    |
    v
Scheduler (src/lib/social/scheduler.ts):
  1. Query due posts (scheduled_at <= now, status='scheduled' or failed with retry_count < 3)
  2. For each post:
     a. Get token (decrypt from D1)
     b. Refresh if expired (LinkedIn 60-day, GBP 1-hour)
     c. Resolve relative media URLs to absolute
     d. Call platform API (meta.ts / linkedin.ts / gbp.ts)
     e. On success: status='posted', external_id saved
     f. On failure: status='failed', retry_count++, error_message saved
  3. Return { processed, errors }
    |
    v (if errors)
Resend failure alert email
```

### Platform-specific notes

| Platform | Token Type | Refresh | Media Support |
|----------|-----------|---------|---------------|
| Facebook | Page Access Token | Never expires | Photo via URL |
| Instagram | Same as FB (Meta Graph) | Never expires | Photo required (container → publish) |
| LinkedIn | OAuth2 (60-day) | Refresh via token endpoint | Text only (media via /assets future) |
| GBP | Google OAuth2 (1-hour) | Refresh every hour | Text + CTA URL |

---

## 6. Scheduler (Cron Engine)

The scheduler is the most critical piece of business logic. It lives in `src/lib/social/scheduler.ts`.

### Query for due posts

```sql
SELECT * FROM social_posts
WHERE (status = 'scheduled' AND scheduled_at <= datetime('now'))
   OR (status = 'failed' AND retry_count < 3 AND scheduled_at <= datetime('now'))
ORDER BY scheduled_at ASC
LIMIT 10
```

### Retry logic

- Failed posts are retried up to 3 times (retry_count column)
- Each retry happens on the next cron cycle (5 min)
- After 3 failures, post stays as 'failed' permanently
- `error_message` captures the last failure reason

### Status transitions

```
draft → scheduled → posting → posted
                  ↘         ↗
                   → failed (retry_count < 3 → re-enters scheduled query)
                   → failed (retry_count >= 3 → terminal)
scheduled → cancelled (manual)
failed → scheduled (manual retry via admin UI)
```

---

## 7. Token Management

### Encryption at rest (AES-256-GCM)

```
plaintext token → PBKDF2 key derivation → AES-GCM encrypt → base64 → D1
D1 → base64 decode → AES-GCM decrypt → plaintext token → API call
```

Key derivation: `SOCIAL_TOKEN_ENCRYPTION_KEY` env var → PBKDF2 (100K iterations, SHA-256) → AES-256 key.

### Token lifecycle per platform

| Platform | Expires | Refresh Strategy |
|----------|---------|-----------------|
| Facebook | Never (Page Token) | No refresh needed |
| Instagram | Never (same as FB) | No refresh needed |
| LinkedIn | 60 days | `refreshLinkedInToken()` with client_id/secret |
| GBP | 1 hour | `refreshGoogleToken()` with client_id/secret |

### Expiry check functions

```typescript
isTokenExpired(expiresAt)           // true if past expiry
isTokenExpiringSoon(expiresAt, 5)   // true if within 5 min of expiry
isTokenExpiringSoon(expiresAt, 60)  // used in admin UI for "expiring soon" badge
```

---

## 8. API Route Map

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/contact` | Public | Contact form (Zod + KV rate limit + Resend) |
| GET | `/api/marketing-admin/stats` | CF Access | Dashboard stats from D1 |
| GET/POST/DELETE | `/api/marketing-admin/seo` | CF Access | SEO overrides CRUD |
| GET/POST/PUT | `/api/marketing-admin/drafts` | CF Access | Content drafts CRUD |
| GET/POST/DELETE | `/api/marketing-admin/schedule` | CF Access | Social post queue |
| POST | `/api/marketing-admin/ai-draft` | CF Access | AI content generation |
| POST | `/api/marketing-admin/upload` | CF Access | Image upload to R2 |
| GET/POST | `/api/marketing-admin/tokens` | CF Access | Token status + store |
| GET/PUT | `/api/marketing-admin/post/[id]` | CF Access | Single post detail + edit |
| POST | `/api/social/cron` | CRON_SECRET | Process due posts |
| GET | `/api/analytics/cf` | CF Access | CF Analytics GraphQL proxy |
| GET | `/api/analytics/ga4` | CF Access | GA4 snapshots from D1 |
| GET | `/media/*` | Public | R2 media serve (immutable cache) |

---

## 9. SEO Override System

```
Public page render (PublicLayout.astro)
    |
    v
getSeoOverride(db, pathname)  →  D1 seo_pages lookup
    |
    ├── Found: use D1 title/description/schema/noindex
    └── Not found: use Astro prop defaults (from Keystatic frontmatter)
    |
    v
SEOHead.astro renders <title>, <meta>, <script type="application/ld+json">
```

**Prerendered pages (blog):** D1 is unavailable at build time. Blog pages use Keystatic frontmatter only. SEO overrides only apply to SSR pages.

---

## 10. Media Upload Pipeline

```
PostComposer (browser) → multipart FormData
    |
    v
POST /api/marketing-admin/upload
    |
    v
1. Validate type (JPEG/PNG/GIF/WebP only)
2. Validate size (max 10MB)
3. Generate R2 key: social/YYYY-MM/uuid.ext
4. Upload to R2 bucket
5. Return absolute URL: {SITE_URL}/media/social/YYYY-MM/uuid.ext
    |
    v
GET /media/social/YYYY-MM/uuid.ext (public, immutable cache)
    |
    v
Platform API fetches image from this URL when posting
```

---

## 11. AI Draft Assist

```
User enters prompt + selects platform
    |
    v
POST /api/marketing-admin/ai-draft
    |
    v
System prompt: SC-focused copywriter for Upstate Web Co.
Platform-aware output guidelines (FB: paragraphs, IG: caption + hashtags)
    |
    v
Anthropic API (claude-sonnet-4-6, max 1024 tokens)
    |
    v
{ draft: "generated text" } → PostComposer populates content field
```

---

## 12. Email System

| Email Type | Trigger | Recipient |
|-----------|---------|-----------|
| Contact inquiry | Public form submission | hello@upstate-web.com |
| Welcome subscriber | Email signup | Subscriber |
| Lead magnet delivery | Checklist download | Subscriber |
| Cron failure alert | Social post fails | ALERT_EMAIL env var |

Fire-and-forget: email failures never block the primary operation.

---

## 13. Analytics System

### Dual-source architecture

| Source | What it provides | Storage |
|--------|-----------------|---------|
| CF Analytics | Raw requests, page views, uniques (no cookies) | CF API (queried live) |
| GA4 | User journeys, conversions, goals | analytics_daily (D1 snapshots) |

The TrafficDashboard component shows both in one view. Daily analytics cron (2am) snapshots GA4 data into D1.

---

## 14. Error Handling

### API response patterns

```typescript
// Success
Response.json({ ok: true, draft: row })
Response.json({ posts: results })

// Error
Response.json({ error: 'message' }, { status: 4xx })
Response.json({ error: 'message' }, { status: 500 })

// Validation
Response.json({ error: 'Validation failed', issues: zodIssues }, { status: 400 })

// Cron
Response.json({ processed: 3, errors: ['Post sp1: token expired'] })
```

Server-side: `console.error('[endpoint] Error:', err)` — never expose stack traces.

---

## 15. Environment & Bindings

### wrangler.toml bindings

```toml
[[d1_databases]]
binding = "DB"                    # Shared agency-db
database_name = "agency-db"

[[r2_buckets]]
binding = "MEDIA"                 # Social media images

[[kv_namespaces]]
binding = "RATE_LIMIT"            # Contact form rate limiting
```

### Secrets (CF Pages dashboard)

| Variable | Used By | Required |
|----------|---------|----------|
| `RESEND_API_KEY` | email.ts | Yes |
| `ANTHROPIC_API_KEY` | ai-draft.ts | Yes |
| `SOCIAL_TOKEN_ENCRYPTION_KEY` | tokens.ts | Yes |
| `CRON_SECRET` | cron.ts | Yes |
| `CF_ANALYTICS_TOKEN` | cf.ts | For analytics |
| `CF_ZONE_ID` | cf.ts | For analytics |
| `LINKEDIN_CLIENT_ID/SECRET` | linkedin.ts | For LinkedIn refresh |
| `GOOGLE_CLIENT_ID/SECRET` | gbp.ts | For GBP refresh |

---

## 16. Anti-Patterns

```
NEVER call social platform APIs from browser  → tokens are secrets, Workers only
NEVER store OAuth tokens in env vars          → use D1 (encrypted), env has app credentials only
NEVER use setTimeout for scheduled posts      → CF Workers Cron Triggers only
NEVER skip token encryption                   → all tokens AES-256-GCM encrypted in D1
NEVER concatenate SQL strings                 → use .bind() prepared statements
NEVER expose tokens in GET /tokens response   → return status/expiry only, never token values
NEVER hardcode SITE_URL                       → use env.SITE_URL (changes when custom domain connected)
NEVER serve media through Workers buffer      → R2 streams directly via /media/* route
NEVER mix Keystatic content with D1 data      → Keystatic = blog/cases, D1 = social/SEO/analytics
NEVER edit applied migration files            → create new numbered migration
```

---

*Backend Architecture v1.0 | 2026-03-24*

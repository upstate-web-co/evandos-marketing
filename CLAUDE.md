# CLAUDE.md — uwc-marketing-site

> Auto-loaded by Claude Code at every session start.
> Code-only. For business operations see `../uwc-agency-admin/BUSINESS.md`.
> Legal/compliance: `../LEGAL_COMPLIANCE.md` (shared plan for privacy/terms refresh + cookie consent banner + CCPA/GDPR scope). Existing `src/pages/privacy.astro` needs update per that plan.
> NEVER shrink this file. Only add. This file will grow significantly.

---

## Stack — Exact Versions

```
Framework:     Astro 5.x         (output: server, adapter: cloudflare)
Runtime:       Cloudflare Pages + Workers + Cron Triggers
Database:      Cloudflare D1     (binding: DB — marketing tables + shared clients)
Storage:       Cloudflare R2     (binding: MEDIA — social media images, blog images)
Auth:          Cloudflare Access (/marketing-admin/* only — your email)
CMS:           Keystatic         (git-based — blog posts, case studies, page content)
AI Drafting:   Anthropic API     (claude-sonnet-4-6 — content draft assist)
Email:         Resend            (contact form responses)
Analytics:     CF Analytics API + GA4 Measurement Protocol
Styling:       Tailwind CSS 4.x
Language:      TypeScript 5.x    (strict: true)
Testing:       Vitest 4.x + better-sqlite3 (D1 mock)
Deploy:        GitHub → CF Pages CI
```

### Social Platform APIs
```
Meta Graph API    v21.0  — Facebook Page + Instagram Business (same token)
LinkedIn API      v2     — Company Page posts
Google Business   v1     — My Business API (GBP posts, Q&A)
```

---

## Architecture: Two Distinct Systems in One Repo

### System 1 — Public Marketing Site
Static-first Astro pages. Keystatic CMS for editable content (blog, case studies, service pages).
Contact form → CF Worker → Resend. SEO baked in via SEOHead component.

### System 2 — Marketing Admin (CF Access protected)
Full content operations centre at `/marketing-admin/*`.
- Draft posts → AI assist → schedule → auto-post via Workers
- SEO editor per page
- Traffic dashboard (CF Analytics + GA4)
- Content calendar across all platforms

**The admin is a separate section of the same Astro build, not a separate app.**

---

## Rules

### 1. All social API calls happen in Workers — never in the browser
Social platform tokens are secrets. They NEVER touch the browser. All social posting, token refresh, and analytics fetching happens in CF Workers only.

```typescript
// ALWAYS: browser calls your Worker
fetch('/api/social/post', { method: 'POST', body: JSON.stringify({ postId }) })

// NEVER: browser calls Meta directly
fetch('https://graph.facebook.com/...', { headers: { Authorization: `Bearer ${token}` } })
```

### 2. Social tokens are stored encrypted in D1 — never in env vars
OAuth2 tokens for social platforms change frequently (refresh cycles). Store in `social_tokens` D1 table. Env vars hold the APP credentials (client_id, client_secret) — not the user tokens.

```typescript
// social_tokens table stores:
// access_token (encrypted), refresh_token (encrypted), expires_at, platform, account_id
// Encrypt/decrypt using a SOCIAL_TOKEN_ENCRYPTION_KEY env var (CF Pages secret)
```

### 3. Scheduled posting uses CF Workers Cron — not setTimeout, not external cron services
```toml
# wrangler.toml
[triggers]
crons = ["*/5 * * * *"]  # every 5 minutes — check for posts due
```

The cron Worker queries D1 for posts where `scheduled_at <= now() AND status = 'scheduled'`, posts them, updates status to `posted` or `failed`.

### 4. Keystatic manages all public content — marketing-admin manages all social/SEO/analytics
These are separate concerns. Keystatic files live in `/content/` (git-based). Marketing admin data lives in D1.

**Keystatic content:**
- Blog posts (`/content/blog/*.md`)
- Case studies (`/content/work/*.md`)
- Service page copy (`/content/services/*.md`)

**D1 marketing admin data:**
- Social post drafts and scheduled queue
- Social platform tokens
- SEO overrides (title, description per non-Keystatic page)
- Analytics snapshots

### 5. AI drafting calls the Anthropic API from a Worker — never from the browser
```typescript
// src/pages/api/marketing-admin/ai-draft.ts
export async function POST({ request, locals }: APIContext) {
  const { ANTHROPIC_API_KEY } = locals.runtime.env
  // Call Anthropic API server-side
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await response.json()
  return Response.json({ draft: data.content[0].text })
}
```

### 6. SEO: SEOHead component on every public page — no exceptions
```typescript
// src/components/SEOHead.astro — used in every layout
// Props: title, description, ogImage, canonicalUrl, schema (JSON-LD object)
// SEO overrides from D1 take precedence over Keystatic frontmatter
```

### 7. Sitemap auto-generated from Astro routes + Keystatic content
Use `@astrojs/sitemap` integration. Dynamic paths (blog slugs, case study slugs) registered via `getStaticPaths`. Never manually maintain a sitemap.

### 8. Contact form rate-limited by IP — CF Workers KV for rate limit state
```typescript
// Use CF Workers KV (binding: RATE_LIMIT) to track submissions per IP
// Allow: 3 contact form submissions per IP per hour
// Return 429 if exceeded
```

### 9. CF Analytics vs GA4 — use both, serve different purposes
- CF Analytics: raw request data, available in CF dashboard and via API. Privacy-preserving (no cookies).
- GA4: user journey, conversion tracking, goal completions. Requires GA4 snippet on public pages.
- Marketing admin shows both in one dashboard — don't conflate the metrics.

### 10. Meta Graph API — always use page-scoped tokens, not user tokens
Post to Facebook Page and Instagram Business Account using a Page Access Token, not a User Access Token. Page Access Tokens don't expire (unless revoked). Store in social_tokens table.

### 11. LinkedIn — use organization token, not personal profile token
You post as the company page (Upstate Web Co.), not your personal LinkedIn. Use the Organization Access Token from LinkedIn API.

### 12. GBP posts use Google OAuth2 — token refreshes every hour
```typescript
// GBP access tokens expire in 1 hour. Always check expires_at before using.
// If expired, call refresh endpoint with refresh_token and update social_tokens table.
```

### 13. Content calendar in D1 — one row per scheduled post
```sql
-- social_posts table: one row = one post to one platform
-- For cross-platform posts: create one row per platform, same content_draft_id
-- This lets platforms fail/succeed independently
```

### 14. Marketing admin routes require CF Access — public routes do not
```
PUBLIC (no auth needed):
/                → landing page
/blog/**         → blog
/work/**         → case studies (6 projects)
/services        → services
/about           → about
/faq             → frequently asked questions
/checklist       → free website audit checklist (lead magnet)
/contact         → contact
/get-started     → multi-step intake form

PROTECTED (CF Access — your email):
/marketing-admin/**    → entire marketing ops section
/keystatic/**          → Keystatic CMS editor
```

### 15. Media uploads go to R2, served via /media/* route
```
Upload: POST /api/marketing-admin/upload (multipart, JPEG/PNG/GIF/WebP, max 10MB)
Storage: R2 bucket MEDIA, key = social/YYYY-MM/uuid.ext
Serve:   GET /media/social/YYYY-MM/uuid.ext (catch-all route, immutable cache)
URL:     Absolute — https://uwc-marketing-site.pages.dev/media/social/...
```
Platform APIs (Instagram, Facebook) fetch images from the absolute URL.
The scheduler resolves any relative media_url to absolute using SITE_URL before posting.
No separate R2 custom domain — Pages handles serving.

### 16. Keystatic deployment: every content save triggers a CF Pages rebuild
Keystatic commits to GitHub → GitHub Actions webhook → CF Pages rebuild.
Expected rebuild time: ~45 seconds. Acceptable for a blog CMS.

---

## Rules 17–23 (Added via Cross-Project Audit)

### 17. All API routes must use Zod validation — no inline if-checks
Every POST/PUT/DELETE handler MUST use a Zod schema from `src/lib/schemas.ts`.
Error response: `{ error: 'Validation failed', code: 'VALIDATION_ERROR', issues: [...] }`
NEVER use inline `if (!field)` checks for validation — Zod is the authoritative gate.

### 18. Error responses must include a machine-readable code
ALL error responses MUST include a `code` field alongside `error`:
```typescript
return Response.json({ error: 'Human message', code: 'MACHINE_CODE' }, { status: 4xx })
```
Standard codes: `VALIDATION_ERROR`, `NOT_FOUND`, `UNAUTHORIZED`, `DB_NOT_CONFIGURED`,
`AI_SERVICE_ERROR`, `UPLOAD_FAILED`, `DAILY_LIMIT_REACHED`, `RATE_LIMITED`

### 19. Never use `any` type — use typed helpers
NEVER cast `(locals as any)`. Use `getEnv(locals)` from `src/lib/env.ts`.
Use types from `src/types/index.ts` for D1 rows. Use `Zod parsed.data` for validated input.

### 20. Extract at 3 — components and constants
If a UI pattern appears 3+ times, extract to `src/components/`.
If a constant (status colors, platform labels) appears in 2+ files, extract to `src/lib/constants.ts`.
Extracted components: `AlertMessage.tsx`, `StatusBadge.tsx`.
Extracted constants: `STATUS_STYLES`, `PLATFORM_LABELS`, `PLATFORM_CHAR_LIMITS`, `ERROR_CODES`.

### 21. Every bug gets a regression test
When a bug is found (BUG-NNN), write a test that reproduces it BEFORE fixing.
The test must fail before the fix, pass after.

### 22. Pre-commit checks
```bash
npm test                                       # all 133 tests pass
grep -rE 'console\.log|debugger' src/          # no debug code in source
grep -rE 'sk-ant|re_|SOCIAL_TOKEN' src/        # no secrets in source
```

### 23. Dates are always UTC ISO strings
All dates in D1 use `datetime('now')` (UTC). Token `expires_at` compared with `new Date().toISOString()`.
Display conversion to local time happens in the browser only. Never store local times.

---

## Social Platform Integration Details

### Meta (Facebook + Instagram)
```
App type:       Business App
Permissions:    pages_manage_posts, instagram_content_publish, pages_read_engagement
Token type:     Page Access Token (never expires unless revoked)
API base:       https://graph.facebook.com/v21.0/
Post to FB:     POST /{page-id}/feed
Post to IG:     POST /{ig-account-id}/media + POST /{ig-account-id}/media_publish
Media:          Must upload to IG container first, then publish
```

### LinkedIn
```
App type:       Company App
Permissions:    w_organization_social, r_organization_social
Token type:     OAuth2 — expires in 60 days, must refresh
API base:       https://api.linkedin.com/v2/
Post:           POST /ugcPosts (text) or /assets (media)
Org ID:         urn:li:organization:{your-org-id}
```

### Google Business Profile
```
App type:       Google Cloud project
Permissions:    mybusiness.manage
Token type:     OAuth2 — expires in 1 hour, must refresh with refresh_token
API base:       https://mybusiness.googleapis.com/v4/
Post (GBP post): POST /accounts/{account}/locations/{location}/localPosts
```

---

## File Structure (actual, as of 2026-03-24)

```
uwc-marketing-site/
├── CLAUDE.md
├── PROJECT_STATE.md
├── CONVENTIONS.md
├── LESSONS.md
├── TESTING.md
├── vitest.config.ts
├── .claude/
│   ├── memory/
│   │   ├── MEMORY.md
│   │   ├── database_schema.md          ← D1 tables + columns + indexes
│   │   ├── social_media_apis.md        ← platform API patterns, token management
│   │   ├── seo_management.md           ← SEOHead, sitemap, schema patterns
│   │   ├── content_ops.md              ← content calendar, drafting, AI assist
│   │   ├── analytics_traffic.md        ← CF Analytics + GA4 patterns
│   │   ├── feedback_workflow.md        ← user workflow preferences
│   │   ├── keystatic_cms.md            ← Keystatic config, content collections
│   │   ├── lessons_learned.md          ← patterns + pitfalls
│   │   └── bug_history.md
│   └── commands/
│       ├── new-blog-post.md            ← /new-blog-post
│       ├── schedule-social.md          ← /schedule-social
│       └── seo-audit.md                ← /seo-audit
├── docs/
│   └── architecture/
│       ├── README.md                  ← architecture doc index + reading order
│       ├── BACKEND_ARCHITECTURE.md    ← social pipeline, scheduler, tokens, media, AI
│       ├── FRONTEND_ARCHITECTURE.md   ← public SSR + Keystatic + React island admin
│       ├── SECURITY_ARCHITECTURE.md   ← token encryption, cron auth, OWASP
│       ├── DEPLOYMENT_ARCHITECTURE.md ← dual deploy (Pages + cron Worker)
│       ├── TESTING_ARCHITECTURE.md    ← D1 mock, scheduler mocking, test pyramid
│       └── AUDIT_GAPS.md             ← DSA audit: both repos, prioritized gaps
├── tests/
│   ├── token-utils.test.ts            ← pure function tests (14 tests)
│   ├── validation.test.ts            ← contact + admin validation (45 tests)
│   ├── scheduler.test.ts             ← scheduler with mocked APIs (15 tests)
│   └── d1/
│       ├── setup.ts                   ← D1 mock (better-sqlite3 + ?N conversion)
│       ├── seo.test.ts               ← SEO override CRUD (12 tests)
│       ├── drafts.test.ts            ← content drafts patterns (5 tests)
│       ├── social-posts.test.ts      ← scheduling + cron queries (12 tests)
│       ├── admin-stats.test.ts       ← dashboard stats queries (5 tests)
│       ├── post-detail.test.ts       ← JOIN + dynamic PUT (7 tests)
│       ├── schedule-query.test.ts    ← calendar query + constraints (8 tests)
│       └── token-status.test.ts      ← token metadata + analytics (10 tests)
├── content/                            ← Keystatic content (git-based)
│   ├── blog/                           ← 6 published blog posts
│   └── work/                           ← 6 case study pages (liveUrl + screenshots fields)
│       ├── chama-saas-migration/       ← MyChama SaaS (mychama.app)
│       ├── shira-brand-website/        ← Shira professional services (shira.farm)
│       ├── uwc-marketing-platform/     ← UWC marketing tools (draft — hidden from site)
│       ├── peach-thread-boutique/      ← Peach & Thread e-commerce boutique
│       ├── fade-cuts-barbershop/       ← Fade House barbershop + booking
│       └── lookaround-home-services/   ← LookAround Landscappers landscaping/HVAC/plumbing
├── migrations/
│   ├── 0001_marketing_schema.sql       ← 5 tables + indexes
│   ├── 0002_add_retry_count.sql        ← retry_count on social_posts
│   ├── 0003_indexes_ai_flag_history.sql ← perf indexes + ai_generated + content_history_json
│   ├── 0004_nurture_contact_submissions.sql ← nurture tracking + contact_submissions table
│   └── 0005_subscriber_industry.sql    ← industry column for newsletter categorization
├── workers/
│   └── cron/                           ← standalone cron Worker (separate deploy)
│       ├── wrangler.toml               ← */5 social + daily analytics + daily nurture crons
│       └── src/index.ts                ← calls Pages API endpoints (social, nurture)
├── src/
│   ├── types/
│   │   └── index.ts                    ← TypeScript interfaces for all D1 tables
│   ├── middleware.ts                    ← CF Access + CSP + security headers
│   ├── styles/global.css               ← Tailwind v4 entrypoint
│   ├── components/
│   │   ├── SEOHead.astro               ← SEO meta + JSON-LD + noindex
│   │   ├── TrackingPixels.astro        ← Meta Pixel + Google Ads (consent-gated, GDPR-compliant)
│   │   ├── TestimonialCard.astro       ← reusable client quote card
│   │   ├── ExitIntentPopup.astro       ← lead magnet popup (desktop mouse + mobile scroll)
│   │   ├── MicroConversions.astro      ← GA4 micro-events (tier clicks, FAQ, scroll depth)
│   │   ├── marketing-admin/AlertMessage.tsx  ← reusable success/error banner (role="alert")
│   │   ├── marketing-admin/StatusBadge.tsx   ← reusable status badge (uses constants.ts)
│   │   └── marketing-admin/
│   │       ├── ContentCalendar.tsx      ← grouped by date, links to detail, cancel
│   │       ├── DashboardStats.tsx       ← live stats from D1
│   │       ├── DraftsList.tsx           ← list, edit, archive, schedule drafts
│   │       ├── PostComposer.tsx         ← draft + AI assist + image upload + schedule
│   │       ├── PostDetail.tsx           ← full view, edit, reschedule, retry, cancel
│   │       ├── SeoEditor.tsx            ← CRUD editor for seo_pages
│   │       ├── TokenManager.tsx         ← connect/update platform tokens
│   │       └── TrafficDashboard.tsx     ← bar chart, stat cards, period selector
│   ├── layouts/
│   │   ├── PublicLayout.astro           ← nav, footer, SEO override from D1
│   │   └── MarketingAdminLayout.astro   ← dark theme, sidebar, mobile menu
│   ├── lib/
│   │   ├── constants.ts                  ← STATUS_STYLES, PLATFORM_LABELS, ERROR_CODES
│   │   ├── email.ts                     ← Resend + nurture (7 steps) + brandedEmailWrapper()
│   │   ├── env.ts                       ← getEnv() typed helper (no more `any` casts)
│   │   ├── schemas.ts                   ← 16 Zod schemas for ALL API routes (including AI)
│   │   ├── seo.ts                       ← getSeoOverride (D1 query)
│   │   └── social/
│   │       ├── tokens.ts                ← AES-256-GCM encrypt/decrypt, store/retrieve
│   │       ├── meta.ts                  ← Facebook Page + Instagram Business
│   │       ├── linkedin.ts              ← LinkedIn org posts + refresh
│   │       ├── gbp.ts                   ← Google Business Profile + refresh
│   │       └── scheduler.ts             ← cron: query due → post → update status
│   └── pages/
│       ├── index.astro                  ← landing page (stats, testimonials, featured work, process video)
│       ├── services.astro               ← 3 tiers + retainers + testimonials
│       ├── about.astro
│       ├── contact.astro
│       ├── faq.astro                    ← 12 FAQ items, accordion, FAQPage JSON-LD
│       ├── checklist.astro              ← 5-point website audit (replaces PDF lead magnet)
│       ├── privacy.astro                ← privacy policy (DSA/GDPR compliance)
│       ├── get-started.astro            ← multi-step intake form
│       ├── work/index.astro             ← case study grid (5 published projects)
│       ├── work/[slug].astro            ← case study template + mobile phone mockup
│       ├── blog/
│       │   ├── index.astro              ← prerendered
│       │   └── [slug].astro             ← prerendered
│       ├── marketing-admin/
│       │   ├── index.astro              ← admin dashboard + live stats
│       │   ├── compose.astro            ← PostComposer
│       │   ├── calendar.astro           ← ContentCalendar
│       │   ├── drafts.astro             ← DraftsList
│       │   ├── post/[id].astro          ← PostDetail
│       │   ├── seo.astro                ← SeoEditor
│       │   ├── analytics.astro          ← TrafficDashboard
│       │   ├── subscribers.astro        ← subscriber list + subject line generator
│       │   ├── broadcast.astro          ← broadcast compose + test + AI assist
│       │   ├── emails.astro             ← email log/history
│       │   ├── blog-ideas.astro         ← AI blog idea generator
│       │   └── tokens.astro             ← TokenManager (social connections)
│       ├── media/
│       │   └── [...path].ts             ← R2 media serve (cached, immutable)
│       └── api/
│           ├── contact.ts               ← Zod validation + KV rate limit + Resend + D1 storage
│           ├── subscribe.ts             ← newsletter signup + nurture tracking
│           ├── unsubscribe.ts           ← HMAC token unsubscribe
│           ├── nurture-send.ts          ← process due nurture emails (cron-protected)
│           ├── social/
│           │   └── cron.ts              ← POST: process due posts (secret-protected)
│           ├── broadcast.ts              ← POST: send broadcast to all subscribers (batched)
│           ├── ai-broadcast-draft.ts    ← POST: AI-generated broadcast email draft
│           ├── marketing-admin/
│           │   ├── ai-draft.ts          ← POST: Anthropic claude-sonnet-4-6
│           │   ├── drafts.ts            ← GET/POST/PUT: Zod-validated drafts CRUD
│           │   ├── schedule.ts          ← GET/POST/DELETE: Zod + daily limit + ai_generated
│           │   ├── seo.ts               ← GET/POST/DELETE: Zod-validated SEO CRUD
│           │   ├── stats.ts             ← GET: dashboard stats (drafts count, not subscribers)
│           │   ├── tokens.ts            ← GET/POST/DELETE: Zod + token disconnect
│           │   ├── upload.ts            ← POST: image upload to R2
│           │   └── post/[id].ts         ← GET/PUT: single post detail + edit
│           └── analytics/
│               ├── cf.ts                ← CF Analytics GraphQL proxy
│               └── ga4.ts               ← analytics_daily from D1
├── keystatic.config.ts
├── astro.config.mjs
├── tsconfig.json
└── wrangler.toml
```

---

## Bug History

```
BUG-001 (fixed): Migration missing idx_social_posts_draft_id index
BUG-002 (fixed): MEMORY.md had wrong D1 database_id
BUG-003 (fixed): Blog pages 500 on production — createReader needs filesystem
BUG-004 (fixed): KV namespace ID was placeholder, not real
BUG-005 (fixed): CF Pages rejects [triggers] — cron needs standalone Worker
BUG-006 (fixed): `npx wrangler deploy` fails on Pages — use `wrangler pages deploy dist`
BUG-007 (open):  CF Access multi-path app only protects first path entry
BUG-008 (fixed): /api/marketing-admin/* routes were publicly accessible
  Middleware only checked /marketing-admin, not /api/marketing-admin.
  Fix: Added /api/marketing-admin to isAdmin check in middleware.
BUG-009 (fixed): CF Access JWT cookie not decoded — 401 after login
  CF Access on Pages sets CF_Authorization JWT cookie, not the header.
  Fix: Added getAuthEmail() fallback to decode JWT from cookie.
BUG-010 (fixed): Chatbot intake submissions silently rejected by anti-spam
  _loaded_at was set to Date.now() at submit time instead of page load, so
  the 3-second timing check always triggered. Server returned 200 OK (silent
  accept for bots) — frontend showed "submitted!" but nothing was saved.
  Fix: Capture Date.now() on component mount via useRef. Also hardened prompt
  to require email before [INTAKE_COMPLETE] and added client-side guard.
```

See PROJECT_STATE.md for full details on each bug.

---

## Environment Variables (CF Pages Secrets)

```
Required for full functionality:
  RESEND_API_KEY              — contact form email delivery
  ANTHROPIC_API_KEY           — AI draft assist
  SOCIAL_TOKEN_ENCRYPTION_KEY — AES-256-GCM key for social token encryption
  CRON_SECRET                 — shared secret between cron Worker and Pages API

Required for analytics:
  CF_ANALYTICS_TOKEN          — Cloudflare Analytics API bearer token
  CF_ZONE_ID                  — Cloudflare zone ID for analytics queries

Required for social posting (app credentials, not user tokens):
  LINKEDIN_CLIENT_ID          — LinkedIn OAuth2 app
  LINKEDIN_CLIENT_SECRET
  GOOGLE_CLIENT_ID            — Google OAuth2 app (for GBP)
  GOOGLE_CLIENT_SECRET

Vars (wrangler.toml, not secrets):
  SITE_URL                    — absolute base URL for media (https://upstate-web.com)
  ENVIRONMENT                 — "production"

Optional:
  ALERT_EMAIL                 — email for cron failure alerts (cron Worker)
  R2_PUBLIC_URL               — override media base URL (if using R2 custom domain)
```

---

## Testing

```
Runner:        Vitest 4.x (globals: true)
D1 Mock:       better-sqlite3 in-memory (real migrations applied, ?N placeholder conversion)
Mocking:       vi.mock for external APIs (social platforms, Anthropic)
Test count:    133 tests across 10 files
Run:           npm test (single pass) | npm run test:watch (watch mode)
```

See TESTING.md for full plan. See docs/architecture/TESTING_ARCHITECTURE.md for patterns.

---

## Architecture Documentation

```
docs/architecture/
├── README.md                  ← index + reading order
├── BACKEND_ARCHITECTURE.md    ← social pipeline, scheduler, tokens, media
├── FRONTEND_ARCHITECTURE.md   ← public SSR + Keystatic + React islands
├── SECURITY_ARCHITECTURE.md   ← token encryption, cron auth, OWASP
├── DEPLOYMENT_ARCHITECTURE.md ← dual deploy (Pages + cron Worker)
├── TESTING_ARCHITECTURE.md    ← D1 mock, scheduler mocking, test pyramid
├── AUDIT_GAPS.md              ← DSA audit: data structures + compliance gaps
├── FRONTEND_AUDIT.md          ← page-by-page frontend + a11y audit
└── RULES_PATTERNS_AUDIT.md    ← cross-project rules + modular design audit
```

See also: `../docs/architecture-overview.md` (cross-repo), `../docs/shared-*.md` (shared infra).

---

## Hooks (.claude/settings.json)

```
PostToolUse → TodoWrite: When all todos are completed, injects a reminder
  to update CLAUDE.md, PROJECT_STATE.md, and MEMORY.md before starting new work.
```

---

## Rule Enforcement Status

```
Rule 17 (Zod on all routes):     11/11 API route files use safeParse()     ✅ 0 violations
Rule 18 (error codes):           0 error responses without code field      ✅ 0 violations
Rule 19 (no any):                0 (locals as any) in API routes           ✅ 0 violations
Rule 20 (extract at 3):          AlertMessage used in 6 components         ✅ 0 inline duplicates
                                 StatusBadge + constants.ts wired          ✅ 0 inline duplicates
```

## Related Projects & Docs

```
../video-pipeline/                     ← Playwright + Remotion video generation (separate git repo)
  LESSONS.md                           ← Playwright gotchas, Remotion patterns, macOS FFmpeg workaround
  Renders: product stills (output/stills/), videos (output/*.mp4)
  Captures: screen recordings (captures/), mobile screenshots (captures/mobile-stills/)
  Homepage video: public/media/videos/process-desktop.mp4 ← rendered from ProcessStatic composition
  Mobile mockups: public/images/work/mobile/*.png ← 3x retina Playwright captures

../uwc-agency-admin/BUSINESS.md        ← Company operations brain (pricing, lifecycle, skills, templates)
  Section 7:  Pricing tiers — must match services.astro ($750/$1800/$3500 + retainers)
  Section 12: Project lifecycle — contact form (step 1) feeds into agency-admin
  Section 13: Skills inventory — 61 skills across 12 categories (see BUSINESS.md for full list)
  Section 15: Slash commands — /new-client, /new-project, /run-retro (agency-admin)
```

---

*CLAUDE.md version: 3.14 | Updated: 2026-04-24 (Session 2B — public chat persona refresh: tiers / portfolio / stack / differentiators moved from hardcoded prompts into the live-context bundle)*
*v3.14: Part of admin's Phase 2 agent-context refresh (see admin v5.65).
Closes the drift identified in
`../uwc-agency-admin/.claude/plans/agent-drift-table-2026-04-24.md`
where the 4 chat personas (default / public / intake / agent_claude)
carried hardcoded values that had aged out since ~2026-04-14:
- Portfolio list missing Carl's Stock-Out, Clinker Brewing, Hale
  Industrial, Rivven Health (née Omni-thera, renamed per Rule 47),
  Brisk Partners (née Chen Leadership).
- Tier pricing hardcoded inline; `spark` tier (shipped 2026-04-06
  admin-side) missing from intake site_type enum.
- Process wording "Discovery → Proposal → Build → Review → Launch"
  websites-only; missing maintenance; apps entirely missed the
  3-gate pipeline (Rule 50 Prototype / MVP / Launch).
- Tools list omitted Fly.io; agent_claude still listed Django +
  Hetzner when Fly.io is now default for apps (Rule 66).
- No mention of the Rule 73 automated design-direction pipeline as
  a differentiator when prospects ask "how are you different from
  Squarespace / Wix / Lovable".

Fix shape — moved drifting values into the live-context bundle so
the refresh script is the single source of truth (Rule 24):
- `scripts/refresh-chat-context.sh` now emits 5 new fields beside
  the existing summary/portfolio/currentWork/recentGovernance: tiers
  (Spark + Starter + Business + Store + Custom App with ranges,
  timelines, scope notes), processes (website vs. app as separate
  strings; app carries the 3-gate pipeline), stack (websites + apps
  with Fly.io listed first), differentiators (5 one-liners covering
  automated design-direction pipeline, 3-gate app workflow, self-
  serve client portal per Rule 57, 10-agent governance, hand-coded
  client-owned code), launchedOn ('April 7, 2026').
- `src/lib/chat-context.ts` ContextData interface extended with all
  5 as optional fields for back-compat — a stale
  chat-context-data.json without these degrades gracefully.
  `buildContextBlock` emits 5 new sections (Service tiers, Process,
  Stack, Differentiators, Launch date) into the "--- LIVE CONTEXT ---"
  block appended to every persona system prompt.
- `src/pages/api/chat.ts` personas rewritten to reference LIVE
  CONTEXT explicitly rather than carrying inline copies. `default`
  dropped the hardcoded portfolio + tiers + process; now instructs
  "quote only from the LIVE CONTEXT block." `public` gained a
  differentiators referral block so the About page voice cites
  specific wins instead of generic "we care more" language; Fly.io
  added to tools. `intake` got `spark` added to site_type enum +
  per-tier routing guidance (spark = rapid single-page, starter =
  3-5 page polished, business = multi-page with booking, store =
  e-commerce, app = Django + React custom). Budget-range low bound
  lowered to under_500 to catch Spark prospects. `agent_claude`
  listed Fly.io first for apps + added 3-gate paragraph + Rule 73
  differentiator.

Commit: `7bdffda` on main (4 files, +199/-32). CF Pages auto-deploys
on push. Verification: Vite bundle compiled clean (22.47s); Astro
prerender fails on pre-existing blog-schema bug (held draft
`content/blog/ai-workbench-the-category-with-no-name/index.mdoc`,
`audience` key not in schema — flagged in admin memory
todo_held_drafts_to_review.md, unrelated) — CF Pages builds have
historically tolerated the file.

Not in scope (deferred per the audit): no refactor of cache or
streaming path; no unit tests (marketing chat has no coverage today);
no cross-repo import of admin's TIER_PRICING knowledge bundle —
refresh script stays the single authority; admin's bundle can drift
forward and marketing refreshes catch up per deploy.*

*CLAUDE.md version: 3.13 | Updated: 2026-04-18 (night, parallel tracks coordination)*
*v3.13: Coordination note for parallel sessions (no marketing code change in
this commit). Multiple concurrent tracks running across UWC tonight —
authoritative coordination lives in admin repo `TRACK_CHARTER.md` at
`uwc-agency-admin/TRACK_CHARTER.md`. Marketing site is only a touchpoint
for Track D (Wave B distribution): D3 landing page + 60-sec install demo
for `@upstate-web/uwc-skills` npm package. D3 is on branch
`wave-b-d3-skills-landing` in this repo.

Parallel tracks running in adjacent repos (non-marketing, for awareness):
- Track W (walkthrough closures) — admin + portal. 5/5 items shipped in
  one session. PRs admin#13 + portal#2 open. Closes 8 walkthrough gaps.
- Track H (admin hygiene) — admin-only. H4 + H5 seen in flight on the
  primary admin checkout tonight.
- Track D items D1 + D2 already shipped (skills npm package v0.1.0 +
  MCP server scaffolding). D3 (this repo) is the next D item.

Pre-session checklist for any marketing work: read
`uwc-agency-admin/TRACK_CHARTER.md` §F. Most relevant sections for a
marketing session: §C.1 worktree policy (use a worktree if another
session might touch the same file) and §E friction log.

No marketing CLAUDE.md rule changes in this commit — this is purely a
version-history pointer so fresh sessions in this repo see the
coordination contract exists in admin.*

*CLAUDE.md version: 3.12 | Updated: 2026-04-16*
*v3.12: Infrastructure cost language cleanup — removed "$0 hosting", "near-zero",
"pennies per conversation", "Cloudflare free tier", "hosted for free" from 12 files
(9 blog posts, 2 case studies, email.ts). Reframed around ownership, performance, and
"no monthly platform fees" instead of exposing how cheap infrastructure is. NEVER expose
raw infrastructure costs in client-facing content — it undermines service pricing ($750-$7,500).
Fixed 5 blog posts pre-published ahead of schedule (coach-tutor, food-truck, brewery, artisan,
caterer) — set back to draft:true. Blog listing has no date filter (only checks draft:false),
so always set new posts to draft:true with future publishedDate. Auto-publish GitHub Action
at .github/workflows/auto-publish.yml handles the flip daily at 8am ET.*
*v3.11: Resend Audiences integration — subscribe syncs contacts to Resend (resend.contacts.create),
unsubscribe removes from Resend (resend.contacts.remove). Broadcast page at /marketing-admin/broadcast:
compose + preview + test send + AI assist (POST /api/ai-broadcast-draft). Sends via POST /api/broadcast
to all active subscribers in batches of 10, per-subscriber HMAC unsubscribe links. brandedEmailWrapper()
in email.ts for consistent branded email templates (header, footer, warm cream/amber palette). Not used
for 1:1 replies — only broadcasts and marketing emails. Broadcast nav item + icons (broadcast, mail)
added to MarketingAdminLayout sidebar. Blog YAML fixes: unescaped apostrophes in food-truck and
real-estate post titles (single → double quotes). Nurture sequence: 7-step (was 5), industry-specific
step 3. All crons active via standalone Workers (social every 5min, nurture daily 9am UTC, analytics
daily 2am UTC). 34 blog posts total (8 new industry posts stagger-publishing Apr 14-21).*
*v3.10: Fixed chatbot intake silent rejection (BUG-010). Anti-spam timing check used
Date.now() at submit time instead of page load — every chatbot submission was silently
dropped with fake 200 OK. Fix: useRef captures timestamp on mount. Also: AI prompt
hardened to require email before completing, client-side guard rejects submission without
email. Manual form was unaffected (sets _loaded_at at page load correctly).*
*v3.9: Added Spark product tier to intake form and AI scoring. Conditional questionnaire —
website questions hidden for app/spark selections, spark-specific questions (idea, audience,
validation) shown only for spark. Intake API updated: Zod schema, SQL insert, scoring prompt
all include spark. Scoring regex matches spark tier. Deployed to production.*
*v3.8: Agent governance system. Marketing Agent Exec operates at this layer — spawns per-product marketing sub-agents, drives content strategy, social scheduling, case study triggers. 6 existing AI routes (ai-draft, ai-seo, ai-repurpose, ai-calendar, ai-blog-outline, ai-subject-lines) serve as implementation for marketing agents. Three-document hierarchy: BUSINESS.md -> AGENTS.md -> CLAUDE.md. See AGENTS.md at company root.*
*v3.7: Documentation refresh — all CLAUDE.md files synchronized across repos (2026-04-05). Products framing: marketing site is a product OF UWC, deployed on CF Pages.*
*v3.6: All 18 case study screenshots recaptured via Playwright headless (zero browser
chrome). Video plays once then stops (removed loop). Work grid shows 5 projects (UWC
internal set to draft). Related Projects section added to CLAUDE.md with video-pipeline
reference. Video pipeline: ProcessStatic composition (screenshot-based, no ffprobe crash),
Shira + MyChama showcase stills, dedicated Desktop/Mobile video compositions.*
*v3.5: Homepage process video section — embedded MP4 from video-pipeline (auto-play on
scroll via IntersectionObserver, play/pause overlay, poster image). Case study mobile
phone mockups — floating iPhone frame beside Key Results for 5 projects (Fade House,
Peach & Thread, LookAround, Shira, MyChama) using /images/work/mobile/*.png. Higher-res
screenshots replaced across all 6 projects (14 images). Shira gets shira-modules.jpg
(3 screenshots now). UWC Marketing Platform case study set to draft. wrangler.toml adds
nodejs_compat flag. New files: public/media/videos/process-desktop.mp4,
public/images/work/mobile/{5 PNGs}, public/images/work/process-poster.jpg.*
*v3.4: Fixed h2/h3 content styling — Tailwind v4 prose modifiers replaced with explicit CSS
in global.css (.case-study-content, .blog-content). 6 new screenshots added (17 total).
All projects have 2-3 screenshots. Homepage stat "$0 hosting" → "100% ownership".*
*v3.3: UI polish — work cards (rounded-2xl, shadow hover, adaptive grids), blog index
(white cards, formatted dates, animated arrows), blog post (matching prose, blockquotes).
Blog tone softened (no framework names). Internal links across all 6 posts. Checklist
page replaces PDF lead magnet. Migrations 0004+0005 applied. Cron worker redeployed.
All forms verified working on production.*
*v3.2: Case study rewrites with real project data (Fade House, Peach & Thread, LookAround Landscappers).
Newsletter industry categorization (migration 0005, industry-specific nurture emails).
Case study template: hero fade image, live link button, section spacing, prose styling
(h2 border, h3 accent bar), screenshots grid, modular repeatable pattern. liveUrl +
screenshots Keystatic fields. 11 cropped screenshots in public/images/work/. Homepage
featured work uses real screenshots. Consistent h2/h3 hierarchy across all case studies.*
*v3.1: Marketing site overhaul — 6 case studies, testimonials, stats, FAQ, email nurture
sequence (5-email drip), contact form D1 storage, 6 blog posts (was 1), nav update (Work,
FAQ, Get Started CTA). Migration 0004 adds nurture tracking + contact_submissions. Cron
updated for daily nurture emails. Exit-intent popup, micro-conversion tracking, GDPR-
compliant cookie banner, services comparison table. About page rewrite with storytelling.
Contact page dual-path CTA. JSON-LD structured data on all pages.*
*v3.0: Production deployed to upstate-web.com. Domain fix (upstatewebco.com -> upstate-web.com).
CF Access configured (self-hosted). JWT cookie auth fallback for Pages (BUG-009).
Admin API routes protected in middleware (BUG-008). All secrets set. Cron Worker deployed.
D1 migrations applied to remote. Auto-deploy via GitHub connected.*
*v2.9: Security fixes from cross-repo audit. HMAC unsubscribe tokens, required cron secret.*
*v2.8: All 10 build phases + 3 audits complete. 133 tests, 9 arch docs, 23 rules enforced.*

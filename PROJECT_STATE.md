# PROJECT_STATE.md — uwc-marketing-site

> Read this at the START of every Claude Code session.
> Update this AFTER every completed deliverable.

---

## Current Phase

**Phase 10 — Full Cron + Monitoring (COMPLETE)**
ALL 10 PHASES COMPLETE. Marketing site fully built.

---

## Build Phases (Full Roadmap)

```
Phase 1 — Public Site Foundation       ← COMPLETE
  Landing page, services, about, blog (Keystatic), contact form, SEOHead, sitemap, deploy

Phase 2 — Marketing Admin Shell       ← COMPLETE
  CF Access setup, /marketing-admin/* route, AdminLayout, dashboard stub

Phase 3 — SEO Management              ← COMPLETE
  Per-page SEO editor, D1 seo_pages table, SEO overrides Worker, schema editor

Phase 4 — Analytics Dashboard            ← COMPLETE
  CF Analytics API integration, GA4 setup + proxy, traffic dashboard

Phase 5 — Social Media Content Calendar  ← COMPLETE
  D1 social_posts table, content calendar UI, post composer, draft saving

Phase 6 — AI Draft Assist                ← COMPLETE
  Anthropic API integration, AI draft Worker, prompt engineering for SC business context

Phase 7 — Meta Integration (Facebook + Instagram) ← COMPLETE
  OAuth2 setup, token storage, post Worker, cron trigger, analytics pull

Phase 8 — LinkedIn Integration                ← COMPLETE
  OAuth2, org token, post Worker, refresh cycle

Phase 9 — Google Business Profile Integration ← COMPLETE
  Google OAuth2, GBP post Worker, token refresh (1hr cycle)

Phase 10 — Full Cron + Monitoring          ← COMPLETE
  Cron trigger (5min), failure alerts via Resend, retry logic
```

---

## What's Built

```
Session 1 (2026-03-23):
  Astro 5 project scaffolded with Keystatic, Tailwind v4, CF adapter
  keystatic.config.ts — blog collection (markdoc, frontmatter format)
  Blog index + [slug] pages using createReader API
  Sample blog post: "How Much Does a Website Cost in South Carolina?"
  Keystatic admin UI at /keystatic — working
  .gitignore, package.json, tsconfig.json, astro.config.mjs

Session 2 (2026-03-23):
  SEOHead.astro — title, description, OG, Twitter cards, JSON-LD schema
  PublicLayout.astro — responsive nav (mobile hamburger), 3-col footer, active links, SEOHead
  index.astro — hero, service tiers, why-us, CTA, LocalBusiness JSON-LD
  services.astro — 3 project tiers with pricing, 3 retainer plans, 4-step process
  about.astro — studio story, differentiators, CTA
  work/index.astro — case studies placeholder
  contact.astro — contact form UI (no backend yet)

Session 3 (2026-03-23) — D1 Schema Verification:
  Ran migrations/0001_marketing_schema.sql on local D1 (tables were missing)
  All 5 marketing tables created: content_drafts, social_posts, social_tokens, seo_pages, analytics_daily
  Added missing idx_social_posts_draft_id index (was in database_schema.md but not in migration)
  Seeded test data: content_draft + scheduled facebook post + SEO override for /
  Homepage renders correctly with SEOHead (title, OG, Twitter, JSON-LD LocalBusiness)
  Fixed MEMORY.md database_id to match wrangler.toml (35082de9-b2c5-4281-bff2-932dac8bf3a4)

Session 4 (2026-03-23) — Contact Form + SEO:
  Contact form API: src/pages/api/contact.ts (Zod validation, KV rate limiting, Resend)
  Email lib: src/lib/email.ts (Resend integration)
  Contact page wired with JS fetch + loading/success/error states
  Sitemap configured with /marketing-admin/* and /keystatic/* filtered out
  Article JSON-LD schema on blog post pages
  robots.txt, favicon.svg

Session 5 (2026-03-23) — Deploy:
  Git repo initialized, connected to upstate-web-co/uwc-marketing-site
  CF Pages project created via wrangler
  Created KV namespace RATE_LIMIT (id: bd3160683f3b413292d8f3be1248e131)
  Created R2 bucket agency-media
  Fixed D1 database_id to match actual agency-db (35082de9...)
  Blog pages set to prerender (createReader needs filesystem, unavailable at CF runtime)
  Deployed to https://uwc-marketing-site.pages.dev — all routes returning 200
  2 commits pushed to GitHub

Session 6 (2026-03-23) — Marketing Admin Shell:
  MarketingAdminLayout.astro — dark theme, fixed sidebar, mobile menu, 5 nav links
  /marketing-admin/index.astro — dashboard stub with 4 section cards + quick stats placeholders
  src/middleware.ts — CF Access defense-in-depth (checks cf-access-authenticated-user-email header)
  Middleware skips auth in dev mode, returns 401 in production without CF Access header
  Admin pages use noindex,nofollow meta tag

Session 7 (2026-03-23) — SEO Management (Phase 3):
  SEO CRUD API: src/pages/api/marketing-admin/seo.ts (GET list, POST upsert, DELETE)
  SEO editor UI: src/components/marketing-admin/SeoEditor.tsx (React island, client:load)
  SEO editor page: src/pages/marketing-admin/seo.astro
  SEO lib: src/lib/seo.ts (getSeoOverride — queries D1 by path)
  PublicLayout.astro wired to fetch D1 seo_pages overrides at render time
  SEOHead.astro updated: noindex prop, smart title (skips suffix if brand already in title)
  Graceful fallback: prerendered pages (no D1) use Astro prop defaults

Session 8 (2026-03-23) — Analytics Dashboard (Phase 4):
  CF Analytics proxy: src/pages/api/analytics/cf.ts (GraphQL to CF API, configurable days)
  GA4 proxy: src/pages/api/analytics/ga4.ts (serves from analytics_daily D1 table)
  TrafficDashboard.tsx — bar chart, stat cards, period selector (7/14/30d), GA4 snapshot list
  /marketing-admin/analytics.astro page
  Graceful empty states when tokens not yet configured

Session 9 (2026-03-23) — Social Media Content Calendar (Phase 5):
  Drafts API: src/pages/api/marketing-admin/drafts.ts (GET, POST, PUT)
  Schedule API: src/pages/api/marketing-admin/schedule.ts (GET, POST, DELETE/cancel)
  PostComposer.tsx — title, content, platform toggle, datetime picker, save draft / schedule
  ContentCalendar.tsx — grouped by date, status filters, platform badges, cancel action
  /marketing-admin/compose.astro and /marketing-admin/calendar.astro pages
  One social_posts row per platform per scheduled post (independent success/failure)

Session 10 (2026-03-23) — AI Draft Assist (Phase 6):
  AI draft API: src/pages/api/marketing-admin/ai-draft.ts (Anthropic claude-sonnet-4-6)
  System prompt: SC-focused copywriter for Upstate Web Co, platform-aware output
  PostComposer.tsx updated: AI Assist toggle, prompt input, Generate button
  Graceful error when ANTHROPIC_API_KEY not configured

Session 11 (2026-03-24) — Social Platform Integration (Phases 7-9):
  Token management: src/lib/social/tokens.ts (AES-256-GCM encrypt/decrypt, store/retrieve, refresh check)
  Meta lib: src/lib/social/meta.ts (Facebook Page feed + Instagram container/publish flow)
  LinkedIn lib: src/lib/social/linkedin.ts (ugcPosts API + OAuth2 refresh)
  GBP lib: src/lib/social/gbp.ts (localPosts API + Google OAuth2 refresh)
  Scheduler: src/lib/social/scheduler.ts (query due posts, post to platform, update status)
  Cron endpoint: src/pages/api/social/cron.ts (POST, secret-protected, calls scheduler)
  Token API: src/pages/api/marketing-admin/tokens.ts (GET status, POST store token)

Session 12 (2026-03-24) — Full Cron + Monitoring (Phase 10):
  Standalone cron Worker: workers/cron/ (wrangler.toml + src/index.ts)
  Two crons: */5 social posts, daily 2am analytics snapshot
  Failure alerts: Resend email on posting errors
  Retry logic: failed posts retried up to 3x (retry_count column via 0002 migration)
  Dashboard stats API: src/pages/api/marketing-admin/stats.ts (live D1 queries)
  DashboardStats.tsx: React component with live stats from API
  Dashboard updated: all sections marked "Ready", live stats replace placeholders

Session 13 (2026-03-24) — Image Upload:
  Upload API: src/pages/api/marketing-admin/upload.ts (multipart → R2, type/size validation)
  Media serve: src/pages/media/[...path].ts (R2 → public URL with cache headers)
  PostComposer.tsx: file picker, image preview with remove button, upload overlay
  Schedule API updated: accepts media_r2_key + media_url per platform post
  Drafts API updated: accepts media_r2_keys array
  Allowed: JPEG, PNG, GIF, WebP — max 10MB
  Stored in R2: social/YYYY-MM/uuid.ext
  Served via: /media/social/YYYY-MM/uuid.ext

Session 14 (2026-03-24) — Absolute Media URLs:
  Upload API now returns absolute URL (https://uwc-marketing-site.pages.dev/media/...)
  Scheduler resolves any relative media_url to absolute before posting to platforms
  SITE_URL var added to wrangler.toml — used by upload API + scheduler
  When custom domain connected, update SITE_URL to https://upstate-web.com

Session 15 (2026-03-24) — CRUD Views:
  Token management: src/components/marketing-admin/TokenManager.tsx + tokens.astro
    - List all 4 platforms with status (valid/expiring/expired/not connected)
    - Connect form: account ID, access token, refresh token, expiry, scope
    - Platform-specific hints and placeholder text
    - Tokens encrypted before storage
  Drafts list: src/components/marketing-admin/DraftsList.tsx + drafts.astro
    - List all drafts with status, platform badges, AI tag, media count
    - Inline edit (title + body)
    - Archive drafts, Schedule button links to composer
  Post detail: src/components/marketing-admin/PostDetail.tsx + post/[id].astro
    - Full post view: content, media preview, timestamps, error message, retry count
    - Edit content + reschedule datetime
    - Status actions: Cancel, Retry (failed→scheduled), Reschedule (cancelled→scheduled)
  Post API: src/pages/api/marketing-admin/post/[id].ts (GET + PUT)
  Calendar updated: posts now link to detail page
  Sidebar updated: 7 links (Dashboard, Compose, Calendar, SEO, Analytics, Drafts, Connections)

Session 16 (2026-03-24) — Testing + Architecture + DSA Audit:
  Testing infrastructure:
    vitest.config.ts, package.json scripts (test, test:watch)
    better-sqlite3 D1 mock with ?N placeholder conversion (tests/d1/setup.ts)
    133 tests across 10 files — all passing
  Test files:
    tests/token-utils.test.ts (14) — isTokenExpired, isTokenExpiringSoon + edge cases
    tests/validation.test.ts (45) — contact form Zod + all admin endpoint validation
    tests/scheduler.test.ts (15) — scheduler with mocked platform APIs + edge cases
    tests/d1/seo.test.ts (12) — getSeoOverride + upsert + CRUD
    tests/d1/drafts.test.ts (5) — content drafts CRUD patterns
    tests/d1/social-posts.test.ts (12) — scheduling, cron queries, indexes
    tests/d1/admin-stats.test.ts (5) — dashboard stats queries
    tests/d1/post-detail.test.ts (7) — GET JOIN + dynamic PUT
    tests/d1/schedule-query.test.ts (8) — calendar query + NOT NULL constraints
    tests/d1/token-status.test.ts (10) — token metadata + analytics daily
  Architecture docs (docs/architecture/):
    README.md, BACKEND_ARCHITECTURE.md, FRONTEND_ARCHITECTURE.md
    SECURITY_ARCHITECTURE.md, DEPLOYMENT_ARCHITECTURE.md, TESTING_ARCHITECTURE.md
  DSA Audit (docs/architecture/AUDIT_GAPS.md):
    Data Structures & Architecture: 10 marketing site gaps, 6 agency admin gaps
    Digital Services Act: compliance gaps for social media content operations
    Priority actions ranked by severity
  Updated docs: CLAUDE.md v2.3, CONVENTIONS.md, MEMORY.md, PROJECT_STATE.md

Session 17 (2026-03-24) — DSA Audit Fix Implementation:
  Critical fixes:
    S3: stats.ts — replaced email_subscribers query (nonexistent table) with content_drafts count
    F1: scheduler — picks up stale "posting" posts (>10 min timeout)
    C8: /privacy page — data collection, cookies, GDPR rights, AI disclosure, sub-processors
  Schema changes (migration 0003_indexes_ai_flag_history.sql):
    S1: Index on social_posts.posted_at (stats query perf)
    S2: Composite index on social_posts(status, scheduled_at, retry_count) (cron perf)
    S5: Index on analytics_daily.date
    C2: ai_generated column on social_posts (propagated from content_drafts on schedule)
    C1: content_history_json column on social_posts (edit audit trail)
  Validation (A1):
    src/lib/schemas.ts — 10 Zod schemas (Contact, CreateDraft, UpdateDraft, SchedulePost,
      CancelPost, UpdatePost, UpsertSeo, DeleteSeo, StoreToken, AiDraft)
    All 7 admin API routes now use safeParse() with { error, code, issues } responses
  TypeScript (S6):
    src/types/index.ts — interfaces for all 5 D1 tables + helper types (Platform, TokenStatus, etc.)
  Security:
    A7: middleware.ts — CSP + X-Content-Type-Options + X-Frame-Options + Referrer-Policy
    C7: TrackingPixels.astro — pixels gated behind cookie consent banner (uwc_consent cookie)
    F2: scheduler — deduplication check (skip API if external_id already set)
  Operational:
    C6: tokens.ts DELETE handler — purge encrypted token from D1
    C11: schedule.ts — per-platform daily post limit (10 posts/platform/day, 429 response)
  Updated: CLAUDE.md v2.4, PROJECT_STATE.md

Session 18 (2026-03-24) — Frontend Audit Fixes:
  Frontend audit: docs/architecture/FRONTEND_AUDIT.md (20 items across public + admin)
  High priority fixes:
    FE1: /work hidden from nav + footer (empty page, damages credibility)
    FE2: /privacy linked in footer
    FE3: DashboardStats label changed from "Subscribers" to "Drafts"
    FE4: TokenManager disconnect button + confirm dialog
    FE5: PostDetail content history display (expandable <details> section)
    FE6: PostComposer prevents past scheduling (min attr) + platform char limits
  Medium priority fixes:
    FE9: SeoEditor SERP preview (Google-style search snippet)
    FE11: Skip-to-content link + aria-label on nav (public + admin)
    FE12: Blog reading time ("{N} min read")
  Accessibility (a11y):
    role="alert" on all message containers across 7 React admin components + contact form
    aria-label="Admin navigation" on admin sidebar
    aria-label="Main navigation" on public nav
  Updated: CLAUDE.md v2.5, PROJECT_STATE.md

Session 19 (2026-03-24) — Rules, Patterns & Modular Design Audit:
  Cross-project analysis: compared rules from FarmCore (42), MyChama (20), Agency Admin (24)
  Rules audit: docs/architecture/RULES_PATTERNS_AUDIT.md
  New rules added to CLAUDE.md (17-23):
    17: Zod on all API routes (no inline if-checks)
    18: Error codes on all responses
    19: No `any` type — use typed helpers
    20: Extract at 3 — components and constants
    21: Every bug gets a regression test
    22: Pre-commit checks
    23: UTC ISO strings for all dates
  Enforcement fixes:
    5 AI routes now have Zod validation: ai-seo, ai-repurpose, ai-calendar, ai-subject-lines, ai-blog-outline
    5 AI routes now include error codes in all error responses
    5 AI routes now use getEnv() instead of (locals as any)
  New files:
    src/lib/env.ts — typed getEnv() helper (replaces 32 `(locals as any)` casts)
    src/lib/constants.ts — STATUS_STYLES, PLATFORM_LABELS, PLATFORM_CHAR_LIMITS, ERROR_CODES
    src/lib/schemas.ts — expanded from 10 to 16 Zod schemas (added 6 AI schemas)
    src/components/marketing-admin/AlertMessage.tsx — reusable success/error banner
    src/components/marketing-admin/StatusBadge.tsx — reusable status badge from constants
  Updated: CLAUDE.md v2.6, PROJECT_STATE.md

Session 20 (2026-03-24) — Rule Enforcement + getEnv Migration + Hook:
  getEnv() migration (Rule 19):
    All 16 API route files migrated from (locals as any).runtime?.env to getEnv(locals)
    media/[...path].ts also migrated
    Zero (locals as any) casts remain in API routes
  Constants wiring (Rule 20):
    PostDetail.tsx — replaced inline statusStyles + platformLabels with constants.ts imports
    DraftsList.tsx — replaced inline statusStyles with STATUS_STYLES import
  Code quality:
    drafts.ts POST — fixed to use RETURNING * instead of ORDER BY LIMIT 1
    Fixed flaky boundary test in token-utils (added 10s buffer)
  Hook:
    .claude/settings.json — PostToolUse hook on TodoWrite
    When all todos are completed, injects reminder to update CLAUDE.md, PROJECT_STATE.md, MEMORY.md
  Updated: CLAUDE.md v2.7, PROJECT_STATE.md, MEMORY.md

Session 21 (2026-03-24) — Full Rule Enforcement + Component Wiring:
  AlertMessage component wired into 6 admin components:
    PostComposer, PostDetail, TokenManager, DraftsList, SeoEditor, BlogOutlineGenerator
    Zero inline message divs remain
  Error codes added to all 57 error responses across all API routes:
    Codes: DB_NOT_CONFIGURED, VALIDATION_ERROR, FETCH_FAILED, CREATE_FAILED,
    UPDATE_FAILED, DELETE_FAILED, UPLOAD_FAILED, AI_SERVICE_ERROR, RATE_LIMITED,
    UNAUTHORIZED, NOT_FOUND, CRON_FAILED, SERVICE_NOT_CONFIGURED, INTERNAL_ERROR
  Layout any casts cleaned: PublicLayout + TrackingPixels use Record<string, any>
  BUSINESS.md reviewed: pricing in services.astro matches Section 7, lifecycle documented
  Rule enforcement: 0 violations across Rules 17-20 verified
  Updated: CLAUDE.md v2.8, PROJECT_STATE.md, MEMORY.md

Session 22 (2026-03-25) — Production Deployment:
  Remote D1 migrations: all 4 files applied (0001, 0002, 0003_indexes, 0003_subscribers)
  14 tables confirmed on remote D1
  CF Pages secrets set: ANTHROPIC_API_KEY, RESEND_API_KEY, SOCIAL_TOKEN_ENCRYPTION_KEY, CRON_SECRET
  Cron Worker deployed: uwc-cron-worker (*/5 social + daily 2am analytics)
  CRON_SECRET set on cron Worker
  CF Access configured: self-hosted app, /marketing-admin/* + /keystatic/* protected
  Custom domain connected: upstate-web.com
  SITE_URL updated: wrangler.toml → https://upstate-web.com
  Cron Worker PAGES_URL updated: → https://upstate-web.com
  Full rebuild + deploy to CF Pages
  Smoke test passed: public routes 200, admin routes 401 (CF Access)
  Note: GitHub auto-deploy not connected — deploys are manual via wrangler pages deploy

Session 23 (2026-03-26) — Redeployment (New CF Pages Project):
  Old CF Pages + Workers deleted (git connection broken on CF side)
  New CF Pages project created via dashboard → Connect to Git
  Build settings: Framework preset: Astro, Build command: npm run build, Output: dist
  Key fix: old deploy used `npx wrangler deploy` (Workers command) — fails on Pages
  CF Pages git-connected projects auto-deploy from build output, no deploy command needed
  CF Access recreated: 3 separate domain entries in one Access application:
    upstate-web.com / marketing-admin  → WORKING (redirects to CF Access login)
    upstate-web.com / api/marketing-admin → path matching issue (middleware 401 fallback active)
    upstate-web.com / keystatic → path matching issue (investigating)
  Note: /api/marketing-admin/* still protected by middleware (returns 401 without CF Access header)
  Note: /keystatic/* NOT protected by middleware — CF Access is the only gate
  GitHub auto-deploy NOW connected (git-connected Pages project)
  Secrets need to be re-added (new project = fresh env vars)

Session 24 (2026-03-30) — Middleware Auth Hardening:
  middleware.ts: Added getAuthEmail() with JWT cookie fallback (BUG-009)
    CF Access on Pages sets CF_Authorization JWT cookie, NOT the header
    getAuthEmail() tries header first, then decodes JWT cookie payload
  middleware.ts: /keystatic/* now covered by isAdmin check
  wrangler.toml: Added compatibility_flags = ["nodejs_compat"]
  BUG-007 mitigated: middleware now protects all admin paths regardless of CF Access path matching
  BUG-008 fixed: /api/marketing-admin/* added to isAdmin check
  BUG-009 fixed: JWT cookie decoding added as fallback for CF Pages

Session 25 (2026-03-30) — Marketing Site Overhaul (Phases 1-4):
  Competitive research: analyzed 5 agency sites (Huemor, WebFX, Barrel, Grow + patterns)
  Storytelling research: SMB best practices for case studies, blog, social, email nurture

  Phase 1 — Portfolio & Social Proof:
    keystatic.config.ts: added `work` collection (title, client, industry, challenge, solution,
      results[], testimonial{}, services[], timeline, featured, draft, content)
    6 case study content files created:
      content/work/chama-saas-migration/index.mdoc
      content/work/shira-brand-website/index.mdoc
      content/work/uwc-marketing-platform/index.mdoc
      content/work/pt-professional-services/index.mdoc
      content/work/fade-cuts-barbershop/index.mdoc
      content/work/lookaround-local-discovery/index.mdoc
    src/pages/work/index.astro: replaced "coming soon" with case study grid (prerendered)
    src/pages/work/[slug].astro: individual case study template (prerendered)
    src/components/TestimonialCard.astro: reusable quote card component
    src/pages/index.astro: added stats bar, 3 testimonials, featured work cards, 5-step process
    src/pages/services.astro: added testimonial section between retainers and process

  Phase 2 — Content & Storytelling:
    2 new blog posts created:
      content/blog/5-signs-your-website-needs-a-redesign/index.mdoc
      content/blog/google-business-profile-guide-sc/index.mdoc
    Blog content strategy documented (10 posts planned) in plan file

  Phase 3 — Email Nurture & Lead Engine:
    migrations/0004_nurture_contact_submissions.sql: nurture_step + next_nurture_at on
      email_subscribers, new contact_submissions table
    src/lib/email.ts: 4 nurture email templates (NURTURE_STEPS config, sendNurtureEmail())
    src/pages/api/subscribe.ts: sets nurture_step=0 + next_nurture_at on new subscribers
    src/pages/api/contact.ts: now stores submissions in D1 (best-effort, non-blocking)
    src/pages/api/nurture-send.ts: cron endpoint to process due nurture emails
    workers/cron/src/index.ts: added processNurtureEmails() (daily 9am UTC cron)
    workers/cron/wrangler.toml: added "0 9 * * *" cron schedule

  Phase 4 — Site Polish:
    src/pages/faq.astro: accordion FAQ page (12 questions, FAQPage JSON-LD schema)
    Navigation updated: Work + FAQ added to nav, Get Started CTA button (desktop + mobile)
    Footer updated: Work link added
    Homepage stats updated: 6 projects delivered

  All 133 tests passing, build succeeds with all new pages prerendered

Session 28 (2026-04-01) — Video Pipeline: Full Captures + Stills + Rendering:
  Shira screenshots updated: 3 new desktop screenshots (hero, features, modules)
    Replaced shira-hero.jpg and shira-demo.jpg, added shira-modules.jpg
    Case study frontmatter updated with 3rd screenshot
  Shira + MyChama mobile stills captured (retina 3x) and added to showcase compositions
  Dedicated Desktop/Mobile video compositions (no cropping):
    BeforeAfter-Desktop (1920x1080, laptop only)
    BeforeAfter-Mobile (1080x1920, phone only)
    Process-Desktop (1920x1080, laptop only)
    Process-Mobile (1080x1920, phone only)
  Mobile process capture: separate mobile form walkthrough recording
  Exit-intent popup fix: blockPopupsOnContext() injects sessionStorage flags + consent
    cookies via addInitScript() — prevents popups before page JS runs
  24 product showcase stills rendered (12 sites × 4:5 + 1:1):
    Fade House, Peach & Thread, LookAround, Shira, MyChama + 7 UWC pages
  FFmpeg installed via Homebrew (macOS 13 compat workaround for Remotion compositor)
  render-with-ffmpeg.sh: two-step render (Remotion frames → FFmpeg stitch)
  LESSONS.md created: Playwright gotchas, Remotion patterns, creative direction notes
  Git repo initialized and committed (48 source files)
  Renamed: "Lookaround Ltd" → "LookAround Landscappers" across all compositions

Session 27 (2026-03-31) — Video Pipeline (Playwright + Remotion):
  New standalone project: uwc-web-co/video-pipeline/ (separate from marketing site)
  Purpose: programmatic marketing video creation from live client sites

  Two video pieces designed and scaffolded:
    Video 1 — "Before/After" Client Showcase (~47s):
      9 scenes: title → 3x (before chaos → terracotta wipe → after live site) → stats → CTA
      Clients: LookAround Landscappers (no website), Peach & Thread (DM chaos), Fade House (no-shows)
    Video 2 — "The Process" (~40s):
      10 scenes: title → homepage scroll → form walkthrough → proposal/payment/launch graphics → CTA
      Captures actual UWC get-started form flow with realistic typing

  Playwright capture scripts (3 files):
    scripts/capture-before-after.ts — desktop/mobile scroll recordings + screenshots for 3 client sites
    scripts/capture-process.ts — continuous form walkthrough recording on upstate-web.com
    scripts/capture-all.ts — orchestrator

  Remotion compositions (30 source files total):
    6 compositions: 2 videos × 3 aspect ratios (16:9, 9:16, 1:1)
    Shared components: DeviceFrame (laptop/phone bezels), BrandText (animated text),
      GrainOverlay (film grain), WipeTransition (terracotta wipe), NumberCounter, LogoWatermark
    Video 1 scenes: TitleCard, BeforeScene (3 variants), AfterScene, StatsReveal, EndCard
    Video 2 scenes: ProcessTitleCard, FormWalkthrough, ProposalGraphic, PaymentGraphic, LaunchGraphic, ProcessEndCard
    Lib: colors.ts, timing.ts, easing.ts, fonts.ts (brand-matched)

  Render pipeline: render/render-all.ts (bundles + renders all 6 MP4s)
  Dependencies: remotion ^4.x, playwright ^1.49.x, tsx ^4.x, typescript ^5.8.x
  TypeScript: clean compile (0 errors)

  Pipeline commands:
    npm run capture              — Playwright screen recordings
    npm run preview              — Remotion Studio (browser preview)
    npm run render               — Render all 6 MP4s
    npm run pipeline             — Full: capture → render

Session 25 (cont.) — Lead Conversion & Tracking Polish:
  Cookie consent: "Reject All" now equal visual weight to "Accept All" (GDPR 2025 compliance)
    - Both buttons same size, filled backgrounds, role="dialog" added
  Exit-intent popup: src/components/ExitIntentPopup.astro
    - Desktop: triggers on mouse leaving toward top of viewport
    - Mobile: triggers on scroll-up after 40% scroll depth
    - Shows lead magnet offer (website audit checklist)
    - Submits to /api/subscribe with source='lead-magnet'
    - Session-scoped (sessionStorage), skips if uwc_subscribed cookie set
    - Tracks conversions (fbq + gtag)
  Micro-conversion tracking: src/components/MicroConversions.astro
    - GA4 events: service tier clicks, FAQ expands, case study clicks, scroll depth (25/50/75/100%)
    - Only fires if gtag loaded (respects cookie consent)
  Services page: added feature comparison table (13 features across 3 tiers)
  Note: Lead magnet PDF (/media/resources/website-checklist.pdf) needs to be created and uploaded to R2

Session 26 (2026-03-31) — Case Study Rewrites + Newsletter + Images + Template:
  Case study rewrites with real project data:
    Fade House Barbershop: Marcus Johnson, Spartanburg, online booking + AI chatbot + $10 deposits
    Peach & Thread Boutique: Sarah Mitchell, Greenville, e-commerce + AI shopping + Friday drops
    LookAround Landscappers Home Services: landscaping/HVAC/plumbing, 7-page site, before-after gallery
    UWC: stripped proprietary details, repositioned as client-value tools
    Shira + Chama: added live URLs (shira.farm, mychama.app), softened tech language
  Directory renames: pt-professional-services → peach-thread-boutique, lookaround-local-discovery → lookaround-home-services
  Homepage featured work: Fade House + Peach & Thread (was MyChama + UWC)
  Newsletter categorization:
    migrations/0005_subscriber_industry.sql: industry column on email_subscribers
    subscribe.ts: accepts optional industry parameter
    NewsletterSignup.astro: optional "What type of business?" dropdown
    email.ts: industry-specific Step 3 nurture variants (5 industries → 5 case studies)
    nurture-send.ts: queries + passes subscriber industry
  Memories saved: LookAround future project, live URLs reference, content tone feedback,
    Chama+Shira rewrite todo (marketing-site-for-an-app angle)
  Case study template overhaul:
    keystatic.config.ts: added liveUrl (url field) + screenshots (image array) to work collection
    work/[slug].astro: hero image with gradient fade into title, "Visit the site" button,
      better section spacing (mb-12 between sections), styled prose headers (h2 with bottom
      border, h3 with spacing), screenshots grid at bottom, modular repeatable pattern
    All 6 case studies: added liveUrl frontmatter field with correct project URLs
  Screenshots & images:
    11 screenshots cropped (browser chrome removed), converted PNG→JPEG (82% quality)
    public/images/work/: fade-house-hero.jpg, fade-house-services.jpg, fade-house-gallery.jpg,
      peach-thread-hero.jpg, peach-thread-collection.jpg, peach-thread-sizing.jpg,
      lookaround-hero.jpg, chama-hero.jpg, chama-faq.jpg, shira-hero.jpg, shira-demo.jpg
    Wired into frontmatters: ogImage (hero) + screenshots array (bottom grid)
    Homepage featured work cards: real screenshots replace gradient placeholders
  Content structure normalization:
    All 6 case studies now use consistent h2/h3 hierarchy:
      ## The situation → ## The problems → ## What we built (### subsections) → ## The results → ## Why this matters
    Prose styling: h2 bottom border separators, h3 left orange accent bar, relaxed spacing
  Deployment & verification:
    wrangler login → migrations 0004 + 0005 applied to remote D1
    Cron worker redeployed with 3 schedules (*/5 social, 2am analytics, 9am nurture)
    get-started.astro + intake.ts + _headers committed (were untracked from prior session)
    /checklist page created (replaces broken PDF lead magnet with interactive web page)
    Lead magnet email + nurture Step 2 updated to link /checklist instead of PDF
    Live verification: subscribe ✅, contact ✅ (email + D1), nurture scheduling ✅, /checklist ✅
    CF Analytics active (cookieless). GA4/Meta pixels not configured yet (IDs empty)

Session 26 (cont.) — Design Suggestions:
  Saved 3 color palette alternatives (deeper contrast, dark hero, earthy+teal)
  Saved 8 UX addition ideas (animated counters, hover previews, sticky CTA, transitions, etc.)
  Saved as project_design_suggestions.md for future implementation session

Session 26 (cont.) — Content Styling System:
  Defined two CSS content styling groups in global.css:
    .case-study-content — for work/[slug].astro (Markdoc case study prose)
    .blog-content — for blog/[slug].astro (Markdoc blog post prose)
  Both share: h2 (1.5rem, bold, border-bottom, 3.5rem top), h3 (1.125rem, bold, left orange bar,
    2.5rem top), p (70% opacity, 1.75 line-height), a (orange, underline hover), ul/ol (1.5rem
    left padding), blockquote (orange left border, rounded-r). Blog adds table styling.
  These groups are the authoritative styling for all Markdoc-rendered content.
  Replaced Tailwind prose-* modifiers (broken in v4) with these explicit CSS rules.

Session 26 (cont.) — CSS Fix + Screenshots:
  Fixed h2/h3 styling: Tailwind v4 prose-h2/h3 modifiers weren't applying to Markdoc content.
    Replaced with explicit CSS rules in global.css targeting .case-study-content and .blog-content.
    h2: 1.5rem bold, border-bottom, 3.5rem top margin. h3: 1.125rem bold, left orange accent bar, 2.5rem top.
    Blog post template simplified to use .blog-content class.
  6 new screenshots cropped + added:
    fade-house-booking.jpg, peach-thread-arrivals.jpg, chama-pricing.jpg,
    chama-app-login.jpg, lookaround-services.jpg, lookaround-contact.jpg
  All projects now have 2-3 screenshots in bottom grid (was 0-2).

Session 26 (cont.) — Misc fixes:
  Homepage: replaced "$0 Monthly hosting fees" stat with "100% Client ownership"
    (was misleading — implies no charge or free hosting while we charge retainers)

Session 26 (cont.) — UI Polish + Blog Links:
  UI polish:
    work/[slug].astro: wider hero (max-w-4xl), responsive heights, rounded-2xl, better fade,
      back arrow, clock icon, border-2 live link, adaptive screenshot grid, shadow hover, mb-14
    work/index.astro: rounded-2xl cards, bg-white, hover shadow-lg, sm breakpoint, line-clamp-2
    blog/index.astro: white cards, hover shadow-md, formatted dates, animated arrow, newsletter
    blog/[slug].astro: formatted dates, back arrow, matching prose styling, blockquote
  Blog tone softening: replaced "Astro"/"Cloudflare Pages" with outcome language in all posts
  Internal links: all 6 posts now cross-link to case studies + other posts + /get-started

Session 25 (cont.) — Content & Storytelling Polish:
  3 more blog posts (6 total, was 1):
    content/blog/wordpress-vs-custom-built-sc/index.mdoc
    content/blog/what-to-expect-hiring-web-agency/index.mdoc
    content/blog/real-cost-free-website-builder/index.mdoc
  About page rewrite: stronger storytelling, icon-based values, stats bar,
    testimonial, Organization schema, dual CTA (get-started + contact)
  Contact page: added "two paths" section above form (Start a project vs Send a message)
  Work index: added CollectionPage JSON-LD schema
  All pages now have structured data: HomePage (LocalBusiness), Services, About (Organization),
    FAQ (FAQPage), Work (CollectionPage), Blog posts (Article), Case studies (Article)
```

---

## What's In Progress

```
DONE  1. CF Pages secrets re-added (user configured via dashboard)
DONE  2. CF Pages bindings re-added (DB, MEDIA, RATE_LIMIT via dashboard)
      3. CF Access path matching still flaky for /api/marketing-admin and /keystatic — middleware covers it now
DONE  4. Cron Worker redeployed with 3 schedules (social, analytics, nurture)
DONE  5. Migrations 0004 + 0005 applied to remote D1
DONE  6. Live verification passed: subscribe, contact, nurture scheduling all working

Remaining:
  - Set META_PIXEL_ID + GOOGLE_ADS_ID when Meta/Google ad accounts are set up
  - Set up Meta Business App + Page Access Token (social posting)
  - Set up LinkedIn Company App + Org Access Token (social posting)
  - Set up Google Cloud project for GBP + OAuth2 (social posting)
  - UI polish for work component layout + blog content layout
  - Blog tone softening + internal linking pass
  - Chama + Shira case study rewrites (marketing-site-for-an-app angle)
  - Create /new-case-study and update /new-blog-post skills
```

---

## Verification Results (Session 3)

```
1. Marketing Schema Tables          All 5 tables created after running migration
2. Table Structures Match Schema    social_posts, seo_pages, social_tokens match database_schema.md
3. Seed Test Social Post            content_drafts + social_posts insert/query working
4. SEO Table Insert/Query           seo_pages insert/query working
5. Public Site Renders              Homepage returns full HTML with SEOHead meta tags
6. Cross-Repo Data Visibility       N/A locally — local D1 is per-repo (.wrangler/state/v3/d1/)
                                       Cross-repo sharing only works on remote D1. Not a bug.
```

## Deployment Smoke Test (Session 5)

```
Route                                              Status
/                                                  200
/services                                          200
/about                                             200
/work                                              200
/blog/                                             200 (prerendered)
/blog/how-much-does-a-website-cost-south-carolina/ 200 (prerendered)
/contact                                           200
/robots.txt                                        200
```

## Bugs Found

```
BUG-001 (fixed): Migration missing idx_social_posts_draft_id index
  database_schema.md documented 4 indexes on social_posts, migration only had 3.
  Fix: Added CREATE INDEX to migrations/0001_marketing_schema.sql + applied to local D1.

BUG-002 (fixed): MEMORY.md had wrong D1 database_id
  MEMORY.md: a2109f91-58a2-40ef-8725-c3bd84c55e41
  wrangler.toml (source of truth): 35082de9-b2c5-4281-bff2-932dac8bf3a4
  Fix: Updated MEMORY.md to match wrangler.toml.

BUG-003 (fixed): Blog pages 500 on production
  createReader uses filesystem — unavailable in CF Workers runtime.
  Fix: Added `export const prerender = true` + getStaticPaths to blog pages.

BUG-004 (fixed): KV namespace ID didn't exist in CF account
  wrangler.toml had placeholder ID. Created actual namespace via wrangler.
  Fix: `wrangler kv namespace create RATE_LIMIT` → updated wrangler.toml.

BUG-005 (fixed): CF Pages rejects [triggers] in wrangler.toml
  Cron triggers are for Workers, not Pages.
  Fix: Commented out [triggers] section — will use separate Worker in Phase 10.

BUG-006 (fixed): `npx wrangler deploy` fails on git-connected CF Pages project
  CF Pages deploy command was set to `npx wrangler deploy` (Workers command).
  Error: "Missing entry-point to Worker script or to assets directory"
  Fix: Use Framework preset: Astro, no deploy command (CF Pages auto-deploys from build output).
  If deploy command field is required, use `npx wrangler pages deploy dist`.

BUG-007 (mitigated): CF Access multi-path app only protects first path
  Single Access app with 3 paths: /marketing-admin, /api/marketing-admin, /keystatic
  Only /marketing-admin redirects to CF Access login via CF Access.
  Fix: Middleware now protects ALL admin paths (/marketing-admin/*, /api/marketing-admin/*, /keystatic/*).
  CF Access still only shows login page for /marketing-admin — other paths get middleware 401.

BUG-008 (fixed): /api/marketing-admin/* routes publicly accessible
  Middleware isAdmin check only matched /marketing-admin, not /api/marketing-admin.
  Fix: Added /api/marketing-admin to isAdmin path check in middleware.ts.

BUG-009 (fixed): CF Access JWT cookie not decoded — 401 after login
  CF Access on Pages sets CF_Authorization JWT cookie, not cf-access-authenticated-user-email header.
  Fix: Added getAuthEmail() in middleware.ts — tries header first, falls back to JWT cookie decode.
```

## What's Broken

```
1. CF Access path matching still flaky for /api/marketing-admin and /keystatic — MITIGATED by middleware (all admin paths now return 401 without auth)
2. All API routes will fail at runtime until bindings (DB, MEDIA, RATE_LIMIT) are re-added
3. Secrets not yet configured on new CF Pages project
```

---

## Post-Build Priorities

```
DONE  1. Custom domain: upstate-web.com connected
DONE  2. CF Access: /marketing-admin/* + /keystatic/* protected
DONE  3. CF Pages secrets: 4 keys set
DONE  4. Cron Worker deployed
DONE  5. Remote D1 migrations applied (4 files)
DONE  6. Full deploy + smoke test passed
TODO  7. Set up Meta Business App + get Page Access Token
TODO  8. Set up LinkedIn Company App + get Organization Access Token
TODO  9. Set up Google Cloud project for GBP + OAuth2
DONE 10. Connect GitHub auto-deploy (git-connected Pages project, 2026-03-26)

POST-REDEPLOY (2026-03-26):
TODO 11. Re-add CF Pages bindings (DB, MEDIA, RATE_LIMIT)
TODO 12. Re-add CF Pages secrets (6 keys)
TODO 13. Fix CF Access for /api/marketing-admin and /keystatic paths
TODO 14. Verify cron Worker still points to correct PAGES_URL
```

---

## Key Decisions Made

### 2026-03-23 — Use createReader API, not Astro Content Collections
@keystatic/astro does NOT register Keystatic collections as Astro content collections.
We use `createReader(process.cwd(), config)` from `@keystatic/core/reader` for all content reads.
Markdoc rendering: `Markdoc.transform(content.node)` → `Markdoc.renderers.html(transformed)`.

### 2026-03-23 — Keystatic content stored as single frontmatter .mdoc files
`format: { contentField: 'content' }` with `path: 'content/blog/*/'` (trailing slash).
Each post = `content/blog/{slug}/index.mdoc` with YAML frontmatter.
NOT separate data + content files.

### 2026-03-23 — Tailwind v4 via @tailwindcss/vite (not @astrojs/tailwind)
Tailwind v4 is a Vite plugin. Configured in `astro.config.mjs` via `vite: { plugins: [tailwindcss()] }`.

### 2026-03-23 — Keystatic storage: local (not GitHub) during development
Using `storage: { kind: 'local' }` for dev. Will switch to `kind: 'github'` when deploying.

### 2026-03-23 — Blog pages must be prerendered
createReader reads from filesystem — unavailable in CF Workers runtime.
Blog pages use `export const prerender = true` + `getStaticPaths()`.
Content updates require a rebuild (Keystatic commit → CF Pages rebuild).

### 2026-03-23 — CF Pages cron triggers unsupported
Cron triggers require a standalone Worker, not Pages. Commented out in wrangler.toml.
Standalone cron Worker created in workers/cron/ (deployed separately).

### 2026-03-24 — Admin components are React islands (client:load)
Marketing admin uses React (TSX) components with `client:load` for interactivity.
Astro pages provide the layout shell, React handles state (forms, fetching, etc.).

### 2026-03-24 — Social tokens encrypted with AES-256-GCM
Tokens stored encrypted in D1 using Web Crypto API (PBKDF2 key derivation).
SOCIAL_TOKEN_ENCRYPTION_KEY env var must be set. Decrypted only server-side.

### 2026-03-24 — Failed posts retry up to 3 times
retry_count column added to social_posts (migration 0002).
Scheduler picks up failed posts where retry_count < 3 on each cron run.

### 2026-03-24 — Media served via Pages, not R2 custom domain
Images uploaded to R2, served via /media/* catch-all route on CF Pages.
Upload API returns absolute URLs using SITE_URL wrangler var.
Scheduler resolves any relative URLs to absolute before posting to platforms.
No separate R2 custom domain needed — Pages handles it.
When custom domain connected, update SITE_URL in wrangler.toml.

### 2026-03-24 — Image-only for now, video later
PostComposer supports JPEG, PNG, GIF, WebP (max 10MB).
Video/Reels deferred — Instagram requires async container processing + polling.
Facebook video uses a different endpoint (/videos vs /feed).

### 2026-03-24 — No X/Twitter support
X API requires $100/mo minimum for posting access. Not included.
Supported platforms: Facebook, Instagram, LinkedIn, Google Business Profile.

---

### 2026-03-26 — CF Pages git-connected projects don't need a deploy command
When you connect a repo to CF Pages via the dashboard (Connect to Git), the build output
directory is deployed automatically. Do NOT set `npx wrangler deploy` as the deploy command —
that's for Workers, not Pages. Use Framework preset: Astro, Build command: `npm run build`,
Build output: `dist`. No deploy command needed.

### 2026-03-26 — CF Access multi-path apps: path matching is unreliable
Adding multiple paths to a single CF Access application (e.g., `/marketing-admin`,
`/api/marketing-admin`, `/keystatic`) may not match all paths correctly. The first path works
but subsequent paths may not be enforced. Consider creating separate Access applications
per path, or rely on middleware defense-in-depth for API routes.

### 2026-03-26 — Recreating CF Pages project requires re-adding everything
Deleting and recreating a CF Pages project means ALL bindings (D1, R2, KV), secrets,
custom domains, and CF Access applications must be reconfigured from scratch.
Keep a checklist of all configured resources.

### 2026-03-25 — Domain is upstate-web.com, not upstate-web.com
Original plans referenced upstate-web.com. Actual domain is upstate-web.com.
SITE_URL, cron Worker PAGES_URL, and all references updated.

### 2026-03-25 — Subdomains for multi-project setup
Three CF Pages projects, one domain:
  upstate-web.com         → uwc-marketing-site (public + marketing admin)
  admin.upstate-web.com   → uwc-agency-admin
  portal.upstate-web.com  → uwc-client-portal
Subdomains are free DNS records under the same domain — no extra purchases.

---

*Updated: 2026-03-26*

# MEMORY.md — uwc-marketing-site Memory Index

| Task | Load This File |
|---|---|
| **DEBUGGING — always first** | `bug_history.md` |
| Workflow preferences, commit rules | `feedback_workflow.md` |
| Keystatic CMS, blog, case studies | `keystatic_cms.md` |
| SEO, sitemap, JSON-LD schema | `seo_management.md` |
| Social API calls, token management | `social_media_apis.md` |
| Content calendar, drafts, AI assist | `content_ops.md` |
| CF Analytics + GA4 | `analytics_traffic.md` |
| D1 tables (marketing-specific) | `database_schema.md` |
| Patterns that worked, pitfalls | `lessons_learned.md` |
| **Business operations** | `../uwc-agency-admin/BUSINESS.md` (pricing, lifecycle, skills) |
| Content tone (SMB audience) | `feedback_content_tone.md` |
| Live project URLs | `reference_live_urls.md` |
| LookAround platform (future) | `project_lookaround_platform.md` |
| Chama + Shira rewrite todos | `project_case_study_rewrites.md` |
| UWC logo prompts + brief | `project_logo_prompts.md` |
| Content styling groups (CSS) | `feedback_styling_groups.md` |
| Design suggestions (palettes, UX) | `project_design_suggestions.md` |
| Axios RAT advisory + mitigations | `security_axios_advisory.md` |
| Video pipeline commands + media locations | `reference_video_pipeline.md` |

## Sibling Projects
```
../video-pipeline/           ← Playwright + Remotion video generation (standalone project)
  npm run capture            — screen recordings from 5 client sites + UWC portal (7 pages)
  npm run capture:mobile-stills — retina mobile screenshots (3x) for all sites
  npm run preview            — Remotion Studio (http://localhost:3000)
  npm run render:stills      — 24 product showcase PNGs (12 sites × 2 aspect ratios)
  ./render/render-with-ffmpeg.sh [comp] [output] — render video (needs system ffmpeg)
  Compositions: BeforeAfter-Desktop, BeforeAfter-Mobile, Process-Desktop, Process-Mobile
  Stills: Showcase-{FadeHouse,PeachThread,Lookaround,Shira,MyChama,UWC-*}
  Media: captures/ (raw), output/stills/ (rendered PNGs), output/ (MP4s when rendered)
  LESSONS.md: Playwright gotchas, Remotion patterns, macOS FFmpeg workaround
```

## Architecture, Testing & Compliance Docs (in-repo, not memory)
```
docs/architecture/README.md              ← start here for architecture
docs/architecture/AUDIT_GAPS.md          ← DSA audit (data structures + compliance)
docs/architecture/FRONTEND_AUDIT.md      ← page-by-page frontend + a11y audit
docs/architecture/RULES_PATTERNS_AUDIT.md ← cross-project rules + modular design audit
TESTING.md                               ← test plan + what's tested/not
CONVENTIONS.md                           ← API shapes, status values, naming
LESSONS.md                               ← dev lessons (Keystatic, Tailwind, etc.)
```

## Quick Reference — Key Lib Files (Rule 20: single source of truth)
```
src/lib/env.ts          ← getEnv(locals) — typed CF bindings, no (locals as any)
src/lib/schemas.ts      ← 16 Zod schemas for ALL 11 API routes (incl. 6 AI)
src/lib/constants.ts    ← STATUS_STYLES, PLATFORM_LABELS, ERROR_CODES
src/types/index.ts      ← TypeScript interfaces for all D1 tables
```

## Quick Reference — API Route Pattern (Rules 17-19)
```typescript
import { getEnv } from '../../../lib/env'
import { CreateDraftSchema } from '../../../lib/schemas'

export async function POST({ request, locals }: APIContext) {
  const env = getEnv(locals)           // Rule 19: typed, no any
  const db = env.DB
  if (!db) return Response.json({ error: 'Database not configured', code: 'DB_NOT_CONFIGURED' }, { status: 500 })

  const parsed = CreateDraftSchema.safeParse(await request.json())  // Rule 17: Zod
  if (!parsed.success) {
    return Response.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', issues: parsed.error.issues }, { status: 400 })  // Rule 18: error code
  }
}
```

## Quick Reference — Repo Info
```
GitHub: upstate-web-co/uwc-marketing-site
CF Pages: uwc-marketing-site (https://upstate-web.com)
CF D1: agency-db (id: 35082de9-b2c5-4281-bff2-932dac8bf3a4)
CF R2: agency-media (binding: MEDIA)
CF KV: RATE_LIMIT (id: bd3160683f3b413292d8f3be1248e131)
Domain: upstate-web.com (connected, live)
Cron Worker: uwc-cron-worker (deployed, 3 schedules: */5 social, 2am analytics, 9am nurture)
Migrations applied: 0001-0005 (remote D1, as of 2026-03-31)
Bindings: DB + MEDIA + RATE_LIMIT configured on CF Pages dashboard
Secrets: RESEND_API_KEY, ANTHROPIC_API_KEY, SOCIAL_TOKEN_ENCRYPTION_KEY, CRON_SECRET set
Live status: subscribe ✅, contact ✅ (email + D1), nurture ✅, checklist ✅
Subdomains: admin.upstate-web.com (agency), portal.upstate-web.com (client)
Astro: v5.18.1, @astrojs/cloudflare v12.6.13
```

## Quick Reference — Deploy + Test
```
npm test               # vitest run (133 tests across 10 files)
npm run test:watch     # vitest watch mode
npm run deploy         # manual: astro build && wrangler pages deploy dist
Auto-deploy:           git push → CF Pages auto-builds (git-connected, 2026-03-30)
Blog pages are prerendered (createReader needs filesystem)
Cron Worker: cd workers/cron && wrangler deploy  (separate deploy)
```

## Quick Reference — Admin Routes
```
/marketing-admin/              Dashboard (live stats)
/marketing-admin/compose       PostComposer + AI Assist + image upload
/marketing-admin/calendar      ContentCalendar (grouped by date, links to detail)
/marketing-admin/drafts        DraftsList (edit, archive, schedule)
/marketing-admin/post/[id]     PostDetail (edit, reschedule, retry, cancel)
/marketing-admin/seo           SeoEditor (D1 overrides)
/marketing-admin/analytics     TrafficDashboard (CF + GA4)
/marketing-admin/tokens        TokenManager (connect/update platform tokens)
/marketing-admin/subscribers   SubscribersList (email list, filters, stats)
/marketing-admin/blog-ideas    BlogOutlineGenerator (AI blog outlines)
```

## Quick Reference — API Endpoints
```
POST /api/contact                         Contact form (now also stores in D1)
POST /api/subscribe                       Newsletter signup (now sets nurture tracking)
GET  /api/unsubscribe                     HMAC token unsubscribe
POST /api/nurture-send                    Process due nurture emails (cron-protected)
GET  /api/marketing-admin/stats           Dashboard stats
GET/POST/DELETE /api/marketing-admin/seo  SEO overrides CRUD
GET/POST/PUT /api/marketing-admin/drafts  Content drafts CRUD
GET/POST/DELETE /api/marketing-admin/schedule  Social post queue
POST /api/marketing-admin/ai-draft        AI content generation (Zod)
POST /api/marketing-admin/ai-seo          AI SEO suggestions (Zod)
POST /api/marketing-admin/ai-repurpose    AI repurpose to platforms (Zod)
POST /api/marketing-admin/ai-calendar     AI week suggestions (Zod)
POST /api/marketing-admin/ai-subject-lines AI email subject lines (Zod)
POST /api/marketing-admin/ai-blog-outline  AI blog outline (Zod)
POST /api/marketing-admin/upload          Image upload to R2
GET/POST/DELETE /api/marketing-admin/tokens  Token management + disconnect
GET/PUT /api/marketing-admin/post/[id]    Single post detail + edit
POST /api/social/cron                     Process due posts (secret-protected)
GET  /api/analytics/cf                    CF Analytics proxy
GET  /api/analytics/ga4                   GA4 from D1 snapshots
GET  /media/*                             R2 media serve (images)
```

## Quick Reference — Email Nurture Flow
```
1. User subscribes via /api/subscribe → stored in email_subscribers with nurture_step=0
2. Welcome email sent immediately (Day 0)
3. Cron (daily 9am UTC) calls POST /api/nurture-send
4. nurture-send queries subscribers where next_nurture_at <= now AND nurture_step < 4
5. Sends next email → updates nurture_step and next_nurture_at
6. Sequence: Day 1 (problem), Day 3 (quick win), Day 5 (case study), Day 7 (CTA)
7. After step 4, next_nurture_at set to NULL (sequence complete)
```

## Quick Reference — Social Post Flow
```
1. User drafts in /marketing-admin/compose (optional AI assist)
2. Optional: attach image (JPEG/PNG/GIF/WebP, max 10MB)
3. Saved to content_drafts D1 table (media_r2_keys_json)
4. User schedules → one social_posts row per platform (media_r2_key + media_url)
5. Cron Worker (every 5 min) calls POST /api/social/cron
6. Scheduler resolves relative media_url → absolute using SITE_URL
7. Posts to platform API → marks 'posted' or 'failed'
8. Failed posts retried up to 3x (retry_count column)
9. Failures trigger Resend email alert
```

## Quick Reference — Media Upload
```
Upload:   POST /api/marketing-admin/upload (multipart form)
Storage:  R2 bucket MEDIA → social/YYYY-MM/uuid.ext
Serve:    GET /media/social/YYYY-MM/uuid.ext (immutable cache)
URL:      Absolute — SITE_URL + /media/...
Allowed:  JPEG, PNG, GIF, WebP — max 10MB
No video: deferred (IG requires async container processing)
```

## Quick Reference — Token Safety
```typescript
// ALWAYS call getValidToken() — never use raw DB token
const token = await getValidToken(DB, 'facebook', SOCIAL_TOKEN_ENCRYPTION_KEY)
if (!token) { /* handle missing token */ }
```

## Quick Reference — CF Access for /marketing-admin/*
```
Your email only. CF Access self-hosted app on upstate-web.com.
Auth method: CF_Authorization JWT cookie (Pages does NOT inject the header).
Middleware: src/middleware.ts → getAuthEmail() decodes JWT cookie as fallback.
Protected paths: /marketing-admin/*, /api/marketing-admin/* (both in middleware)
Skips auth in dev (import.meta.env.DEV).
```

## Quick Reference — Hook (auto-reminder)
```
.claude/settings.json → PostToolUse hook on TodoWrite
When all todos are completed, injects context reminder to update:
  1. CLAUDE.md (version bump, file structure)
  2. PROJECT_STATE.md (session entry)
  3. MEMORY.md (quick references)
```

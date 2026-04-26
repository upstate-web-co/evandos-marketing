# UWC Marketing Site — Deployment & Infrastructure Architecture
> **Version:** 1.0 | **Date:** 2026-03-24 | **Platform:** Cloudflare Pages + Workers + D1 + R2 + KV
> **Purpose:** Dual deployment pipeline (Pages + cron Worker), migrations, local dev, monitoring.

---

## Table of Contents

1. [Infrastructure Overview](#1-infrastructure-overview)
2. [Dual Deployment Model](#2-dual-deployment-model)
3. [Pages Deploy Pipeline](#3-pages-deploy-pipeline)
4. [Cron Worker Deploy](#4-cron-worker-deploy)
5. [D1 Migrations](#5-d1-migrations)
6. [Environment Configuration](#6-environment-configuration)
7. [Local Development](#7-local-development)
8. [Monitoring & Observability](#8-monitoring--observability)
9. [Production Readiness Checklist](#9-production-readiness-checklist)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Infrastructure Overview

```
+---------------------------------------------------------------+
|                     Cloudflare Account                         |
|                                                                |
|  +------------------+  +--------------+  +------------------+ |
|  | CF Pages         |  | D1 Database  |  | R2 Bucket        | |
|  | (uwc-marketing-  |  | (agency-db)  |  | (agency-media)   | |
|  |  site)            |  | shared with  |  | social images    | |
|  |                  |  | agency-admin |  |                  | |
|  +------------------+  +--------------+  +------------------+ |
|           |                                                    |
|  +------------------+  +--------------+                        |
|  | Cron Worker      |  | KV Namespace |                        |
|  | (workers/cron)   |  | (RATE_LIMIT) |                        |
|  | SEPARATE deploy  |  | contact form |                        |
|  +------------------+  +--------------+                        |
+---------------------------------------------------------------+
```

**Key difference from agency-admin:** TWO deployment targets from one repo.

---

## 2. Dual Deployment Model

| Target | What it deploys | Command | When |
|--------|---------------|---------|------|
| CF Pages | Astro site (public + admin + API routes) | `npm run deploy` | Every code change |
| Cron Worker | Standalone Worker with cron triggers | `cd workers/cron && wrangler deploy` | When cron logic changes |

The cron Worker calls `POST /api/social/cron` on the Pages deployment — they're separate processes that communicate over HTTPS.

---

## 3. Pages Deploy Pipeline

```bash
npm run deploy
# expands to:
astro build && wrangler pages deploy dist --project-name uwc-marketing-site --branch main --commit-dirty=true
```

**Note:** Unlike the agency-admin (which needs the `_worker.js` copy workaround for Astro v6 + @astrojs/cloudflare v13), the marketing site uses Astro 5 + @astrojs/cloudflare v12 which outputs directly to `dist/` with the correct `_worker.js` structure.

### Blog prerendering

Blog pages use `export const prerender = true`. They're built as static HTML at build time. Keystatic content changes require a rebuild (commit → CF Pages CI → rebuild → deploy).

---

## 4. Cron Worker Deploy

```bash
cd workers/cron && wrangler deploy
```

### Cron triggers (wrangler.toml in workers/cron/)

```toml
[triggers]
crons = ["*/5 * * * *"]    # Every 5 min: process due social posts
# Daily 2am analytics snapshot handled separately
```

### Why a separate Worker?

CF Pages does not support `[triggers]` (cron). Cron triggers require a standalone Worker deployment. The cron Worker is a lightweight script that calls the Pages API endpoint:

```typescript
fetch(`${PAGES_URL}/api/social/cron`, {
  method: 'POST',
  headers: { 'x-cron-secret': env.CRON_SECRET }
})
```

---

## 5. D1 Migrations

### Migration files

```
migrations/
  0001_marketing_schema.sql    # 5 tables + indexes
  0002_add_retry_count.sql     # retry_count on social_posts
```

### Running migrations

```bash
# Local
wrangler d1 migrations apply agency-db --local

# Production
wrangler d1 migrations apply agency-db --remote
```

### Rules (same as agency-admin)

1. Never edit applied migrations — create new ones
2. Number sequentially — `0003_`, `0004_`
3. Use IF NOT EXISTS where possible
4. Test locally before remote
5. Remember: agency-admin shares this D1 — coordinate if adding shared tables

---

## 6. Environment Configuration

### wrangler.toml (root — for Pages)

```toml
name = "uwc-marketing-site"
compatibility_date = "2024-11-01"
pages_build_output_dir = "dist"

[[d1_databases]]
binding = "DB"
database_name = "agency-db"
database_id = "35082de9-b2c5-4281-bff2-932dac8bf3a4"

[[r2_buckets]]
binding = "MEDIA"
bucket_name = "agency-media"

[[kv_namespaces]]
binding = "RATE_LIMIT"
id = "bd3160683f3b413292d8f3be1248e131"

[vars]
SITE_URL = "https://uwc-marketing-site.pages.dev"
```

### Secrets (CF Pages dashboard)

Set via: CF Dashboard > Pages > uwc-marketing-site > Settings > Environment variables

### Local dev secrets (.dev.vars — gitignored)

```
RESEND_API_KEY=re_...
ANTHROPIC_API_KEY=sk-ant-...
SOCIAL_TOKEN_ENCRYPTION_KEY=...
CRON_SECRET=...
```

---

## 7. Local Development

```bash
npm run dev    # astro dev
```

### Local D1

Wrangler creates local SQLite in `.wrangler/state/`. Apply migrations:
```bash
wrangler d1 migrations apply agency-db --local
```

### Local R2

Wrangler creates local R2 in `.wrangler/state/`. Uploads persist across restarts.

### Miniflare gotcha

After editing config files, miniflare may lose its reference. Fix:
```bash
rm -rf node_modules/.vite
# restart dev server, wait 15-20s
```

---

## 8. Monitoring & Observability

### Pages analytics
CF Dashboard > Pages > uwc-marketing-site > Analytics

### D1 metrics
CF Dashboard > D1 > agency-db > Metrics

### Cron Worker logs
```bash
wrangler tail --name uwc-marketing-cron
```

### Pages Worker logs
```bash
wrangler pages deployment tail --project-name uwc-marketing-site
```

### Failed posts dashboard
`/marketing-admin/` shows failed post count. `/marketing-admin/calendar` with status filter shows error details.

### Cron failure alerts
The cron Worker sends a Resend email to `ALERT_EMAIL` when posts fail.

---

## 9. Production Readiness Checklist

### Before first production deploy

- [ ] D1 migrations applied: `wrangler d1 migrations apply agency-db --remote`
- [ ] All secrets set in CF Pages dashboard
- [ ] CF Access application created for `/marketing-admin/*`
- [ ] Custom domain configured in CF Pages
- [ ] DNS CNAME: `upstate-web.com → uwc-marketing-site.pages.dev`
- [ ] Cron Worker deployed: `cd workers/cron && wrangler deploy`
- [ ] CRON_SECRET matches between Pages and cron Worker
- [ ] SITE_URL updated in wrangler.toml if custom domain connected
- [ ] Test: contact form submission
- [ ] Test: compose + schedule + verify cron picks it up
- [ ] Test: image upload and media serve

### Before every deploy

- [ ] `npm test` passes (133 tests)
- [ ] No secrets in committed code
- [ ] D1 migrations applied if schema changed
- [ ] If cron logic changed: redeploy cron Worker too

---

## 10. Troubleshooting

### Blog pages 500 on production
`createReader` needs filesystem. Ensure `export const prerender = true` on blog pages.

### Cron not firing
Check cron Worker is deployed separately (`cd workers/cron && wrangler deploy`). CF Pages does not support `[triggers]`.

### "miniflare not defined" in dev
Clear `node_modules/.vite` and restart. Wait 15-20s after startup.

### Media URL returns 404
Check R2 bucket binding name is `MEDIA` (not `FILES` — that's agency-admin). Verify key exists in R2.

### Social post stuck in "posting"
The scheduler marks posts as "posting" before calling the platform API. If the Worker crashes mid-post, the status stays stuck. Manual fix: update to "failed" via admin UI, which makes it eligible for retry.

---

*Deployment Architecture v1.0 | 2026-03-24*

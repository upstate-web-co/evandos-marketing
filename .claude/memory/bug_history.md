# bug_history.md — uwc-marketing-site

> CHECK THIS FIRST before every debugging session.

---

## BUG-001 — Keystatic reader returns 0 posts — 2026-03-23
Symptom: Blog index showed "No posts yet" despite content files in content/blog/
Root cause: Three cascading issues:
  1. `path: 'content/blog/*'` missing trailing slash — expected flat files not directories
  2. `format: { contentField: 'content' }` expects single frontmatter file, not separate data + content files
  3. Markdoc AST needs `Markdoc.transform()` before `Markdoc.renderers.html()`
Fix: Changed path to `'content/blog/*/'`, combined into single index.mdoc with frontmatter, added transform step
Prevention: See keystatic_cms.md KEY GOTCHAS section. Always use trailing slash for directory format.

## BUG-002 — npm install fails with peer dependency conflict — 2026-03-23
Symptom: `@astrojs/tailwind` requires Tailwind v3, but we use Tailwind v4
Root cause: Tailwind v4 changed architecture — no longer uses the Astro integration
Fix: Removed `@astrojs/tailwind`, use `@tailwindcss/vite` plugin via `vite: { plugins: [tailwindcss()] }`
Prevention: Tailwind v4 = Vite plugin, not Astro integration

## BUG-003 — Blog pages return 500 on CF Pages production — 2026-03-23
Symptom: /blog returned 500 after first deploy. All other routes 200.
Root cause: `createReader(process.cwd(), keystaticConfig)` reads from filesystem.
  CF Workers don't have access to the `content/` directory at runtime.
Fix: Added `export const prerender = true` to blog pages + `getStaticPaths()` to [slug].astro.
  Blog content is now rendered to static HTML at build time.
Prevention: Any page using Keystatic's createReader MUST be prerendered.
  Content updates require a rebuild (Keystatic commit → CF Pages rebuild ~45s).

## BUG-004 — CF Pages rejects wrangler.toml with [triggers] — 2026-03-23
Symptom: `wrangler pages deploy` failed: "Configuration file for Pages does not support triggers"
Root cause: Cron triggers are a Workers feature, not supported by CF Pages.
Fix: Commented out `[triggers]` section. Cron will be a separate Worker in Phase 10.
Prevention: Never add [triggers] to a Pages project's wrangler.toml.

## BUG-005 — KV namespace ID not found on deploy — 2026-03-23
Symptom: Deploy failed: "KV namespace '9411bc21...' not found"
Root cause: wrangler.toml had a placeholder KV ID that didn't exist in the CF account.
Fix: Created namespace via `wrangler kv namespace create RATE_LIMIT`, updated ID in wrangler.toml.
Prevention: Always create CF resources (KV, D1, R2) before referencing their IDs.

## BUG-008 — Admin API routes publicly accessible — 2026-03-30
Symptom: curl to /api/marketing-admin/stats returned 200 without any auth.
Root cause: Middleware only checked `pathname.startsWith('/marketing-admin')`, missing `/api/marketing-admin`.
Fix: Added `|| pathname.startsWith('/api/marketing-admin')` to isAdmin check in middleware.
Prevention: When protecting path-prefix routes, always protect both page and API prefixes.

## BUG-009 — CF Access login returns 401 after authentication — 2026-03-30
Symptom: After CF Access OTP login, /marketing-admin/ still returned 401 blank page.
Root cause: CF Access on Pages sets `CF_Authorization` JWT cookie, NOT the `CF-Access-Authenticated-User-Email` header. Middleware only checked the header.
Fix: Added `getAuthEmail()` that tries header first, then decodes JWT from `CF_Authorization` cookie.
Prevention: CF Pages always needs JWT cookie fallback. Same pattern used in client portal.

---

## Known CF Pages Gotchas

### CF Pages does NOT support cron triggers
Use a separate standalone Worker for cron. Pages projects cannot have [triggers] in wrangler.toml.

### Prerendered pages get trailing slash redirects (308)
CF Pages serves `/blog` → 308 → `/blog/` for directory-style static files.
This is normal behavior, not a bug.

### Blog pages MUST be prerendered
Keystatic's createReader uses Node.js fs — unavailable in CF Workers.
All pages using createReader need `export const prerender = true`.

---

## Known Social API Gotchas (pre-emptive)

### Instagram requires a PUBLIC image URL — R2 presigned URLs won't work
Instagram's container creation API (`/media`) requires the `image_url` to be
publicly accessible without any auth headers or query string tokens.
Fix: use an R2 public bucket for social media images, or a CDN-served URL.
Never pass a presigned URL to Instagram's API.

### LinkedIn token expires in 60 days — not 1 year
LinkedIn access tokens expire in 60 days. Refresh tokens expire in 1 year.
Set a monitoring alert: check `social_tokens` where `platform='linkedin'`
and `expires_at < datetime('now', '+7 days')`. Send Resend alert if expiring.

### GBP access token expires in 1 HOUR — cron must refresh before every post
The `getValidToken()` helper handles this with a 5-minute buffer.
Never call GBP API with a token more than 55 minutes old.
Always go through `getValidToken()`.

### CF Workers cron minimum interval is 1 minute
`"*/5 * * * *"` (every 5 minutes) is the recommended schedule for the post queue.
Do NOT try to use intervals shorter than 1 minute — CF doesn't support them.

### Keystatic OAuth requires GitHub App permissions
Keystatic's GitHub storage mode needs a GitHub App with repo write access.
The app must be installed on the `upstate-web-co` org.
Without this, the `/keystatic` editor will load but saving will fail silently.

### D1 `ON CONFLICT` requires the target table to have a UNIQUE constraint
The SEO override upsert uses `ON CONFLICT(path)`. This requires
`path TEXT NOT NULL UNIQUE` in the `seo_pages` table definition.
If the UNIQUE constraint is missing, the upsert will throw a generic SQLite error.

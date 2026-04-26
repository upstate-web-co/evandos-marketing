---
name: lessons_learned
description: Patterns that worked well and pitfalls to avoid in this codebase
type: feedback
---

## What Worked

**React islands for admin, Astro for shell** — admin components (SeoEditor, PostComposer, ContentCalendar, TrafficDashboard, DashboardStats) are React TSX with `client:load`. Astro pages provide the layout. This pattern was smooth — no hydration issues, clean separation.

**Why:** Astro's partial hydration keeps the admin fast. Only interactive parts load React. The layout (sidebar, nav) stays server-rendered.

**How to apply:** Continue this pattern for any new admin features. Don't convert Astro pages to full React — use islands.

---

**Graceful degradation for missing env vars** — every API endpoint checks for required bindings (DB, API keys) and returns informative 200/500 responses instead of crashing. Example: AI draft returns `"ANTHROPIC_API_KEY not configured"` instead of throwing.

**Why:** During development and initial deploy, not all secrets are configured yet. Crashing prevents testing other features.

**How to apply:** Any new API endpoint should check for its required env vars and return a descriptive message if missing.

---

**SEO overrides: D1 query in PublicLayout with graceful fallback** — the `getSeoOverride()` call in PublicLayout returns `null` when DB isn't available (prerendered pages). Props are used as fallback.

**Why:** Blog pages are prerendered — no D1 at build time. Server-rendered pages (/, /services, etc.) get live D1 overrides.

**How to apply:** Any new page using PublicLayout automatically gets SEO override support. No extra wiring needed.

---

## Pitfalls Encountered

**CF Pages does NOT support cron triggers** — only standalone Workers do. The wrangler.toml `[triggers]` section was rejected during deploy. Solution: separate worker in `workers/cron/`.

**How to apply:** Never add cron config to the main wrangler.toml. Use the standalone worker pattern.

---

**Local D1 is per-repo** — `.wrangler/state/v3/d1/` is local to each project. Cross-repo table visibility only works on the remote D1 instance. Not a bug, but easy to forget.

**How to apply:** Don't expect to query agency-admin tables locally. Test cross-repo queries on remote D1.

---

**SEOHead title doubling** — when D1 override provides a full title like "Upstate Web Co. — ...", the SEOHead component would append `| Upstate Web Co.` again. Fixed by checking if the title already contains the site name.

**How to apply:** If title logic changes, keep the `title.includes(siteName)` guard.

---

**CF Pages git-connected: no deploy command needed** — When connecting a repo to CF Pages via "Connect to Git" in the dashboard, CF handles deployment automatically from the build output directory. Using `npx wrangler deploy` as the deploy command fails because that's a Workers command. Use `npx wrangler pages deploy dist` if a deploy command is required, but prefer leaving it blank.

**Why:** We hit this exact issue: build succeeded but deploy failed with "Missing entry-point to Worker script." The wrangler.toml has `pages_build_output_dir = "dist"` which tells CF this is a Pages project, but `wrangler deploy` ignores that.

**How to apply:** For any CF Pages project: Framework preset → Astro, Build command → `npm run build`, Build output → `dist`, Deploy command → blank. For manual deploys from CLI, use `npm run deploy` which runs `wrangler pages deploy dist`.

---

**CF Access multi-path matching is fragile** — Adding multiple domain+path entries to a single CF Access application may not protect all paths. In our case, `/marketing-admin` worked but `/api/marketing-admin` and `/keystatic` did not, even with various path formats.

**Why:** CF Access path matching behavior is undocumented for multi-path apps. The first entry works, subsequent entries may be silently ignored.

**How to apply:** Create separate CF Access applications for each path that needs protection. Don't rely on a single app with multiple path entries. For API routes, middleware defense-in-depth (401 without CF Access header) provides a safety net.

---

**Recreating a CF Pages project wipes all config** — Deleting and recreating a CF Pages project means all bindings (D1, R2, KV), environment variables/secrets, custom domains, and CF Access apps must be reconfigured. Keep a deployment checklist.

**Why:** We deleted the old project due to a broken git connection and had to reconfigure everything from scratch.

**How to apply:** Before deleting a CF Pages project, document all bindings, secrets, custom domains, and Access apps. Better yet, maintain a deployment checklist in PROJECT_STATE.md.

---

**CF Access on Pages uses JWT cookie, NOT the header** — CF Access for Workers injects `cf-access-authenticated-user-email` as a request header. But on CF Pages, it does NOT inject this header — instead it sets a `CF_Authorization` JWT cookie. Middleware must decode the JWT payload to extract the email.

**Why:** Our middleware was checking for the header only, so authenticated users were getting 401 after successful CF Access login. The fix was adding `getAuthEmail()` which tries the header first, then falls back to decoding the JWT cookie.

**How to apply:** Any CF Pages project using CF Access for auth must decode `CF_Authorization` JWT cookie. Pattern: `cookie.match(/CF_Authorization=([^;]+)/)` → `JSON.parse(atob(parts[1]))` → `payload.email`. This is already implemented in `src/middleware.ts` via `getAuthEmail()`.

---

**Social platform APIs need absolute URLs for media** — Instagram and Facebook fetch images from a URL you provide. Relative URLs (`/media/...`) won't work. The upload API must return absolute URLs using `SITE_URL`.

**How to apply:** Always use `SITE_URL` env var when constructing media URLs. The scheduler also resolves any relative URLs as a safety net. When switching to the custom domain, update `SITE_URL` in `wrangler.toml`.

---

**Pin npm dependencies and use overrides for known-bad versions** — axios v1.14.1 and v0.30.4 were reported to contain a RAT. We pinned all axios versions (removed `^` caret), added `overrides` in package.json to redirect compromised versions, and created `.npmrc` with `save-exact=true` across all repo roots.

**Why:** Caret ranges (`^1.13.6`) allow npm to auto-upgrade to minor/patch versions, which could silently pull in a compromised release. Overrides catch transitive dependencies too.

**How to apply:** When a dependency vulnerability is reported: (1) verify current installed version via node_modules, (2) pin exact version in package.json, (3) add `overrides` to redirect bad versions, (4) add `save-exact=true` to `.npmrc` to prevent future range installs. See `security_axios_advisory.md` for full details.

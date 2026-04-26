# LESSONS.md — uwc-marketing-site

> Lessons learned during development. Add entries as they come up.
> Format: date, context, lesson, resolution.

---

## Lessons

### 2026-03-23 — Keystatic collection path trailing slash matters
**Context:** Blog posts weren't being found by the Keystatic reader.
**Lesson:** `path: 'content/blog/*'` (no trailing slash) expects flat files: `content/blog/slug.yaml`. `path: 'content/blog/*/'` (with trailing slash) expects directories: `content/blog/slug/index.yaml`. The trailing slash controls `dataLocation` (`'outer'` vs `'index'`).
**Resolution:** Changed path to `'content/blog/*/'` to match our directory-based content structure.

### 2026-03-23 — Keystatic contentField uses frontmatter in a single file, not separate files
**Context:** Created separate `index.yaml` + `content.mdoc` files, but Keystatic reader returned 0 posts.
**Lesson:** When `format: { contentField: 'content' }` is set, Keystatic expects a **single file with YAML frontmatter** (e.g. `index.mdoc`), not separate data + content files. The reader calls `splitFrontmatter()` internally.
**Resolution:** Combined data and content into a single `index.mdoc` file with `---` frontmatter.

### 2026-03-23 — Keystatic markdoc content requires Markdoc.transform() before rendering
**Context:** `post.content()` returned `{ node: ... }` — a raw Markdoc AST. `Markdoc.renderers.html(content.node)` rendered nothing.
**Lesson:** The Markdoc AST from Keystatic's reader must be **transformed** before rendering: `Markdoc.transform(content.node)` → then `Markdoc.renderers.html(transformed)`.
**Resolution:** Added `Markdoc.transform()` step before `Markdoc.renderers.html()`.

### 2026-03-23 — @keystatic/astro does NOT auto-integrate with Astro Content Collections
**Context:** Tried switching to `getCollection('blog')` from `astro:content` — got "collection does not exist".
**Lesson:** `@keystatic/astro` only provides the admin UI routes (`/keystatic`). It does NOT register Keystatic collections as Astro content collections. Use the `createReader` API from `@keystatic/core/reader` instead.
**Resolution:** Stayed with `createReader(process.cwd(), keystaticConfig)` approach.

### 2026-03-23 — Tailwind v4 doesn't use @astrojs/tailwind
**Context:** `npm install` failed with peer dependency conflict — `@astrojs/tailwind` requires Tailwind v3.
**Lesson:** Tailwind v4 uses `@tailwindcss/vite` as a Vite plugin instead of the Astro integration. Add it via `vite.plugins` in `astro.config.mjs`.
**Resolution:** Removed `@astrojs/tailwind`, added `@tailwindcss/vite` and configured via `vite: { plugins: [tailwindcss()] }`.

---

## Lessons from Sibling Repos (uwc-agency-admin)

These were discovered during agency-admin deployment and apply here too.

### 2026-03-23 — (from agency-admin LSN-001) Astro v6 removes locals.runtime.env
**Context:** Astro v6 removed `locals.runtime.env` for Cloudflare bindings.
**Lesson:** In Astro v6+, use `import { env } from 'cloudflare:workers'` instead. We're on Astro 5 currently, so `locals.runtime.env` still works. **When upgrading to Astro 6, all API routes need updating.**
**Resolution:** No action needed yet. Flagged for Astro 6 upgrade.

### 2026-03-23 — (from agency-admin LSN-002) Astro CSRF blocks mutating requests without Origin header
**Context:** POST/PUT/DELETE requests return "Cross-site form submissions are forbidden" when tested without Origin header.
**Lesson:** Astro 5+ enables `security.checkOrigin` by default. Browser requests include Origin automatically. For curl/Postman testing, include `-H 'Origin: http://localhost:4321'`.
**Resolution:** No code change needed — just remember when testing APIs via curl.

### 2026-03-23 — (from agency-admin LSN-003) Miniflare needs time after dev restart
**Context:** After editing config files, "Expected miniflare to be defined" errors appear.
**Lesson:** Clear `node_modules/.vite` cache and restart. Wait ~15-20s after startup for miniflare to initialize.
**Resolution:** Restart dev server cleanly when this happens.

### 2026-03-23 — (from agency-admin LSN-004) @astrojs/cloudflare v13 generates incompatible wrangler.json
**Context:** `@astrojs/cloudflare` 13.x generates `dist/server/wrangler.json` that CF Pages rejects.
**Lesson:** The v13 adapter outputs to `dist/server/` and `dist/client/` separately, requiring manual assembly. Our v12 adapter outputs directly to `dist/` with `_worker.js` directory — this is already Pages-compatible.
**Resolution:** Our deploy is simpler: `astro build && wrangler pages deploy dist`. If upgrading to adapter v13+, may need the agency-admin's workaround script.

---

## D1 Gotchas (from sibling repos)

### D1 `.first()` returns undefined, not null
Always use `?? null` after every `.first()` call.

### D1 `RETURNING *` doesn't work in batch statements
Use individual `.first()` calls for single inserts.

### CF Access lowercases email addresses
Always store emails as lowercase in D1. Use `email.toLowerCase()` on insert.

---

### 2026-03-30 — CF Access on Pages uses JWT cookie, not header
**Context:** After setting up CF Access, visiting /marketing-admin/ returned 401 even after logging in.
**Lesson:** CF Access on CF Pages does NOT inject the `CF-Access-Authenticated-User-Email` header. It only sets a `CF_Authorization` JWT cookie. For Workers (non-Pages), the header IS injected. Middleware must decode the JWT cookie as a fallback.
**Resolution:** Added `getAuthEmail()` in middleware — tries header first, falls back to decoding JWT payload from `CF_Authorization` cookie. Same fix applied in client portal.

### 2026-03-30 — Admin API routes need middleware protection too
**Context:** `/api/marketing-admin/*` routes were publicly accessible (200) while `/marketing-admin/*` pages were protected (401).
**Lesson:** Middleware was only checking `pathname.startsWith('/marketing-admin')` which doesn't match `/api/marketing-admin/*`. CF Access path rules also only covered the page routes, not the API routes.
**Resolution:** Added `|| pathname.startsWith('/api/marketing-admin')` to the middleware isAdmin check.

## Lessons from MyChama Port (2026-03-28)

Discovered while porting the UWC marketing-site architecture to MyChama (Django SaaS on Hetzner → Astro marketing on CF Pages).

### Porting React SPA → Astro: most components are static
Of 19 React components, only 6 needed `client:load`/`client:visible` (Navbar, Pricing, FAQ, ContactForm, ProductShowcase, StickyMobileCTA). The other 13 converted to zero-JS `.astro` files. Key conversions: `className` → `class`, `strokeLinecap` → `stroke-linecap`, React `style={{}}` → Astro `style=""`, `.map()` works identically.

### `_redirects` for split-domain path routing
When CF Pages serves `mychama.app` but Django is on Hetzner, `public/_redirects` can route Django paths to origin. Critical: `/api/*` catches Astro API routes too. Must split: `/api/v1/*` → Django, leave `/api/marketing-admin/*` and `/api/social/*` for Astro.

### Origin subdomain for Django API proxy
`origin.mychama.app` (DNS-only, gray cloud) → Hetzner IP. Needs: separate SSL cert (Docker certbot), separate nginx server block, ALLOWED_HOSTS, container force-recreate. The marketing-admin dashboard proxies Django stats through `/api/marketing-admin/platform-proxy` → `origin.mychama.app`.

### X/Twitter tokens never expire
`access_token` + `access_token_secret` from OAuth 1.0a don't expire. `isTokenExpired(null)` must return `false`. Store `access_token_secret` in `refresh_token` field (D1 column reuse).

### Meta developer portal domain persistence
App Domains field doesn't save reliably. Privacy Policy URL must be set first. Alternative: Meta Business Suite system users generate permanent Page Access Tokens without OAuth dance.

### D1 CHECK constraint changes
Adding 'twitter' to platform enum required recreating `social_posts` and `social_tokens` tables entirely (SQLite has no ALTER CONSTRAINT). Migration: CREATE new → INSERT SELECT → DROP old → RENAME new.

### Cron worker needs CSRF bypass
Astro's `security.checkOrigin` blocks the cross-origin POST from the standalone cron worker. Set `checkOrigin: false` in `astro.config.mjs` — auth handled by `x-cron-secret` header instead.

---

### 2026-03-31 — Axios RAT advisory: pin versions and add npm overrides
**Context:** Reported that axios versions 1.14.1 and 0.30.4 contain a RAT that compromises env files.
**Lesson:** Caret ranges (`^1.13.6`) allow `npm install` to silently upgrade to a compromised minor/patch release. Overrides in package.json can redirect compromised transitive dependency versions to safe ones. `.npmrc` with `save-exact=true` prevents future caret ranges.
**Resolution:** Verified no repos had compromised versions. Pinned axios in 5 package.json files (removed `^`), added `overrides` to redirect 1.14.1 and 0.30.4 to safe versions, created `.npmrc` with `save-exact=true` in 7 repo roots. Repos without axios (all UWC, Mychama) unaffected — they use native `fetch`.

---

*Updated: 2026-03-31*

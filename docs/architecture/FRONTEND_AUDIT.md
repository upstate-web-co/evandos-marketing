# Frontend Audit — uwc-marketing-site
> **Date:** 2026-03-24 | **Scope:** Public pages, admin pages, React components, layouts, templates, accessibility, error handling
> **Covers:** Templates, lists, detail views, forms, navigation, responsiveness, SEO, and UX gaps

---

# PUBLIC SITE

---

## Page-by-Page Audit

### `/` (Landing Page — index.astro)

| Area | Status | Issue | Fix |
|------|--------|-------|-----|
| SEO | Good | LocalBusiness JSON-LD schema, title, OG tags | — |
| Content | Good | Hero, service tiers, why-us section, CTA | — |
| Accessibility | Gap | No `aria-label` on CTA buttons | Add `aria-label` to primary CTAs |
| Accessibility | Gap | Hero heading is `h1`, but section headings jump to `h2` inconsistently | Ensure heading hierarchy h1 > h2 > h3 |
| Performance | Good | No external JS loaded on landing page | — |
| Privacy link | Gap | No link to `/privacy` in footer | Add privacy policy link to footer |

### `/services` (Services Page)

| Area | Status | Issue | Fix |
|------|--------|-------|-----|
| Content | Good | 3 project tiers with pricing, retainers, process steps | — |
| Lead capture | Good | Lead magnet CTA + newsletter signup form | — |
| Accessibility | Gap | Pricing cards don't use `aria-label` for screen readers | Add `aria-label="Starter tier: $750"` etc. |
| SEO | Gap | No Service schema (JSON-LD) | Add `Service` or `Offer` schema for each tier |
| Validation | Gap | Newsletter signup has no email format validation | Add `type="email"` and client-side check |

### `/about` (About Page)

| Area | Status | Issue | Fix |
|------|--------|-------|-----|
| Content | Good | Story, differentiators, CTA | — |
| SEO | Gap | No `AboutPage` or `Organization` JSON-LD schema | Add structured data |
| Accessibility | OK | Heading hierarchy is clean | — |

### `/contact` (Contact Page)

| Area | Status | Issue | Fix |
|------|--------|-------|-----|
| Form | Good | Name, email, business, message fields with validation | — |
| UX | Good | Loading spinner, success/error messages | — |
| Conversion | Good | fbq/gtag events fire on submission (consent-gated now) | — |
| Accessibility | Gap | Form fields have no `aria-describedby` for error messages | Wire error messages to fields via `aria-describedby` |
| Accessibility | Gap | Success/error status not announced to screen readers | Add `role="alert"` on status messages |
| Rate limiting | Good | 3/hour per IP via KV | — |

### `/work` (Portfolio/Case Studies)

| Area | Status | Issue | Fix |
|------|--------|-------|-----|
| Content | Gap | **Placeholder only** — "coming soon" with empty grid | Add at least 1-2 case studies or remove from nav until ready |
| SEO | Gap | Page is indexed but has no real content | Add `noindex` until case studies exist, or add content |
| UX | Bad | Empty page damages credibility for visitors from nav | Either populate or hide from nav |

### `/blog` (Blog Index)

| Area | Status | Issue | Fix |
|------|--------|-------|-----|
| Content | OK | Lists posts from Keystatic, sorted by date | — |
| SEO | OK | Prerendered, blog cards have title/excerpt | — |
| Empty state | Gap | If no published posts, shows empty grid with no message | Add "No posts yet" empty state |
| Pagination | Gap | No pagination — all posts on one page | Fine for now (<20 posts), add when needed |
| Accessibility | Gap | Blog cards may lack focus indicators for keyboard nav | Ensure `:focus-visible` ring on card links |

### `/blog/[slug]` (Blog Post Detail)

| Area | Status | Issue | Fix |
|------|--------|-------|-----|
| Content | Good | Full Markdoc rendering, Article JSON-LD | — |
| SEO | Good | Article schema, title, description from frontmatter | — |
| Lead capture | Good | Newsletter signup + lead magnet CTA on every post | — |
| UX | Gap | No "Back to blog" link at top of post | Add breadcrumb or back link |
| UX | Gap | No estimated reading time | Add `Math.ceil(wordCount / 200)` min read |
| Accessibility | Gap | Markdoc-rendered HTML via `set:html` — not controllable for heading hierarchy | Validate Markdoc heading levels in content |
| Social sharing | Gap | No share buttons (FB, LinkedIn, X) | Consider adding — drives traffic |

### `/privacy` (Privacy Policy — new)

| Area | Status | Issue | Fix |
|------|--------|-------|-----|
| Content | Good | Covers data collection, cookies, retention, rights, AI | — |
| Accessibility | OK | Plain prose, heading hierarchy | — |
| Footer link | Gap | Not yet linked from footer | Add to footer nav |

---

## Layout & Navigation Audit

### PublicLayout.astro

| Area | Status | Issue | Fix |
|------|--------|-------|-----|
| Nav | Good | Desktop + mobile hamburger menu | — |
| Active state | Good | Current page highlighted in nav | — |
| Footer | Gap | Missing privacy policy link | Add `/privacy` to footer links |
| Footer | Gap | No current year in copyright | Use `new Date().getFullYear()` |
| Accessibility | Gap | Mobile menu button has no `aria-expanded` attribute | Add `aria-expanded="false/true"` toggle |
| Accessibility | Gap | Mobile menu has no `aria-label="Main navigation"` | Add landmark label |
| Skip link | Gap | No "Skip to content" link for keyboard users | Add hidden skip link before nav |
| Favicon | OK | SVG favicon present | — |

### SEOHead.astro

| Area | Status | Issue | Fix |
|------|--------|-------|-----|
| Meta | Good | Title, description, OG, Twitter cards, JSON-LD | — |
| Canonical | Gap | `canonicalUrl` prop exists but not always passed by pages | Ensure all pages pass canonical URL |
| OG Image | Gap | No default OG image — pages without `ogImage` prop have no social preview | Add fallback OG image |
| Structured data | Good | JSON-LD injection works | — |

---

# MARKETING ADMIN

---

## Admin Page Audit

### Dashboard (`/marketing-admin/`)

| Area | Status | Issue | Fix |
|------|--------|-------|-----|
| Stats | Good | Live stats via DashboardStats component | — |
| Quick actions | Good | Cards linking to Compose, Calendar, SEO, Analytics | — |
| UX | Gap | No recent activity feed (last 5 posts, latest failures) | Add recent posts list below stats |
| UX | Gap | Stats show `subscribers` field but this was changed to `drafts` — React component may still say "Subscribers" | Verify DashboardStats labels match new API shape |

### Compose (`/marketing-admin/compose`)

| Area | Status | Issue | Fix |
|------|--------|-------|-----|
| Form | Good | Title, content, platform toggles, datetime picker, AI assist, media upload | — |
| AI | Good | Prompt → Anthropic → fills content field | — |
| Upload | Good | Image preview with remove button | — |
| Validation | Gap | Client-side: no platform selection required — can schedule with no platforms | Add "select at least one platform" check before schedule |
| UX | Gap | No character count limits per platform (IG caption 2200, FB 63206, LI 3000, GBP 1500) | Add per-platform char counter with limits |
| UX | Gap | No preview of how post will look per platform | Low priority — but would improve UX |
| Error handling | Gap | If AI draft fails, error shown but user can lose typed content | Preserve content field on AI error |
| Scheduling | Gap | Can schedule in the past — no client-side check on datetime | Add `min` attribute on datetime input |

### Calendar (`/marketing-admin/calendar`)

| Area | Status | Issue | Fix |
|------|--------|-------|-----|
| View | Good | Posts grouped by date, platform badges, status colors | — |
| Filtering | Good | Status filter (all, scheduled, posted, failed) | — |
| AI suggest | Good | AI suggest week button for content ideas | — |
| UX | Gap | No visual calendar view (only grouped list) | Consider week/month grid view |
| UX | Gap | No drag-to-reschedule | Low priority — datetime edit is on PostDetail |
| Empty state | Gap | Shows "No posts found" text but no CTA | Add "Create your first post" link |

### Drafts (`/marketing-admin/drafts`)

| Area | Status | Issue | Fix |
|------|--------|-------|-----|
| List | Good | Shows all drafts with inline edit | — |
| Actions | Good | Archive, schedule (link to compose) | — |
| UX | Gap | Inline edit has no cancel button — only save | Add cancel button to discard changes |
| UX | Gap | No confirmation on archive action | Add "Archive this draft?" confirm |
| Empty state | OK | Shows "No drafts" message | — |
| Pagination | Gap | No pagination — LIMIT 50 in API | Fine for now, add if needed |

### Post Detail (`/marketing-admin/post/[id]`)

| Area | Status | Issue | Fix |
|------|--------|-------|-----|
| View | Good | Full post info, metadata, media preview | — |
| Edit | Good | Content + scheduled_at editable | — |
| Status actions | Good | Cancel, retry, reschedule | — |
| AI repurpose | Good | Repurpose to other platforms with copy button | — |
| UX | Gap | No confirmation on cancel action (irreversible) | Add "Cancel this post?" confirm |
| UX | Gap | Retry doesn't show when next retry will happen | Show "Will retry on next cron run (within 5 min)" |
| Error display | Good | Shows error_message for failed posts | — |
| Content history | Gap | `content_history_json` is saved but **not displayed** in the UI | Add "Edit history" expandable section showing previous versions |

### SEO Editor (`/marketing-admin/seo`)

| Area | Status | Issue | Fix |
|------|--------|-------|-----|
| CRUD | Good | Add/edit/delete SEO overrides by path | — |
| AI | Good | AI-generated title + description suggestions | — |
| Validation | Good | Character counters (60 title, 160 desc), path must start with / | — |
| UX | Gap | No preview of Google search result snippet | Add SERP preview component (title in blue, URL in green, desc in gray) |
| UX | Gap | Schema JSON field is raw text — easy to type invalid JSON | Add JSON validation on blur with error message |
| UX | Gap | No indication which pages DON'T have overrides — user doesn't know what's missing | Show list of all public routes with override status |

### Analytics (`/marketing-admin/analytics`)

| Area | Status | Issue | Fix |
|------|--------|-------|-----|
| Charts | Good | Bar chart for CF daily views with hover tooltip | — |
| Stats | Good | Page views, unique visitors, period selector | — |
| GA4 | Good | Snapshot table from D1 | — |
| UX | Gap | Chart is simple bars — no line chart option or comparison period | Low priority enhancement |
| Empty state | Good | Shows message when CF Analytics not configured | — |

### Token Manager (`/marketing-admin/tokens`)

| Area | Status | Issue | Fix |
|------|--------|-------|-----|
| Status | Good | valid/expiring_soon/expired/not_connected per platform | — |
| Connect form | Good | Platform-specific hints and fields | — |
| UX | Gap | **No disconnect button** — DELETE handler added to API but UI doesn't expose it | Add "Disconnect" button per connected platform |
| UX | Gap | No token refresh test button | Add "Test connection" that verifies token works |
| Security | Good | Tokens encrypted before storage, never shown in UI | — |

---

# CROSS-CUTTING CONCERNS

---

## Accessibility (WCAG 2.1 AA)

| Concern | Public Site | Admin | Fix |
|---------|------------|-------|-----|
| Skip-to-content link | Missing | N/A (single-user admin) | Add to PublicLayout |
| Focus indicators | Partial | Partial (React defaults) | Audit `:focus-visible` on all interactive elements |
| `aria-expanded` on menus | Missing | Missing | Add to both mobile menu buttons |
| `aria-label` on icon buttons | N/A | Missing on sidebar icons | Add labels to icon-only buttons |
| Color contrast | Good (dark text on light bg) | Good (light text on dark bg) | — |
| Form error announcements | Missing (`role="alert"`) | Missing | Add `role="alert"` to error containers |
| Heading hierarchy | Mostly OK | N/A (React manages) | Validate blog content headings |
| Alt text on images | N/A (few images) | Media preview needs alt | Add alt text to uploaded media previews |

## Error Handling (Frontend)

| Component | Error State | Issue | Fix |
|-----------|-----------|-------|-----|
| PostComposer | Shows error text | AI errors could lose typed content | Preserve content on error |
| ContentCalendar | Shows "Failed to load" | No retry button | Add retry button |
| DraftsList | Shows error text | OK | — |
| PostDetail | Shows error text | OK — individual action errors display inline | — |
| SeoEditor | Shows error text | OK | — |
| TrafficDashboard | Shows "not configured" | OK — graceful degradation | — |
| DashboardStats | Shows "—" on error | OK — individual stat fallbacks | — |
| TokenManager | Shows error text | OK | — |
| Contact form | Shows error + success | No retry button on error | Add "Try again" button |

## Responsiveness

| Page | Mobile | Tablet | Desktop | Issue |
|------|--------|--------|---------|-------|
| Landing | Good | Good | Good | — |
| Services | Good | Good | Good | Pricing cards stack well |
| About | Good | Good | Good | — |
| Contact | Good | Good | Good | — |
| Blog index | Good | Good | Good | Cards responsive |
| Blog post | Good | Good | Good | Prose width constrained |
| Privacy | Good | Good | Good | Max-w-3xl |
| Admin dashboard | OK | Good | Good | Stats cards could wrap better on small mobile |
| Admin compose | OK | Good | Good | Platform toggles may be cramped on narrow mobile |
| Admin calendar | OK | Good | Good | Date groups stack |

## Performance

| Concern | Status | Issue | Fix |
|---------|--------|-------|-----|
| JS bundle size | Good | Public pages ship zero JS (except contact form) | — |
| Admin JS | Acceptable | React islands load per-page, not a monolithic SPA | — |
| Image optimization | Gap | Uploaded media served as-is from R2 — no resizing or WebP conversion | Consider CF Image Resizing or sharp at upload time |
| Font loading | Good | System fonts (font-sans), no custom web fonts | — |
| CSS | Good | Tailwind tree-shakes unused styles | — |
| Prerendering | Good | Blog pages prerendered at build time | — |

---

# PRIORITY ACTIONS

---

### High (user-visible issues)

1. **Work page is empty** — placeholder damages credibility. Add content or hide from nav
2. **Privacy link missing from footer** — created the page but it's not linked
3. **DashboardStats label mismatch** — API returns `drafts` but component may still say "Subscribers"
4. **Token disconnect button missing** — API handler exists but UI doesn't expose it
5. **Content history not displayed** — `content_history_json` saved but PostDetail doesn't show it
6. **Past scheduling allowed** — no `min` attribute on datetime input in PostComposer

### Medium (UX improvements)

7. **No default OG image** — pages without ogImage have no social preview card
8. **No platform-specific char limits** — PostComposer should warn when exceeding platform limits
9. **No SERP preview** — SEO editor should show Google-style snippet preview
10. **No confirmation dialogs** — cancel/archive actions are immediate with no undo
11. **Mobile menu a11y** — add `aria-expanded` to both public and admin menu toggles
12. **Skip-to-content link** — add to PublicLayout for keyboard navigation
13. **Blog back link** — blog posts have no way to return to blog index
14. **Contact form error recovery** — add "Try again" button on error state

### Low (polish)

15. **Service page schema** — add JSON-LD `Service` or `Offer` structured data
16. **About page schema** — add `AboutPage` or `Organization` JSON-LD
17. **Blog reading time** — add estimated read time to post pages
18. **Calendar visual view** — month/week grid instead of grouped list
19. **Image optimization** — R2 images served full-size, no resizing
20. **Copyright year** — footer should use dynamic `new Date().getFullYear()`

---

*Frontend Audit v1.0 | 2026-03-24*

# UWC Marketing Site — Frontend Architecture Document
> **Version:** 1.0 | **Date:** 2026-03-24 | **Stack:** Astro 5, React 18, Tailwind CSS 4, Keystatic CMS
> **Purpose:** Frontend architecture — public site (SSR + prerendered), Keystatic CMS, React island admin components.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Tech Stack Decisions](#2-tech-stack-decisions)
3. [Public Site Architecture](#3-public-site-architecture)
4. [Keystatic CMS Integration](#4-keystatic-cms-integration)
5. [Marketing Admin Architecture](#5-marketing-admin-architecture)
6. [Layout System](#6-layout-system)
7. [Component Patterns](#7-component-patterns)
8. [SEOHead System](#8-seohead-system)
9. [Styling Conventions](#9-styling-conventions)
10. [Anti-Patterns](#10-anti-patterns)

---

## 1. System Overview

```
+-----------------------------------------------------------+
|                     Browser                                |
|                                                            |
|  PUBLIC PAGES (SSR + prerendered):                        |
|  +------------------------------------------------------+ |
|  | PublicLayout.astro (nav + footer + SEOHead)           | |
|  | Blog pages prerendered (Keystatic + Markdoc)          | |
|  | Contact form: vanilla JS fetch                        | |
|  +------------------------------------------------------+ |
|                                                            |
|  MARKETING ADMIN (React islands):                         |
|  +------------------------------------------------------+ |
|  | MarketingAdminLayout.astro (dark sidebar + shell)     | |
|  | React components with client:load directive           | |
|  | PostComposer, ContentCalendar, SeoEditor, etc.        | |
|  +------------------------------------------------------+ |
+-----------------------------------------------------------+
```

**Key architectural split:**
- Public site: Astro SSR, minimal JS, SEO-optimized, prerendered blog
- Admin panel: Astro shells wrapping React islands for rich interactivity

---

## 2. Tech Stack Decisions

| Concern | Public Site | Marketing Admin |
|---------|------------|-----------------|
| Rendering | SSR (Astro) + prerendered blog | SSR shell + React islands |
| Interactivity | Vanilla JS (contact form) | React 18 (client:load) |
| CMS | Keystatic (git-based) | D1 (social posts, SEO) |
| Styling | Tailwind CSS 4 | Tailwind CSS 4 (dark theme) |
| State | None (server-rendered) | React useState/useEffect |
| Data fetching | Astro frontmatter (D1 direct) | React fetch() to API routes |

**Why React for admin, vanilla for public?**
- Admin components have complex state: forms with AI assist, drag-to-schedule, file uploads, live stats
- Public site has near-zero interactivity: contact form is the only JS

---

## 3. Public Site Architecture

### Page types

| Page | Rendering | Data Source |
|------|-----------|------------|
| `/` (landing) | SSR | Hardcoded + D1 SEO override |
| `/services` | SSR | Hardcoded + D1 SEO override |
| `/about` | SSR | Hardcoded |
| `/contact` | SSR | Form → API |
| `/blog` | Prerendered | Keystatic reader |
| `/blog/[slug]` | Prerendered | Keystatic reader + Markdoc |
| `/work` | SSR | Keystatic or hardcoded |

### Blog page rendering (prerendered)

```astro
---
export const prerender = true

import { createReader } from '@keystatic/core/reader'
import config from '../../../keystatic.config'
import Markdoc from '@markdoc/markdoc'

export async function getStaticPaths() {
  const reader = createReader(process.cwd(), config)
  const slugs = await reader.collections.blog.list()
  return slugs.map(slug => ({ params: { slug } }))
}

const reader = createReader(process.cwd(), config)
const post = await reader.collections.blog.read(Astro.params.slug!)
const content = await post!.content()
const transformed = Markdoc.transform(content.node)
const html = Markdoc.renderers.html(transformed)
---
```

**Why prerendered?** `createReader` needs filesystem access — unavailable in CF Workers runtime.

---

## 4. Keystatic CMS Integration

```
Keystatic admin UI (/keystatic) → edits → Git commit → CF Pages rebuild → new static pages
```

### Content structure

```
content/
└── blog/
    └── {slug}/
        └── index.mdoc        # YAML frontmatter + Markdoc content (single file)
```

### Reader pattern (NOT Astro Content Collections)

`@keystatic/astro` does NOT register as Astro content collections. Use `createReader()` from `@keystatic/core/reader`.

---

## 5. Marketing Admin Architecture

### React island pattern

```astro
<!-- src/pages/marketing-admin/compose.astro -->
---
import MarketingAdminLayout from '../../layouts/MarketingAdminLayout.astro'
---
<MarketingAdminLayout title="Compose">
  <div id="composer-root">
    <!-- React takes over this div -->
  </div>
</MarketingAdminLayout>

<!-- React island hydrates client-side -->
<PostComposer client:load />
```

### Data flow in React islands

```
React component (browser)
    |
    v (fetch)
API route (/api/marketing-admin/*)
    |
    v (D1 query)
Data returned as JSON
    |
    v
React re-renders with data
```

### Admin component inventory

| Component | Page | Responsibility |
|-----------|------|---------------|
| DashboardStats | /marketing-admin/ | Live stats from /api/marketing-admin/stats |
| PostComposer | /compose | Draft + AI assist + image upload + schedule |
| ContentCalendar | /calendar | Calendar view, status filter, links to detail |
| DraftsList | /drafts | List, edit, archive, schedule drafts |
| PostDetail | /post/[id] | View, edit, reschedule, retry, cancel |
| SeoEditor | /seo | CRUD for seo_pages table |
| TrafficDashboard | /analytics | Bar chart + stat cards + period selector |
| TokenManager | /tokens | Connect/update platform tokens |

---

## 6. Layout System

### PublicLayout.astro (public pages)
- Responsive nav (mobile hamburger)
- 3-column footer
- SEOHead component (meta, OG, JSON-LD)
- D1 SEO override lookup (SSR pages only)
- Brand colors: cream/ink/terracotta/sage

### MarketingAdminLayout.astro (admin pages)
- Dark theme (bg-gray-900 sidebar)
- Fixed sidebar with 7 nav links
- Mobile menu toggle
- `noindex, nofollow` on all admin pages
- No SEOHead (admin doesn't need public SEO)

---

## 7. Component Patterns

### Public components: Astro (.astro)
```
SEOHead.astro           # Every public page
Nav.astro / Footer.astro
BlogCard.astro, ServiceCard.astro
```

### Admin components: React (.tsx)
```
PostComposer.tsx        # Complex form state
ContentCalendar.tsx     # Grouped list with filters
SeoEditor.tsx           # CRUD form
```

### When to use Astro vs React
- **Astro:** Static display, no state, server-rendered
- **React:** Forms with state, fetch calls, complex interactivity

---

## 8. SEOHead System

Every public page includes `SEOHead.astro`:

```astro
<SEOHead
  title="Web Design in Greenville SC"
  description="Custom websites for SC small businesses"
  ogImage="/images/og-home.jpg"
  canonicalUrl="https://upstate-web.com/"
  schema={localBusinessSchema}
/>
```

Features:
- Title with brand suffix (skipped if brand already in title)
- Open Graph + Twitter Card meta
- JSON-LD schema injection
- `noindex` prop for admin pages
- D1 SEO override takes precedence over Astro props

---

## 9. Styling Conventions

### Brand palette
```
--cream: #F7F4EF     (public backgrounds)
--ink: #1A1814       (public text)
--terracotta: #B85C38 (CTAs, accents)
--sage: #4A6741      (secondary accents)
```

### Admin palette
```
Sidebar: bg-gray-900
Body: bg-gray-800
Cards: bg-gray-700
Text: text-gray-100
```

### Tailwind v4 setup
Configured as Vite plugin (not @astrojs/tailwind):
```javascript
// astro.config.mjs
vite: { plugins: [tailwindcss()] }
```

---

## 10. Anti-Patterns

```
NEVER use React for public pages              → Astro SSR, zero JS shipped
NEVER use Astro Content Collections for blog  → use createReader() (Keystatic doesn't register collections)
NEVER skip Markdoc.transform() step           → raw AST won't render
NEVER call D1 from React components           → fetch API routes instead
NEVER use @astrojs/tailwind                   → use @tailwindcss/vite (Tailwind v4)
NEVER render admin pages without noindex      → search engines must not index admin
NEVER use `set:html` with user content        → only for Markdoc-rendered trusted HTML
```

---

*Frontend Architecture v1.0 | 2026-03-24*

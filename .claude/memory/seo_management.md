# seo_management.md — SEO Patterns

## SEOHead Component (src/components/SEOHead.astro)

```astro
---
interface Props {
  title: string
  description: string
  canonicalUrl?: string
  ogImage?: string
  schema?: object  // JSON-LD — pass null to use defaults
  noindex?: boolean
}
const {
  title,
  description,
  canonicalUrl = Astro.url.href,
  ogImage = '/images/og-default.jpg',
  schema,
  noindex = false,
} = Astro.props

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Upstate Web Co.",
  "url": "https://upstate-web.com",
  "email": "hello@upstate-web.com",
  "areaServed": ["Greenville", "Spartanburg", "Anderson", "Upstate South Carolina"],
  "serviceType": "Web Design",
  "priceRange": "$$",
}

const activeSchema = schema ?? (Astro.url.pathname === '/' ? localBusinessSchema : null)
---
<title>{title}</title>
<meta name="description" content={description} />
<link rel="canonical" href={canonicalUrl} />
{noindex && <meta name="robots" content="noindex,nofollow" />}

<!-- Open Graph -->
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:url" content={canonicalUrl} />
<meta property="og:image" content={ogImage} />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Upstate Web Co." />

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content={title} />
<meta name="twitter:description" content={description} />
<meta name="twitter:image" content={ogImage} />

<!-- JSON-LD -->
{activeSchema && (
  <script type="application/ld+json" set:html={JSON.stringify(activeSchema)} />
)}
```

## FAQ Schema (add to homepage and service pages)

```typescript
// Generate FAQ schema for pages that answer common questions
export function faqSchema(items: Array<{ question: string; answer: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": items.map(item => ({
      "@type": "Question",
      "name": item.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.answer,
      },
    })),
  }
}

// Usage in index.astro:
const faq = faqSchema([
  {
    question: "How much does a website cost in South Carolina?",
    answer: "A starter landing page costs $750–$1,200. A full business website with Stripe payments costs $1,800–$3,500. An online store costs $3,500–$7,500. All prices are one-time — no monthly fees.",
  },
  {
    question: "How long does it take to build a website?",
    answer: "Most projects launch in 2–3 weeks. Simple landing pages can be live in 7–10 days.",
  },
  {
    question: "Do you serve Spartanburg and Anderson?",
    answer: "Yes — we serve all of Upstate South Carolina including Greenville, Spartanburg, Anderson, Greer, Simpsonville, and surrounding areas.",
  },
])
```

## SEO Override Worker (src/pages/api/seo/[path].ts)

```typescript
// GET: fetch SEO override for a path (called by SEOHead at render time)
export async function GET({ params, locals }: APIContext) {
  const { DB } = locals.runtime.env
  const path = '/' + (params.path ?? '').replace(/^\//, '')
  const override = await DB.prepare(
    'SELECT * FROM seo_pages WHERE path = ?'
  ).bind(path).first() ?? null
  return Response.json(override)
}

// PUT: update SEO for a path (called from /marketing-admin/seo)
export async function PUT({ params, request, locals }: APIContext) {
  const { DB } = locals.runtime.env
  const body = await request.json()
  const path = '/' + (params.path ?? '').replace(/^\//, '')
  await DB.prepare(`
    INSERT INTO seo_pages (path, title, description, og_image_r2_key, schema_json, noindex, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(path) DO UPDATE SET
      title = excluded.title,
      description = excluded.description,
      og_image_r2_key = excluded.og_image_r2_key,
      schema_json = excluded.schema_json,
      noindex = excluded.noindex,
      updated_at = datetime('now')
  `).bind(path, body.title, body.description, body.ogImageR2Key, body.schemaJson, body.noindex ? 1 : 0).run()
  return Response.json({ ok: true })
}
```

## Astro Sitemap Setup

```typescript
// astro.config.mjs — add sitemap integration
import sitemap from '@astrojs/sitemap'

export default defineConfig({
  site: 'https://upstate-web.com',
  integrations: [
    sitemap({
      customPages: [
        'https://upstate-web.com/',
        'https://upstate-web.com/services',
        'https://upstate-web.com/about',
        'https://upstate-web.com/work',
        'https://upstate-web.com/contact',
        // Blog and case study slugs are added automatically via getStaticPaths
      ],
      filter: (page) => !page.includes('/marketing-admin'),
    }),
  ],
})
```

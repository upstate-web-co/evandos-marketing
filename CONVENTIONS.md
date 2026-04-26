# CONVENTIONS.md — uwc-marketing-site

---

## URL Patterns (Public)
```
/                      ← homepage
/services              ← services (no trailing slash)
/about
/work                  ← portfolio/case studies index
/work/[slug]           ← e.g. /work/smiths-bbq-restaurant
/blog
/blog/[slug]           ← e.g. /blog/how-much-does-a-website-cost-sc
/contact
```

## URL Patterns (Marketing Admin)
```
/marketing-admin                     ← dashboard
/marketing-admin/calendar            ← content calendar
/marketing-admin/compose             ← draft + schedule post
/marketing-admin/seo                 ← SEO editor
/marketing-admin/analytics           ← traffic dashboard
/marketing-admin/social/[platform]   ← platform-specific analytics
```

## Keystatic Content Slugs
```
blog posts:     kebab-case, descriptive, include location when local
                e.g. how-much-does-website-cost-south-carolina
                     web-design-greenville-sc-guide
case studies:   kebab-case, client slug
                e.g. smiths-bbq-restaurant-website
                     jones-hvac-landing-page
```

## D1 Tables (Marketing-Specific)
```
social_posts               ← scheduled/posted social content
social_tokens              ← OAuth2 tokens per platform
seo_pages                  ← SEO overrides by page path
analytics_daily            ← daily traffic snapshots
content_drafts             ← saved drafts before scheduling
```

## Social Platform Keys (in D1 social_tokens.platform)
```
facebook
instagram
linkedin
gbp                        ← Google Business Profile
```

## Post Status Values (social_posts.status)
```
draft
scheduled
posting                    ← in-progress, set by cron before API call
posted
failed
cancelled
```

## Component Names
```
SEOHead.astro              ← every public page, in layout
Nav.astro
Footer.astro
ContactForm.astro
BlogCard.astro
CaseStudyCard.astro
HeroSection.astro
ServiceCard.astro
PostComposer.astro         ← admin: multi-platform post editor
ContentCalendar.astro      ← admin: calendar view
SeoEditor.astro            ← admin: per-page SEO
TrafficDashboard.astro     ← admin: CF Analytics + GA4
```

## Library Files
```
src/lib/social/meta.ts     ← Facebook + Instagram
src/lib/social/linkedin.ts
src/lib/social/gbp.ts
src/lib/social/tokens.ts   ← token get/refresh/store
src/lib/social/scheduler.ts← cron post handler
src/lib/seo.ts
src/lib/analytics.ts
src/lib/ai-draft.ts
src/lib/email.ts
```

## API Response Shape
```
Success (single):  { ok: true, draft: { ... } }
Success (list):    { drafts: [ ... ] } or { posts: [ ... ] } or { pages: [ ... ] }
Error:             { error: "message" }
Error + details:   { error: "Validation failed", issues: [...] }
Cron result:       { processed: number, errors: string[] }
```

## Error Codes (implicit in responses — no `code` field yet)
```
Contact:   429 "Too many submissions"  |  400 "Validation failed"
Drafts:    400 "body is required"      |  400 "id is required"
Schedule:  400 "platform, content, and scheduled_at are required"
SEO:       400 "path is required"
Upload:    400 "No file provided"      |  400 "Unsupported file type"  |  400 "File too large"
Cron:      401 "Unauthorized"          |  500 "Database or encryption key not configured"
AI Draft:  400 "prompt is required"    |  502 "AI service error"
All:       500 "Database not configured"
```

## Content Draft Status Values (content_drafts.status)
```
draft
scheduled                ← after scheduling posts from it
archived                 ← soft-deleted
```

## Upload Validation
```
Allowed types:  image/jpeg, image/png, image/gif, image/webp
Max size:       10MB (10 * 1024 * 1024 bytes)
R2 key pattern: social/YYYY-MM/uuid.ext
Public URL:     {SITE_URL}/media/social/YYYY-MM/uuid.ext
```

## Tailwind: Brand Colours (match agency site)
```css
/* Primary palette — match the agency landing page */
--cream: #F7F4EF
--ink: #1A1814
--terracotta: #B85C38
--sage: #4A6741

/* Use Tailwind arbitrary values for brand colors: */
bg-[#B85C38]   text-[#1A1814]   etc.
/* Or extend tailwind.config.mjs with these as named colors */
```

## Tailwind: Admin Status Badges
```
Status posted:       bg-green-100 text-green-800
Status scheduled:    bg-blue-100 text-blue-800
Status failed:       bg-red-100 text-red-800
Status cancelled:    bg-gray-100 text-gray-600
Status draft:        bg-yellow-100 text-yellow-800
Status posting:      bg-indigo-100 text-indigo-800
Platform facebook:   bg-blue-600 text-white
Platform instagram:  bg-pink-600 text-white
Platform linkedin:   bg-sky-700 text-white
Platform gbp:        bg-amber-600 text-white
```

## Email Conventions
```
Contact form:  from contact@upstate-web.com → to hello@upstate-web.com
Welcome:       from hello@upstate-web.com → to subscriber
Lead magnet:   from hello@upstate-web.com → to subscriber
Cron alerts:   via Resend to ALERT_EMAIL env var
```

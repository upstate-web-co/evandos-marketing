# /seo-audit — Audit All Pages for SEO Gaps

When the user runs `/seo-audit`:

1. List all public routes from src/pages/ (exclude /api/*, /marketing-admin/*, /keystatic/*)
2. For each route check:
   - [ ] Unique title tag (under 60 chars)
   - [ ] Meta description (under 155 chars)
   - [ ] OG image set
   - [ ] Canonical URL
   - [ ] JSON-LD schema (LocalBusiness on /, Article on blog posts, WebPage elsewhere)
   - [ ] FAQ schema on homepage and services page
3. Output checklist format: ✅ / ⚠️ / ❌ per route per check
4. For each ❌ generate the SEOHead props fix
5. Check D1 for existing overrides:
```sql
SELECT path, title, description, noindex FROM seo_pages ORDER BY path;
```
6. Check sitemap is generating all public routes:
```bash
curl https://upstate-web.com/sitemap-index.xml
```

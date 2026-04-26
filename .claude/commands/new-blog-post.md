# /new-blog-post — Scaffold a New Blog Post

When the user runs `/new-blog-post`:

1. Ask for: post title, topic/angle, target keyword (SC-local preferred)
2. Generate the Keystatic .mdoc frontmatter:
```yaml
---
title: [title]
publishedAt: [today's date YYYY-MM-DD]
excerpt: [1-2 sentence summary for SEO]
seoTitle: [title under 60 chars]
seoDescription: [excerpt under 155 chars]
---
```
3. Suggest the slug (kebab-case, include location if local SEO)
4. Generate an outline: H2 structure for the post
5. Remind: open /keystatic in browser to create the post, or create the .mdoc file directly in content/blog/[slug].mdoc

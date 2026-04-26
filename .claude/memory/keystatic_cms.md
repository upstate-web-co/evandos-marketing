# keystatic_cms.md — Keystatic CMS Patterns

## What Keystatic manages (git-based, no D1)
- Blog posts: `content/blog/{slug}/index.mdoc` (frontmatter + markdoc in single file)
- Case studies: `content/work/{slug}/index.mdoc` (planned, not built yet)

## keystatic.config.ts (ACTUAL — as built)

```typescript
import { config, fields, collection } from '@keystatic/core'

export default config({
  storage: { kind: 'local' },  // switch to 'github' for production
  collections: {
    blog: collection({
      label: 'Blog Posts',
      slugField: 'title',
      path: 'content/blog/*/',     // TRAILING SLASH = directory format = index.mdoc
      format: { contentField: 'content' },  // single file with YAML frontmatter
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        description: fields.text({ label: 'Description', validation: { isRequired: true } }),
        publishedDate: fields.date({ label: 'Published Date', validation: { isRequired: true } }),
        ogImage: fields.image({ label: 'OG Image', directory: 'public/images/blog', publicPath: '/images/blog/' }),
        draft: fields.checkbox({ label: 'Draft', defaultValue: false }),
        content: fields.markdoc({ label: 'Content' }),
      },
    }),
  },
})
```

## Reading Keystatic in Astro (SSR mode)

```typescript
import { createReader } from '@keystatic/core/reader'
import Markdoc from '@markdoc/markdoc'
import keystaticConfig from '../../../keystatic.config'

const reader = createReader(process.cwd(), keystaticConfig)

// List all posts
const posts = await reader.collections.blog.all()
// Each post: { slug: string, entry: { title, description, publishedDate, draft, content } }

// Read single post
const post = await reader.collections.blog.read(slug)
if (!post) return Astro.redirect('/blog')

// Render markdoc content — MUST transform before rendering
const markdocContent = await post.content()
const transformed = Markdoc.transform(markdocContent.node)  // .node is required!
const rendered = Markdoc.renderers.html(transformed)
// Use: <div set:html={rendered} />
```

## KEY GOTCHAS (learned the hard way)

1. **Path trailing slash matters:**
   - `content/blog/*` → flat files: `content/blog/slug.yaml`
   - `content/blog/*/` → directories: `content/blog/slug/index.yaml`

2. **contentField = single frontmatter file, NOT separate files:**
   - `format: { contentField: 'content' }` means ONE file with YAML frontmatter
   - File: `content/blog/slug/index.mdoc` (frontmatter + content together)
   - The reader calls `splitFrontmatter()` internally

3. **Markdoc rendering pipeline:**
   - `post.content()` returns `{ node: ... }` — raw Markdoc AST
   - MUST call `Markdoc.transform(content.node)` before rendering
   - Then `Markdoc.renderers.html(transformed)` for HTML output

4. **@keystatic/astro does NOT integrate with Astro Content Collections:**
   - Cannot use `getCollection('blog')` from `astro:content`
   - Must use `createReader` from `@keystatic/core/reader`

5. **Blog pages MUST be prerendered for CF Pages:**
   - `createReader` uses Node.js `fs` — unavailable in CF Workers at runtime
   - Add `export const prerender = true` to every page that uses createReader
   - Add `getStaticPaths()` to dynamic routes like `[slug].astro`
   - Content updates require a rebuild (commit → CF Pages rebuild ~45s)

## How content updates deploy
1. Open `/keystatic` in the browser
2. Edit/create a blog post
3. In local mode: saves to filesystem
4. In GitHub mode: commits .mdoc file to GitHub → CF Pages rebuilds (~45s)

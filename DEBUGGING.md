# DEBUGGING.md — uwc-marketing-site

> Track debugging sessions, root causes, and fixes.
> Saves time when the same issue resurfaces.

---

## Debug Log

### 2026-03-23 — Keystatic reader returns 0 blog posts
**Symptom:** Blog index showed "No posts yet" despite content files existing in `content/blog/`.
**Root cause:** Three cascading issues: (1) `path: 'content/blog/*'` missing trailing slash — expected flat files not directories, (2) `format: { contentField: 'content' }` expects a single frontmatter file (`index.mdoc`), not separate `index.yaml` + `content.mdoc`, (3) Markdoc AST needs `Markdoc.transform()` before `Markdoc.renderers.html()`.
**Fix:** Changed path to `'content/blog/*/'`, combined data+content into single `index.mdoc` with YAML frontmatter, added `Markdoc.transform()` step.
**Time spent:** ~30 min. Required reading Keystatic reader source code (`generic-d96ea97c.node.js`) to understand `getEntryDataFilepath`, `listCollection`, and `loadDataFile` internals.

---

*Updated: 2026-03-23*

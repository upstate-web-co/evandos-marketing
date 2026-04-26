# Architecture Documentation Index — uwc-marketing-site

> Read these documents to understand the system. Read `BACKEND_ARCHITECTURE.md` and `SECURITY_ARCHITECTURE.md` before writing any new code.

---

## Documents

| Document | Scope | Read when... |
|----------|-------|-------------|
| [BACKEND_ARCHITECTURE.md](BACKEND_ARCHITECTURE.md) | Social posting pipeline, scheduler, tokens, AI, SEO, media, email | Writing any API route or lib function |
| [FRONTEND_ARCHITECTURE.md](FRONTEND_ARCHITECTURE.md) | Public Astro pages, Keystatic CMS, React island admin components | Building or modifying any page or component |
| [SECURITY_ARCHITECTURE.md](SECURITY_ARCHITECTURE.md) | Token encryption, cron auth, CF Access, upload validation, OWASP | Adding endpoints, handling secrets, touching auth |
| [DEPLOYMENT_ARCHITECTURE.md](DEPLOYMENT_ARCHITECTURE.md) | Pages deploy, cron Worker deploy, D1 migrations, local dev | Deploying, running locally, adding migrations |
| [TESTING_ARCHITECTURE.md](TESTING_ARCHITECTURE.md) | Vitest setup, D1 mock, scheduler mocking, test pyramid | Writing tests, understanding coverage |

---

## Reading Order

**New to the project:**
1. `../../docs/architecture-overview.md` (system-wide: all 3 repos)
2. `BACKEND_ARCHITECTURE.md` (how this repo works)
3. `SECURITY_ARCHITECTURE.md` (token encryption, auth)
4. `FRONTEND_ARCHITECTURE.md` (public site + admin UI)
5. `DEPLOYMENT_ARCHITECTURE.md` (dual deploy: Pages + cron Worker)
6. `TESTING_ARCHITECTURE.md` (D1 mock, scheduler tests)

**Adding a social platform:**
1. `BACKEND_ARCHITECTURE.md` sections 5 (social pipeline) + 7 (token management)
2. `SECURITY_ARCHITECTURE.md` section 3 (token encryption)
3. `TESTING_ARCHITECTURE.md` section 6 (adding scheduler tests)

**Debugging a failed post:**
1. `BACKEND_ARCHITECTURE.md` section 6 (scheduler) + section 8 (cron)
2. `DEPLOYMENT_ARCHITECTURE.md` section 9 (monitoring + cron Worker logs)

---

## Related Documentation

| File | Location | Purpose |
|------|----------|---------|
| CLAUDE.md | Project root | Architecture rules (numbered), anti-patterns, file structure |
| PROJECT_STATE.md | Project root | Current build phase, what's done, what's next |
| CONVENTIONS.md | Project root | Naming decisions, API shapes, status values |
| LESSONS.md | Project root | Dev lessons learned (Keystatic, Tailwind v4, etc.) |
| TESTING.md | Project root | Test plan, counts, what's tested vs not |
| architecture-overview.md | `docs/` (parent) | System-wide view of all 3 UWC repos |
| database_schema.md | `.claude/memory/` | Full D1 CREATE TABLE statements |
| social_media_apis.md | `.claude/memory/` | Platform API patterns, token management |

---

*Index v1.0 | 2026-03-24*

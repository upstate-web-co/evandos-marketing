# UWC Marketing Site — Testing Architecture Document
> **Version:** 1.0 | **Date:** 2026-03-24 | **Stack:** Vitest 4.1, better-sqlite3, TypeScript 5
> **Purpose:** Testing strategy, D1 mock architecture, test patterns, and coverage analysis.

---

## Table of Contents

1. [Testing Philosophy](#1-testing-philosophy)
2. [Test Pyramid](#2-test-pyramid)
3. [Test Infrastructure](#3-test-infrastructure)
4. [D1 Mock Architecture](#4-d1-mock-architecture)
5. [Test Categories](#5-test-categories)
6. [Test Patterns](#6-test-patterns)
7. [Adding New Tests](#7-adding-new-tests)
8. [Running Tests](#8-running-tests)
9. [What We Test vs What's Not Tested](#9-what-we-test-vs-whats-not-tested)
10. [Comparison with Agency Admin Testing](#10-comparison-with-agency-admin-testing)

---

## 1. Testing Philosophy

### Core principles

1. **Test the scheduler thoroughly** — it's the most complex and critical business logic. It runs unattended every 5 minutes.
2. **Test D1 query patterns against real schema** — inline SQL in API routes can't be type-checked, so test it against the real migration-applied schema.
3. **Mock external APIs, not D1** — social platform APIs are mocked with `vi.mock()`, but D1 is tested with real SQLite.
4. **Every validation rule gets a test** — contact form (Zod), upload (types/size), admin API inputs.

### How this differs from agency-admin

| Agency Admin | Marketing Site |
|-------------|---------------|
| Pure function tests (business-logic.ts) | D1 integration tests (SQL patterns) |
| Extracted Zod schemas in lib/schemas.ts | Inline validation in API routes |
| Single db.ts with typed wrappers | Inline D1 queries in routes |
| No D1 mock (tested manually) | better-sqlite3 D1 mock with real schema |
| 171 tests | 133 tests |

---

## 2. Test Pyramid

```
         /\
        /  \         E2E (not yet — Playwright + deployed CF Pages)
       /    \        - Full social posting flow
      /------\       - Contact form submission + email
     /        \
    / Scheduler\      Integration (133 tests today)
   / + D1 Tests \     - Scheduler with mocked platform APIs + real D1
  /--------------\    - D1 query patterns against real schema
 /                \   - Validation rules
/  Unit Tests      \  Pure Functions (14 tests)
/--------------------\  - isTokenExpired, isTokenExpiringSoon
```

### Why integration-heavy (different from agency-admin)

Agency-admin has `db.ts` with extracted, testable functions. This site has inline SQL in API routes.
The only way to verify those SQL patterns is to run them against a real schema — hence the D1 mock.

---

## 3. Test Infrastructure

### Dependencies

```json
{
  "devDependencies": {
    "vitest": "^4.1.1",
    "better-sqlite3": "^12.8.0",
    "@types/better-sqlite3": "^7.6.13"
  }
}
```

### Configuration

```typescript
// vitest.config.ts
export default defineConfig({
  test: { globals: true }
})
```

---

## 4. D1 Mock Architecture

The marketing site's D1 mock (`tests/d1/setup.ts`) has a key improvement over the agency-admin's:
it converts D1's `?1`, `?2` numbered placeholders to SQLite's positional `?`.

### Why this matters

D1 uses `?1`, `?2` style:
```sql
SELECT * FROM seo_pages WHERE path = ?1
```

better-sqlite3 uses positional `?`:
```sql
SELECT * FROM seo_pages WHERE path = ?
```

The `convertQuery()` function handles this translation:

```typescript
function convertQuery(query: string, values: unknown[]): { sql: string; params: unknown[] } {
  const params: unknown[] = []
  const sql = query.replace(/\?(\d+)/g, (_match, num) => {
    params.push(values[parseInt(num, 10) - 1]) // ?1 = values[0]
    return '?'
  })
  return { sql, params }
}
```

### Schema applied from real migrations

```typescript
const migration1 = readFileSync(join(migrationDir, '0001_marketing_schema.sql'), 'utf-8')
const migration2 = readFileSync(join(migrationDir, '0002_add_retry_count.sql'), 'utf-8')
```

Tests run against the exact production schema — indexes, defaults, constraints.

---

## 5. Test Categories

### Pure Function Tests (14 tests) — `tests/token-utils.test.ts`
- `isTokenExpired()`: past, future, boundary, malformed dates, empty strings
- `isTokenExpiringSoon()`: custom windows, GBP hourly scale, LinkedIn 60-day scale

### Validation Tests (45 tests) — `tests/validation.test.ts`
- Contact form Zod schema (11 tests)
- Upload type/size rules (9 tests)
- Drafts API validation (4 tests)
- Schedule API validation (5 tests)
- SEO API validation (4 tests)
- Token API validation (6 tests)
- Post detail PUT validation (3 tests)
- AI draft validation (5 tests)

### D1 Integration Tests (46 tests) — `tests/d1/`
- SEO: getSeoOverride, upsert, delete, list, index (12 tests)
- Drafts: insert, null title, COALESCE update, filter, media (5 tests)
- Social posts: scheduling, cron query, retry, cancel, indexes (12 tests)
- Admin stats: posts this week, scheduled, platforms, failed, empty (5 tests)
- Post detail: JOIN with drafts, standalone, dynamic PUT (7 tests)
- Schedule queries: JOIN + filter, ordering, NOT NULL constraints (8 tests)
- Token status: metadata only, status derivation, upsert, analytics daily (10 tests)

### Scheduler Tests (15 tests) — `tests/scheduler.test.ts`
- Happy path: empty queue, FB post, failure, missing token, media URL, retry, batch (7 tests)
- Edge cases: cancelled ignored, posted ignored, max retry, future skipped, mixed batch, absolute URL, null media, 10-post limit (8 tests)

---

## 6. Test Patterns

### Pattern: D1 query pattern testing

```typescript
// Test the exact SQL used in the API route
const { results } = await db.prepare(
  `SELECT * FROM social_posts
   WHERE (status = 'scheduled' AND scheduled_at <= datetime('now'))
      OR (status = 'failed' AND retry_count < ?1 AND scheduled_at <= datetime('now'))
   ORDER BY scheduled_at ASC LIMIT 10`
).bind(3).all()
```

### Pattern: Mocked social platform APIs

```typescript
vi.mock('../src/lib/social/meta', () => ({
  postToFacebook: vi.fn(),
  postToInstagram: vi.fn(),
}))

const mockedFacebook = vi.mocked(postToFacebook)
mockedFacebook.mockResolvedValue({ success: true, postId: 'fb_123' })
```

### Pattern: Token retrieval mock (Web Crypto unavailable in Node)

```typescript
vi.mock('../src/lib/social/tokens', async () => {
  const actual = await vi.importActual<typeof import('../src/lib/social/tokens')>('../src/lib/social/tokens')
  return { ...actual, getValidToken: vi.fn(), storeToken: vi.fn() }
})
```

### Pattern: Schema constraint testing

```typescript
it('enforces NOT NULL on platform', () => {
  expect(() => {
    sqlite.exec(`INSERT INTO social_posts (id, content, scheduled_at) VALUES (...)`)
  }).toThrow()
})
```

---

## 7. Adding New Tests

### New social platform
1. Add mock in `scheduler.test.ts` vi.mock block
2. Add scheduler test case for the new platform
3. Add token status test in `d1/token-status.test.ts`

### New API endpoint
1. Add validation tests in `validation.test.ts`
2. Add D1 query pattern tests in appropriate `tests/d1/` file

### New D1 table
1. Update `tests/d1/setup.ts` — add to `clearAllTables()`
2. Create new test file in `tests/d1/`

---

## 8. Running Tests

```bash
npm test              # vitest run (CI mode)
npm run test:watch    # vitest (watch mode)
npx vitest run tests/scheduler.test.ts   # single file
npx vitest run -t "cron"                 # pattern match
```

---

## 9. What We Test vs What's Not Tested

| Concern | Tested? | How |
|---------|---------|-----|
| Token expiry logic | Yes | Pure function tests |
| Scheduler dispatch | Yes | Mocked platform APIs + real D1 |
| D1 query patterns | Yes | Real SQLite with real schema |
| Validation rules | Yes | All admin endpoints |
| Schema constraints | Yes | NOT NULL, UNIQUE, indexes |
| Token encryption | No | Web Crypto not in Node (test manually on CF) |
| React components | No | Would need jsdom + RTL (low ROI) |
| Astro page rendering | No | Would need Astro test utils |
| R2 upload/serve | No | Needs R2 binding |
| CF Access middleware | No | Infrastructure, not code |
| External API contracts | No | Mocked — monitor via failed post alerts |

---

## 10. Comparison with Agency Admin Testing

| Dimension | Agency Admin | Marketing Site |
|-----------|-------------|---------------|
| **Test runner** | Vitest 4.1 | Vitest 4.1 |
| **D1 testing** | better-sqlite3 mock | better-sqlite3 mock + ?N placeholder conversion |
| **Primary test type** | Pure functions (business-logic.ts) | D1 integration + scheduler with mocks |
| **Validation testing** | Zod schemas in dedicated file | Inline validation patterns |
| **External API mocking** | N/A (no external APIs in tests) | vi.mock for Meta, LinkedIn, GBP, tokens |
| **Schema testing** | Applied via migrations | Applied via migrations + constraint tests |
| **Total tests** | 171 | 133 |
| **Test files** | 10 | 10 |

The approaches differ because the codebases differ: agency-admin extracts logic into `business-logic.ts` and `schemas.ts` (easy to unit test), while the marketing site has logic distributed across scheduler, tokens, and inline API validation (requires integration-style tests).

---

*Testing Architecture v1.0 | 2026-03-24*

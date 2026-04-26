# TESTING.md — uwc-marketing-site

> Testing strategy and plan. Covers what's tested, what's not, and why.

---

## Stack

```
Runner:     Vitest 4.x (globals: true)
D1 Mock:    better-sqlite3 in-memory (real migrations applied)
Mocking:    vi.mock for external APIs (social platforms, Anthropic)
Assertions: Vitest built-in expect
```

## Running Tests

```bash
npm test            # vitest run (single pass)
npm run test:watch  # vitest (watch mode)
```

---

## Test Categories

### 1. Pure Function Tests — `tests/token-utils.test.ts` (14 tests)
Tests for `isTokenExpired()` and `isTokenExpiringSoon()` from `src/lib/social/tokens.ts`.
These are the scheduling heartbeat — the cron worker uses them every 5 minutes to decide
whether to refresh tokens before posting.

**What's tested:**
- Past/future/boundary dates
- Custom minutesBefore parameter
- Edge case: exactly at expiry boundary
- Malformed inputs: date-only strings, non-UTC offsets, empty strings
- Platform-specific expiry scales: GBP (1-hour), LinkedIn (60-day)
- Zero-window edge case

### 2. Validation Tests — `tests/validation.test.ts` (45 tests)
Tests input validation rules across all marketing admin API endpoints.

**Contact form (Zod schema):**
- Required fields, email format, min/max lengths, optional business field

**Upload rules:**
- Allowed MIME types, rejected types (SVG, video, PDF), max file size

**Marketing admin endpoint validation:**
- Drafts: body required, type checking, empty/missing body
- Schedule: platform + content + scheduled_at all required, empty string rejection
- SEO: path required, type checking
- Tokens: platform + access_token + expires_at + account_id required, optional fields
- Post detail PUT: empty update rejection, single/multi field updates
- AI draft: prompt required, type checking, optional platform/existingContent

### 3. D1 Integration Tests — `tests/d1/` (46 tests across 7 files)
Uses an in-memory SQLite database with real migrations applied. Tests the exact SQL
query patterns used by API routes — not mock queries, but the same SQL strings.

**Files:**
- `setup.ts` — Creates D1-compatible mock from better-sqlite3, converts `?1`/`?2` placeholders
- `seo.test.ts` — `getSeoOverride()`, upsert on conflict, path uniqueness, delete, list ordering, index
- `drafts.test.ts` — Content drafts CRUD, COALESCE updates, status filter, media keys JSON
- `social-posts.test.ts` — Scheduling, cron due-post queries, retry logic, status transitions, all 4 indexes
- `admin-stats.test.ts` — Dashboard stats: posts this week, scheduled count, platforms, failures, empty state
- `post-detail.test.ts` — GET with LEFT JOIN to drafts, standalone posts, dynamic PUT field updates, reschedule/retry
- `schedule-query.test.ts` — Calendar query with JOIN + status filter, ordering, NOT NULL constraints, platform enum
- `token-status.test.ts` — Token metadata (no secrets exposed), status derivation, 4-platform listing, upsert, analytics daily

**Why test SQL patterns directly?**
Unlike the agency admin which has a `db.ts` with extracted functions, this site's queries are
inline in API routes. D1 tests verify the schema supports the queries we write — catching
column mismatches, missing indexes, and broken COALESCE patterns before deploy.

### 4. Scheduler Tests — `tests/scheduler.test.ts` (15 tests)
Tests `processScheduledPosts()` from `src/lib/social/scheduler.ts` — the core business logic
that runs every 5 minutes via cron. Mocks all external dependencies:

- Social platform APIs (Meta, LinkedIn, GBP) → vi.mock
- Token retrieval → vi.mock (avoids Web Crypto in Node)
- D1 → real in-memory SQLite via setup.ts

**What's tested (happy path):**
- Empty queue (no due posts)
- Successful Facebook posting → marks as posted with external_id
- Platform failure → records error, increments retry_count
- Missing token → graceful error handling
- Relative media URL → absolute URL resolution
- Failed post retry (under limit)
- Multiple due posts processed in order

**Edge cases:**
- Cancelled posts not picked up
- Already-posted posts not picked up
- Max retry count (3) posts not retried
- Future scheduled posts ignored
- Mixed success/failure in same batch
- Absolute media URLs preserved unmodified
- Null media for text-only posts
- 10-post batch limit per cron run

---

## What's NOT Tested (and why)

### Token Encryption (encrypt/decrypt)
Uses Web Crypto API (`crypto.subtle`) which isn't available in Node's test environment
without polyfills. The encrypt/decrypt functions are thin wrappers around AES-256-GCM.
**Risk:** Low — standard crypto, no custom logic beyond key derivation.
**Mitigation:** Manual smoke test on CF Workers where Web Crypto is native.

### Astro API Route Handlers
The API routes (`src/pages/api/**`) use Astro's `APIContext` type which requires the
full Astro runtime. Testing the request/response cycle would require an integration
test framework (e.g., Astro's test utils or supertest with a running server).
**Risk:** Medium — validation logic is tested separately, D1 patterns are tested.
**Mitigation:** The routes are thin wrappers: parse body → validate → D1 query → respond.
The D1 tests cover the query layer, validation tests cover the input layer.

### React Components (PostComposer, ContentCalendar, etc.)
Admin UI components are React islands with `client:load`. Testing would require
jsdom/happy-dom + React Testing Library.
**Risk:** Low — components are CRUD forms with fetch calls, not complex state machines.
**Future:** Add component tests if UI bugs become recurring.

### External API Contracts (Meta, LinkedIn, GBP, Anthropic)
We mock these in scheduler tests. We don't test the actual API response shapes.
**Risk:** Medium — API changes break posting silently.
**Mitigation:** Cron worker has retry logic (3x) and sends failure alert emails.
Monitor the `/marketing-admin` dashboard for failed post counts.

### R2 Upload/Serve
Requires R2 bucket binding, not available in test env.
**Risk:** Low — upload is a straightforward put-to-R2 with type/size validation.
The validation rules (types, size) are tested in validation.test.ts.

---

## D1 Mock Architecture

The test D1 mock (`tests/d1/setup.ts`) differs from the agency admin's in one key way:
it converts D1's `?1`, `?2` numbered placeholders to SQLite's positional `?` before
executing. This is necessary because all marketing site queries use D1-style placeholders.

```
D1 query:     SELECT * FROM seo_pages WHERE path = ?1
Converted:    SELECT * FROM seo_pages WHERE path = ?
Values:       reordered to match placeholder numbers
```

The mock applies real migrations (`migrations/0001_*.sql`, `0002_*.sql`) so tests
run against the exact production schema — including indexes and defaults.

---

## Adding New Tests

**Pure function?** Add to `tests/` root level. Import and test directly.

**D1 query pattern?** Add to `tests/d1/`. Use `createTestDB()` in `beforeEach`.
Insert seed data with `sqlite.exec()` or `db.prepare().bind().run()`.

**Mocked external API?** Follow the scheduler test pattern: `vi.mock()` the module,
use `vi.mocked()` for type-safe assertions on call arguments.

---

## Test Count: 133 tests across 10 files

```
tests/token-utils.test.ts          — 14 tests  (pure functions + edge cases)
tests/validation.test.ts           — 45 tests  (contact form + upload + all admin endpoint validation)
tests/d1/seo.test.ts               — 12 tests  (getSeoOverride + CRUD + upsert + index)
tests/d1/drafts.test.ts            —  5 tests  (content drafts CRUD patterns)
tests/d1/social-posts.test.ts      — 12 tests  (scheduling, cron queries, status, indexes)
tests/d1/admin-stats.test.ts       —  5 tests  (dashboard stats queries + empty state)
tests/d1/post-detail.test.ts       —  7 tests  (GET with JOIN + dynamic PUT updates)
tests/d1/schedule-query.test.ts    —  8 tests  (calendar query + filtering + NOT NULL constraints)
tests/d1/token-status.test.ts      — 10 tests  (token metadata + analytics_daily + upserts)
tests/scheduler.test.ts            — 15 tests  (scheduler happy path + 8 edge cases)
```

---

*Updated: 2026-03-24*

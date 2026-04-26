# DSA Audit — Both Repos
> **Date:** 2026-03-24 | **Scope:** uwc-agency-admin + uwc-marketing-site
> **Purpose:** Dual-scope DSA audit covering both definitions:
> - **DSA 1 — Data Structures & Architecture:** Schema design, data flow efficiency, query patterns, algorithmic concerns
> - **DSA 2 — Digital Services Act:** EU regulatory compliance for social media content scheduling, user-generated content, and transparency

---

# PART 1: DATA STRUCTURES & ARCHITECTURE

---

## 1.1 Schema Design Gaps

### Marketing Site

| # | Gap | Severity | Recommendation |
|---|-----|----------|----------------|
| S1 | **No index on `social_posts.posted_at`** — stats query `WHERE posted_at >= datetime('now', '-7 days')` does a full table scan on posted_at. With volume this becomes slow. | Medium | Add index: `CREATE INDEX idx_social_posts_posted_at ON social_posts(posted_at)` |
| S2 | **No composite index for cron query** — the scheduler query filters on `(status, scheduled_at)` and `(status, retry_count, scheduled_at)`. Individual indexes on each column are suboptimal. | Medium | Add composite: `CREATE INDEX idx_social_posts_cron ON social_posts(status, scheduled_at, retry_count)` |
| S3 | **`email_subscribers` table referenced in stats.ts but doesn't exist** — `stats.ts` queries `SELECT COUNT(*) FROM email_subscribers WHERE status = 'active'` but no migration creates this table. | High | Either create migration `0003_email_subscribers.sql` or remove the query from stats.ts |
| S4 | **No foreign key enforcement** — D1 supports `REFERENCES` syntax but doesn't enforce FK constraints by default. `social_posts.content_draft_id` references `content_drafts(id)` but orphans are possible. | Low | Acceptable for D1 (FK enforcement requires `PRAGMA foreign_keys = ON` per connection). App-layer integrity is sufficient. |
| S5 | **`analytics_daily` has no index on `date`** — queries `ORDER BY date DESC LIMIT ?1` perform full table scan + sort. | Low | Low volume (1 row/day), but add index if table grows: `CREATE INDEX idx_analytics_daily_date ON analytics_daily(date)` |
| S6 | **No `types/index.ts`** — D1 rows are untyped (`any`). Agency-admin has typed interfaces 1:1 with schema. | Medium | Create `src/types/index.ts` with `ContentDraft`, `SocialPost`, `SocialToken`, `SeoPage`, `AnalyticsDaily` interfaces. |

### Agency Admin

| # | Gap | Severity | Recommendation |
|---|-----|----------|----------------|
| S7 | **No D1 integration tests** — 40+ queries in `db.ts` tested only in production. Schema drift could break queries silently. | Medium | Port marketing site's better-sqlite3 D1 mock (with `?N` conversion). |
| S8 | **`buildUpdateFields` returns empty on all-undefined input** — calling `updateClient(db, id, {})` runs `UPDATE clients SET updated_at = datetime('now') WHERE id = ?` — a valid but wasteful query. | Low | Add early return in API route when no fields to update (like marketing site's `post/[id].ts` does). |

---

## 1.2 Data Flow & Algorithm Gaps

### Scheduler Algorithm

| # | Gap | Severity | Recommendation |
|---|-----|----------|----------------|
| F1 | **"posting" stuck state** — if Worker crashes between marking `status='posting'` and writing the result, the post is orphaned. The scheduler never queries for `status='posting'`. | High | Add to scheduler query: `OR (status = 'posting' AND updated_at <= datetime('now', '-10 minutes'))`. Treat stale "posting" as failed. |
| F2 | **No deduplication on retry** — if a post succeeds at the platform but the DB update fails, retry will double-post. | Medium | Before posting, check if `external_id` is already set. If so, skip the API call and just update status. |
| F3 | **LIMIT 10 per cron run with 5-min interval** — at max throughput, only 120 posts/hour can be processed. If a large batch is scheduled (e.g., 50 cross-platform posts), the queue drains slowly. | Low | Acceptable for current scale. If needed, increase LIMIT or reduce cron interval. |
| F4 | **Token refresh race condition** — if two posts for the same platform are due simultaneously, both may attempt to refresh the token. Second refresh may fail if first already consumed the old refresh_token. | Low | Add a per-platform lock (KV-based) or batch same-platform posts together. |

### SEO Override Lookup

| # | Gap | Severity | Recommendation |
|---|-----|----------|----------------|
| F5 | **SEO override queried on every SSR page load** — `getSeoOverride(db, path)` runs a D1 query per request. No caching. | Low | D1 queries are <1ms at edge. But could add a 60s KV cache for high-traffic pages. |
| F6 | **Prerendered pages can't use D1 SEO overrides** — blog pages use Keystatic frontmatter only. SEO editor changes to blog pages have no effect. | Medium | Document this clearly (done in FRONTEND_ARCHITECTURE.md). Consider adding frontmatter fallback to SEO editor UI. |

### Contact Form Rate Limiting

| # | Gap | Severity | Recommendation |
|---|-----|----------|----------------|
| F7 | **KV `put` race condition** — two simultaneous requests from same IP could both read count=2, both write count=3, allowing 4 submissions instead of 3. | Low | KV is eventually consistent. Acceptable for contact form (not a payment endpoint). |

---

## 1.3 Query Efficiency

| Query | Location | Issue | Fix |
|-------|----------|-------|-----|
| Stats: posts this week | stats.ts | Scans all posted rows, filters by `posted_at` | Add index on `posted_at` (S1) |
| Cron: due posts | scheduler.ts | OR condition on `status` + `retry_count` + `scheduled_at` | Add composite index (S2) |
| Calendar: all posts with JOIN | schedule.ts | `LEFT JOIN content_drafts` on every calendar load | Acceptable — low volume |
| Analytics: daily snapshots | ga4.ts | `ORDER BY date DESC LIMIT ?1` | Index on `date` for large datasets (S5) |
| SEO: path lookup | seo.ts | Indexed (`idx_seo_pages_path`) | No issue |
| Token: platform lookup | tokens.ts | `UNIQUE` constraint acts as index | No issue |

---

## 1.4 Data Structure Anti-Patterns

| Anti-Pattern | Where | Issue | Fix |
|-------------|-------|-------|-----|
| JSON in TEXT columns | `platforms_json`, `media_r2_keys_json`, `top_pages_json`, `source_json` | Not queryable by D1 SQL (no JSON functions in SQLite subset) | Acceptable — these are read/write blobs, not query targets. Would need junction tables to normalize. |
| No soft delete on social_posts | social_posts | `cancelled` status exists but no `deleted` status. No way to hide without actually deleting. | Low priority — cancelled posts are visible in calendar for audit trail. |
| Inconsistent error response shape | All admin APIs | `{ error }` without `code` field. Agency-admin uses `{ error, code }`. | Add machine-readable codes for frontend error handling. |

---

# PART 2: DIGITAL SERVICES ACT (EU DSA) COMPLIANCE

---

## 2.1 DSA Applicability Assessment

The Digital Services Act (Regulation (EU) 2022/2065) applies to providers of intermediary services in the EU. Assessment for Upstate Web Co:

| Question | Answer | DSA Implication |
|----------|--------|-----------------|
| Does the marketing site host user-generated content? | No — all content is authored by the agency owner | Not a hosting provider under DSA Art. 6 |
| Does it act as an intermediary? | No — it's a corporate website, not a platform | Not an intermediary service |
| Does it post to EU-regulated platforms? | Yes — posts to Facebook, Instagram, LinkedIn (all DSA-regulated platforms) | Indirect exposure: content must comply with platform ToS which implement DSA |
| Are EU users targeted? | No — Greenville SC small businesses are the target audience | Low EU exposure |
| Does it collect EU resident data? | Possibly — contact form + email signups have no geo-restriction | GDPR applies if EU data collected, DSA less so |

**Overall DSA risk: Low.** The site is a content publisher, not a platform. However, compliance gaps exist at the intersection of social media scheduling and EU platform rules.

---

## 2.2 DSA-Adjacent Compliance Gaps

Even though DSA doesn't directly regulate this site, these gaps matter because the platforms it posts to ARE regulated:

### Content Transparency

| # | Gap | Severity | Recommendation |
|---|-----|----------|----------------|
| C1 | **No content audit trail** — when a social post is edited after scheduling, the original content is overwritten. No history of what was posted vs what was originally drafted. | Medium | Add `content_history_json` column to `social_posts` or create a `post_revisions` table. Platforms may require proof of original content in disputes. |
| C2 | **No disclosure of AI-generated content** — posts created via AI Assist are flagged `ai_generated=1` in `content_drafts` but this flag doesn't carry to `social_posts`. Platforms increasingly require AI disclosure (Meta's AI labeling policy, EU AI Act). | Medium | Propagate `ai_generated` flag to `social_posts`. Consider adding AI disclosure text to posts where required by platform policy. |
| C3 | **No record of which platform-specific content was posted** — `content` in `social_posts` may differ from what the platform API actually published (e.g., Instagram truncates, LinkedIn reformats). `external_id` is stored but not the final published form. | Low | Store platform API response body or published URL for audit. |

### Data Retention & Right to Erasure

| # | Gap | Severity | Recommendation |
|---|-----|----------|----------------|
| C4 | **No data retention policy for contact form submissions** — emails sent via Resend have no automatic deletion. Personal data (name, email, message) persists in Resend's logs indefinitely. | Medium | Configure Resend data retention. Document retention period in privacy policy. |
| C5 | **No data deletion mechanism for email subscribers** — `email_subscribers` table (when created) needs an unsubscribe + delete flow. GDPR Art. 17 right to erasure. | Medium | Implement unsubscribe endpoint that deletes the row, not just marks inactive. |
| C6 | **Social tokens never purged** — tokens for disconnected platforms remain encrypted in D1 forever. | Low | Add a "disconnect" flow that deletes the token row, not just stops using it. |

### Cookie & Tracking Compliance

| # | Gap | Severity | Recommendation |
|---|-----|----------|----------------|
| C7 | **No cookie consent banner** — GA4 snippet (if added) sets cookies without consent. Meta Pixel and Google Ads tags (configured in wrangler.toml as `META_PIXEL_ID`, `GOOGLE_ADS_ID`) would require consent in EU. | High (if EU visitors) | Add cookie consent mechanism before loading GA4/Meta Pixel/Google Ads. CF Analytics is cookieless (no consent needed). |
| C8 | **No privacy policy page** — required if collecting any personal data (contact form, email signups). | High | Create `/privacy` page documenting data collection, retention, and rights. |
| C9 | **Retargeting pixels configured but no consent flow** — `META_PIXEL_ID` and `GOOGLE_ADS_ID` are wrangler.toml vars ready to be enabled. Enabling without consent violates ePrivacy Directive + GDPR. | Medium | Gate pixel loading behind consent. Or: don't enable until consent mechanism is built. |

### Platform Terms of Service

| # | Gap | Severity | Recommendation |
|---|-----|----------|----------------|
| C10 | **Automated posting without human review** — cron posts scheduled content without a final human review step. Some platform ToS discourage fully automated posting. | Low | The content IS human-authored (or human-reviewed AI draft). The scheduling is the automation, not the content creation. Document this in usage policy. |
| C11 | **No rate limiting on social posting** — scheduler could theoretically post 120 posts/hour per platform. Platforms have their own rate limits but hitting them causes bans. | Low | Add per-platform daily post limit (configurable). Most businesses post 1-3x/day. |

---

## 2.3 GDPR Intersection (Applies If EU Data Collected)

| Concern | Current State | Gap? | Fix |
|---------|--------------|------|-----|
| Lawful basis for contact form | None documented | Yes | Add consent checkbox or document legitimate interest in privacy policy |
| Lawful basis for email signup | None documented | Yes | Add explicit consent checkbox + record consent timestamp |
| Data processor agreements | Resend, Cloudflare, Anthropic all process data | Not documented | Document sub-processors in privacy policy |
| Data breach notification | No process | Yes | Document: notify ICO within 72 hours, notify data subjects if high risk |
| International data transfers | CF/Resend/Anthropic are US-based | Not documented | Rely on Standard Contractual Clauses (all three have SCCs) |

---

# PART 3: DOCUMENTATION GAPS

---

## 3.1 Marketing Site Documentation

| # | Gap | Status |
|---|-----|--------|
| D1 | No architecture docs | **Fixed** — 6 docs in `docs/architecture/` |
| D2 | CONVENTIONS.md incomplete | **Fixed** — expanded |
| D3 | No TESTING.md | **Fixed** — created |
| D4 | No `src/types/index.ts` | Open (see S6) |
| D5 | No privacy policy page | Open (see C8) |

## 3.2 Agency Admin Documentation

| # | Gap | Status |
|---|-----|--------|
| D6 | Architecture docs complete | No gap |
| D7 | No D1 integration test docs | Open — TESTING_ARCHITECTURE.md mentions "future" |

## 3.3 Shared Documentation

| # | Gap | Status |
|---|-----|--------|
| D8 | `architecture-overview.md` has outdated marketing site routes | Open |
| D9 | `shared-database.md` doesn't list marketing-only tables accurately | Open |
| D10 | No cross-repo D1 migration coordination doc | Open |
| D11 | No privacy/compliance documentation anywhere | Open (see C4-C9) |

---

# PART 4: CODE PATTERN GAPS

---

| Pattern | Agency Admin | Marketing Site | Gap? |
|---------|-------------|---------------|------|
| Zod validation | All routes | Contact form only | Yes — admin routes need Zod |
| Typed D1 wrappers | `src/lib/db.ts` | Inline queries | Yes — extract to db.ts |
| TypeScript interfaces | `src/types/index.ts` | None | Yes — create types file |
| Field allowlists | `buildUpdateFields()` | Hardcoded if-blocks | Minor |
| Error codes | `{ error, code }` shape | `{ error }` only | Minor — add codes |
| RETURNING * on INSERT | Consistent | Inconsistent | Minor — standardize |
| D1 integration tests | None | 46 tests with mock | Reversed gap — agency-admin should adopt |
| Webhook security | Stripe signature verify | Cron shared secret | Different concerns, both OK |
| Email templates | Branded HTML + escapeHtml | Plain text | Acceptable |
| AI integration | Anthropic SDK wrapper | Direct fetch | Minor — SDK adds type safety |

---

# PART 5: PRIORITY ACTIONS

---

### Critical (affects correctness or compliance)

1. **S3: Fix email_subscribers reference** — stats.ts references a nonexistent table (will 500 in production)
2. **F1: Fix "posting" stuck state** — add timeout in scheduler query
3. **C8: Create privacy policy page** — required for any personal data collection

### High (affects reliability or legal exposure)

4. **C7: Cookie consent before tracking pixels** — don't enable META_PIXEL_ID/GOOGLE_ADS_ID without consent
5. **C1: Content audit trail** — track post edits for platform compliance
6. **C2: AI content disclosure** — propagate ai_generated flag to social_posts
7. **S1+S2: Add missing D1 indexes** — posted_at and composite cron index

### Medium (improves code quality)

8. **S6: Create types/index.ts** — typed D1 rows
9. **A1: Zod schemas on admin routes** — stronger validation
10. **A2: Extract db.ts** — better testability
11. **B1: D1 tests for agency-admin** — port marketing site's mock

### Low (nice to have)

12. **F2: Deduplication on retry** — prevent double-posting
13. **C6: Token purge on disconnect** — clean up unused tokens
14. **A7/B6: CSP headers** — both repos
15. **C11: Per-platform daily post limit** — prevent rate limit bans

---

*DSA Audit v2.0 | 2026-03-24 | Both scopes: Data Structures & Architecture + Digital Services Act*

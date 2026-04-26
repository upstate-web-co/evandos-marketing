# Rules, Patterns & Modular Design Audit
> **Date:** 2026-03-24 | **Scope:** Cross-project rule comparison + repeatable pattern extraction + enforcement verification
> **Projects compared:** FarmCore (42 rules), MyChama Backend (20 rules), UWC Agency Admin (24 rules), UWC Marketing Site (20 rules)

---

# PART 1: MISSING RULES (learned from other projects)

Rules that other projects enforce but the marketing site lacks.

---

## Rules to Add from Agency Admin

| # | Agency Admin Rule | Marketing Site Status | Action |
|---|---|---|---|
| R8 | Every D1 write must `RETURNING *` | Inconsistent — some inserts don't return the row | Add rule, fix inserts |
| R10 | TypeScript strict — treat external data as unknown, never `any` | **32 uses of `(locals as any)`**, 11 uses of `: any` | Add rule, create typed env helper |
| R12 | Always return `{ error, code }` structured errors | `code` field added to Zod routes, but AI routes still return `{ error }` only | Add to all AI routes |
| R21 | Every bug gets a regression test | Not documented | Add rule |
| R22 | Pre-commit checks (no secrets, no console.log, no debug) | Not documented | Add rule |
| R23 | Extract at 3 — components and utilities | Not documented | Add rule + extract patterns |
| R24 | Single source of truth for constants | Status colors, platform labels duplicated across 3+ components | Add rule + extract |

## Rules to Add from FarmCore

| # | FarmCore Rule | Marketing Site Equivalent | Action |
|---|---|---|---|
| F3 | Money — ALWAYS Decimal, NEVER Float | N/A (no money in marketing site) | Skip |
| F12 | Consistent error envelope shape | Partially done (Zod routes have `code`, others don't) | Complete enforcement |
| F26 | Security headers — always active | Done (middleware.ts) | Already implemented |
| F34 | Timezone-aware dates | Social posts use ISO strings but no timezone awareness documented | Add rule |

## Rules to Add from MyChama Backend

| # | MyChama Rule | Marketing Site Equivalent | Action |
|---|---|---|---|
| M16 | Financial mutations use `transaction.atomic()` | Token store/update should be atomic (encrypt + write) | Document |
| M17 | Permissions in `get_permissions()`, not inline | N/A (no ViewSets) | Skip |
| M20 | Currency formatting via centralized filter | Platform labels duplicated — need centralized constants | Extract |

---

# PART 2: RULE ENFORCEMENT VIOLATIONS

Rules that exist in CLAUDE.md but aren't fully enforced in code.

---

| Rule | Violation | Files | Fix |
|------|-----------|-------|-----|
| **R5 (Zod validation)** | 5 AI routes lack Zod: `ai-seo.ts`, `ai-repurpose.ts`, `ai-calendar.ts`, `ai-subject-lines.ts`, `ai-blog-outline.ts` | 5 files | Add Zod schemas and wire them |
| **R12 (error shape)** | AI routes return `{ error }` without `code` field | 5 files | Add `code` to all error responses |
| **No `any` rule** | 32 uses of `(locals as any).runtime?.env` across all API routes | 23 files | Create typed `getEnv()` helper |
| **No `any` rule** | 11 `: any` type annotations in lib files | 10 files | Use proper types from `src/types/index.ts` |
| **Rule 8 (RETURNING *)** | `drafts.ts POST` fetches inserted row with `ORDER BY created_at DESC LIMIT 1` instead of RETURNING * | 1 file | Use RETURNING * pattern |

---

# PART 3: REPEATABLE PATTERNS FOR COMPONENT EXTRACTION

---

## React Admin — Extract These Patterns

### Pattern 1: `StatusBadge` (used 3+ times)
Status badge with color mapping appears in PostDetail, DraftsList, ContentCalendar.
```
statusStyles: Record<string, string> = {
  draft: 'bg-[#F7F4EF]/10 text-[#F7F4EF]/50',
  scheduled: 'bg-blue-900/30 text-blue-300',
  ...
}
```
**3 separate `statusStyles` objects** with same values in 3 files.
**Extract to:** `src/components/marketing-admin/StatusBadge.tsx`

### Pattern 2: `PlatformLabel` (used 3+ times)
Platform display names appear in PostDetail, ContentCalendar, PostComposer.
```
platformLabels: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram', ... }
```
**Extract to:** `src/lib/constants.ts` (shared between React and Astro)

### Pattern 3: `AdminInput` / `AdminTextarea` (19 occurrences)
The dark-themed input style appears 19 times across 7 components:
```
className="w-full bg-[#F7F4EF]/5 border border-[#F7F4EF]/10 rounded-lg px-3 py-2 text-sm text-[#F7F4EF]"
```
**Extract to:** `src/components/marketing-admin/AdminInput.tsx`

### Pattern 4: `AdminButton` (18 occurrences)
Primary button style appears 18 times across 14 files:
```
className="px-4 py-2 bg-[#B85C38] text-white ... rounded-lg hover:bg-[#a04e2f]"
```
**Extract to:** `src/components/marketing-admin/AdminButton.tsx`

### Pattern 5: `AlertMessage` (7 occurrences)
Success/error message banner appears in 7 components with identical pattern:
```tsx
{message && (
  <div role="alert" className={`px-4 py-2 rounded-lg text-sm ${message.type === 'success' ? '...' : '...'}`}>
    {message.text}
  </div>
)}
```
**Extract to:** `src/components/marketing-admin/AlertMessage.tsx`

### Pattern 6: `AdminSection` (used everywhere)
Dark-bordered section container appears in every admin component:
```
className="border border-[#F7F4EF]/10 rounded-xl p-5"
```
**Extract to:** `src/components/marketing-admin/AdminSection.tsx`

### Pattern 7: `getEnv()` helper (32 occurrences)
Every API route repeats:
```typescript
const env = (locals as any).runtime?.env ?? {}
const db = env.DB
if (!db) return Response.json({ error: 'Database not configured' }, { status: 500 })
```
**Extract to:** `src/lib/env.ts` — typed helper that eliminates `any` cast

---

## Public Site — Extract These Patterns

### Pattern 8: `SectionCTA` (4+ occurrences)
Dark CTA block with heading + description + button appears on landing, services, about, work pages:
```html
<div class="bg-[#1A1814] text-[#F7F4EF] rounded-xl p-8">
  <h2>...</h2>
  <p>...</p>
  <a href="/contact" class="... bg-[#B85C38] ...">...</a>
</div>
```
**Extract to:** `src/components/SectionCTA.astro`

---

# PART 4: NEW RULES TO ADD TO CLAUDE.md

Based on cross-project analysis, these rules should be added.

---

### Rule 17 (new): All API routes must use Zod validation — no exceptions
```
Every POST/PUT/DELETE handler MUST use a Zod schema from src/lib/schemas.ts.
NEVER validate with inline if-checks. ALWAYS use safeParse().
Error response: { error: 'Validation failed', code: 'VALIDATION_ERROR', issues: [...] }
```

### Rule 18 (new): Error responses must include a machine-readable code
```
ALL error responses must include a `code` field:
{ error: 'Human message', code: 'MACHINE_CODE' }
Codes: VALIDATION_ERROR, NOT_FOUND, UNAUTHORIZED, DB_NOT_CONFIGURED,
       AI_SERVICE_ERROR, UPLOAD_FAILED, DAILY_LIMIT_REACHED, RATE_LIMITED
```

### Rule 19 (new): Never use `any` type — use typed helpers
```
NEVER cast to `any`. Use src/lib/env.ts getEnv() helper for CF bindings.
Use types from src/types/index.ts for D1 rows.
Use Zod parsed.data for validated input.
```

### Rule 20 (new): Extract at 3 — components and constants
```
If a UI pattern appears 3+ times, extract to src/components/.
If a constant (status colors, platform labels) appears in 2+ files, extract to src/lib/constants.ts.
If a server pattern (env access, DB check) appears in 3+ files, extract to src/lib/.
```

### Rule 21 (new): Every bug gets a regression test
```
When a bug is found (BUG-NNN), write a test that reproduces it BEFORE fixing.
Test must fail before fix, pass after.
```

### Rule 22 (new): Pre-commit checks
```bash
npm test                                    # tests pass
grep -rE 'console\.log|debugger' src/      # no debug code
grep -rE 'sk-ant|re_|SOCIAL_TOKEN' src/    # no secrets
```

### Rule 23 (new): Dates are always UTC ISO strings
```
All dates stored in D1 are UTC ISO strings via datetime('now').
Display conversion to local time happens in the browser only.
Token expires_at compared with new Date().toISOString() (UTC).
```

---

# PART 5: ENFORCEMENT ACTIONS

---

### Critical (rule violations in production code)

1. **Add Zod to 5 AI routes** — ai-seo, ai-repurpose, ai-calendar, ai-subject-lines, ai-blog-outline
2. **Create `getEnv()` typed helper** — eliminates 32 `(locals as any)` casts
3. **Extract `constants.ts`** — statusStyles, platformLabels (deduplicate from 3+ components)
4. **Add `code` field to all error responses** — AI routes + subscribe + unsubscribe

### High (modular design improvements)

5. **Extract `AlertMessage.tsx`** — deduplicate from 7 components
6. **Extract `AdminInput.tsx`** — deduplicate 19 input style occurrences
7. **Extract `AdminButton.tsx`** — deduplicate 18 button style occurrences
8. **Extract `StatusBadge.tsx`** — deduplicate from 3 components

### Medium (code quality)

9. **Fix drafts.ts RETURNING *** — replace ORDER BY LIMIT 1 with RETURNING *
10. **Add new rules 17-23 to CLAUDE.md**
11. **Add pre-commit checks documentation**

---

*Rules & Patterns Audit v1.0 | 2026-03-24*

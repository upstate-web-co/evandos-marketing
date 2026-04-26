# UWC Marketing Site — Security Architecture Document
> **Version:** 1.0 | **Date:** 2026-03-24
> **Purpose:** Security posture for the marketing site — token encryption, cron authentication, CF Access, upload validation, rate limiting, and OWASP assessment.

---

## Table of Contents

1. [Security Model Overview](#1-security-model-overview)
2. [Authentication — CF Access + Cron Secret](#2-authentication)
3. [Token Encryption (AES-256-GCM)](#3-token-encryption)
4. [Input Validation](#4-input-validation)
5. [SQL Injection Prevention](#5-sql-injection-prevention)
6. [XSS Prevention](#6-xss-prevention)
7. [File Upload Security](#7-file-upload-security)
8. [Rate Limiting](#8-rate-limiting)
9. [Secret Management](#9-secret-management)
10. [OWASP Top 10 Assessment](#10-owasp-top-10-assessment)
11. [Security Checklist](#11-security-checklist)
12. [Incident Response](#12-incident-response)

---

## 1. Security Model Overview

```
                    TRUST BOUNDARIES
                         |
  Internet               |              Cloudflare Edge
  (untrusted)            |              (trusted infra)
                         |
  Public visitor --> No auth ---------> Public pages + /api/contact
                         |
  Admin (you) --> CF Access JWT ------> /marketing-admin/* + admin APIs
                         |
  Cron Worker --> x-cron-secret ------> POST /api/social/cron
                         |
  Social APIs <-- encrypted tokens <-- D1 (AES-256-GCM)
                         |
                    TRUST BOUNDARIES
```

### Unique security concerns vs agency-admin

| Concern | Agency Admin | Marketing Site |
|---------|-------------|---------------|
| Auth | CF Access only | CF Access + cron secret + public endpoints |
| Secrets at rest | None (API keys in env) | Social tokens encrypted in D1 |
| Public surface | None (all behind CF Access) | Public site + contact form + media |
| Rate limiting | Not needed (admin only) | KV-based on contact form |

---

## 2. Authentication

### CF Access (admin pages)
Same pattern as agency-admin. Protects `/marketing-admin/*`.
Defense-in-depth middleware at `src/middleware.ts` checks `cf-access-authenticated-user-email` header.

### Cron Secret (scheduler endpoint)
`POST /api/social/cron` is called by the standalone cron Worker, not by a browser.
Auth: `x-cron-secret` header must match `CRON_SECRET` env var.

```typescript
const cronSecret = env.CRON_SECRET
if (cronSecret) {
  const authHeader = request.headers.get('x-cron-secret')
  if (authHeader !== cronSecret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
}
```

### Public endpoints (no auth)
- `GET /` through `/contact` — public pages
- `POST /api/contact` — rate limited by IP
- `GET /media/*` — public cached media

---

## 3. Token Encryption

Social platform tokens are sensitive credentials. They're encrypted at rest using AES-256-GCM.

### Encryption flow

```
plaintext token
    |
    v
PBKDF2 key derivation (100K iterations, SHA-256)
  input: SOCIAL_TOKEN_ENCRYPTION_KEY env var (padded/sliced to 32 bytes)
  salt: "uwc-social-tokens" (static)
    |
    v
AES-256-GCM encrypt
  iv: 12 random bytes (per-encryption)
    |
    v
base64(iv + ciphertext) → stored in D1 social_tokens.access_token
```

### Decryption

Only happens server-side in Workers, right before API calls.

### Key management

- `SOCIAL_TOKEN_ENCRYPTION_KEY` is a CF Pages secret
- If key is lost/rotated, all stored tokens become unreadable
- No key rotation mechanism yet — would require re-encrypting all tokens

### What tokens.ts GET endpoint returns

```typescript
// Returns status, NOT actual tokens
{
  platform: 'facebook',
  account_id: 'page-123',
  status: 'valid',      // derived from isTokenExpired/isTokenExpiringSoon
  expires_at: '2099-01-01T00:00:00Z'
}
// access_token and refresh_token are NEVER in the response
```

---

## 4. Input Validation

### Contact form (only Zod-validated endpoint)

```typescript
const contactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
  business: z.string().max(200).optional().default(''),
  message: z.string().min(10).max(5000),
})
```

### Admin API endpoints (inline validation)

Admin APIs use inline `if (!field)` checks rather than Zod schemas. This is a known gap — the validation is functional but not as rigorous as the agency admin's Zod-everywhere approach.

| Endpoint | Validation |
|----------|-----------|
| drafts POST | `!content \|\| typeof content !== 'string'` |
| schedule POST | `!platform \|\| !content \|\| !scheduled_at` |
| seo POST | `!path \|\| typeof path !== 'string'` |
| tokens POST | `!platform \|\| !access_token \|\| !expires_at \|\| !account_id` |
| upload POST | MIME type + file size checks |
| ai-draft POST | `!prompt \|\| typeof prompt !== 'string'` |

---

## 5. SQL Injection Prevention

All queries use prepared statements with `.bind()`:

```typescript
db.prepare('SELECT * FROM seo_pages WHERE path = ?1').bind(path).first()
```

**No dynamic field name construction** — unlike the agency admin, this site doesn't have a `buildUpdateFields()` pattern. The post detail PUT endpoint constructs dynamic updates, but field names are hardcoded, not from user input:

```typescript
if (content !== undefined) updates.push(`content = ?${bindIndex}`)
if (scheduled_at !== undefined) updates.push(`scheduled_at = ?${bindIndex}`)
if (status !== undefined) updates.push(`status = ?${bindIndex}`)
```

---

## 6. XSS Prevention

- **Astro auto-escaping** for public pages
- **React auto-escaping** for admin components (JSX)
- **Blog content:** `set:html` used for Markdoc-rendered HTML (trusted — comes from git, not user input)
- **No `dangerouslySetInnerHTML`** in React components

---

## 7. File Upload Security

### Validation

```typescript
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB
```

### R2 key isolation

Keys use UUID, not user-controlled filenames:
```
social/2026-03/a1b2c3d4-e5f6-7890.jpg
```

No path traversal risk — user controls nothing in the key except the file extension (extracted from original filename).

---

## 8. Rate Limiting

### Contact form (KV-based)

```typescript
// 3 submissions per IP per hour
const rateLimitKey = `contact:${ip}`
const count = await env.RATE_LIMIT.get(rateLimitKey)
if (count >= 3) return Response.json({ error: 'Too many submissions' }, { status: 429 })
await env.RATE_LIMIT.put(rateLimitKey, String(count + 1), { expirationTtl: 3600 })
```

### Admin APIs — no rate limiting (behind CF Access)

### Cron endpoint — no rate limiting (secret-protected, only called by cron Worker)

---

## 9. Secret Management

| Secret | Storage | Purpose |
|--------|---------|---------|
| Social tokens | D1 (AES-256-GCM encrypted) | Platform API access |
| App credentials | CF Pages env vars | LinkedIn/Google OAuth2 client ID/secret |
| CRON_SECRET | CF Pages env var | Shared between cron Worker and Pages |
| SOCIAL_TOKEN_ENCRYPTION_KEY | CF Pages env var | AES key for token encryption |
| API keys | CF Pages env vars | Resend, Anthropic, CF Analytics |

### Rules

```
NEVER return token values in API responses    → return status only
NEVER log decrypted tokens                    → log platform name, not token
NEVER store tokens in browser (localStorage)  → tokens are server-side only
NEVER commit .dev.vars or .env files          → gitignored
```

---

## 10. OWASP Top 10 Assessment

| # | Vulnerability | Status | How Mitigated |
|---|--------------|--------|---------------|
| A01 | Broken Access Control | Mitigated | CF Access (admin), KV rate limit (public) |
| A02 | Cryptographic Failures | Mitigated | AES-256-GCM for tokens, CF handles TLS |
| A03 | Injection | Mitigated | Prepared statements on all D1 queries |
| A04 | Insecure Design | Mitigated | Tokens encrypted at rest, cron uses shared secret |
| A05 | Security Misconfiguration | Low risk | CF manages infra, secrets in env vars |
| A06 | Vulnerable Components | Monitor | npm audit, keep deps updated |
| A07 | Auth Failures | Mitigated | CF Access (no custom auth) |
| A08 | Software/Data Integrity | Mitigated | Cron secret, Zod on contact form |
| A09 | Logging Failures | Partial | console.error + wrangler tail (no structured logging) |
| A10 | SSRF | Low risk | Workers only call whitelisted social APIs |

### Gaps

1. **No Zod schemas on admin API routes** — inline validation is weaker
2. **No Content-Security-Policy headers** on public pages
3. **No automated npm audit in CI**
4. **No key rotation mechanism** for SOCIAL_TOKEN_ENCRYPTION_KEY
5. **Static PBKDF2 salt** — "uwc-social-tokens" is hardcoded (acceptable for single-tenant)

---

## 11. Security Checklist

### For every new API route

- [ ] Uses prepared statements with `.bind()` for all D1 queries
- [ ] Validates all required fields before D1 operations
- [ ] Returns `{ error: "message" }`, not stack traces
- [ ] `console.error()` for server-side logging
- [ ] No secrets in response body

### For every new social platform

- [ ] Tokens encrypted via `storeToken()` before D1 insert
- [ ] Token retrieval via `getValidToken()` (decrypts automatically)
- [ ] Refresh logic handles expiry gracefully
- [ ] Platform API called from Worker only, never browser

### For every deploy

- [ ] `npm test` passes (133 tests)
- [ ] `grep -r 'sk-ant\|re_\|SOCIAL_TOKEN' src/` returns nothing
- [ ] No `.env` or `.dev.vars` committed

---

## 12. Incident Response

### If SOCIAL_TOKEN_ENCRYPTION_KEY is leaked

1. Rotate the key in CF Pages env vars
2. All stored tokens are now unreadable (need re-entry via admin UI)
3. Redeploy Pages + cron Worker
4. Verify no tokens were exfiltrated (check CF Worker logs)

### If a social platform token is compromised

1. Revoke the token in the platform's dashboard (Meta, LinkedIn, Google)
2. Update via /marketing-admin/tokens with new token
3. Token is re-encrypted on store

### If the cron secret is leaked

1. Change `CRON_SECRET` in both CF Pages env vars AND cron Worker env vars
2. Redeploy both: `npm run deploy` + `cd workers/cron && wrangler deploy`

---

*Security Architecture v1.0 | 2026-03-24*

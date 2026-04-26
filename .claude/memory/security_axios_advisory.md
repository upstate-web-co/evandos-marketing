---
name: security_axios_advisory
description: Axios v1.14.1 and v0.30.4 RAT advisory — pinned versions and overrides applied across all repos (2026-03-31)
type: project
---

## Axios Security Advisory — Compromised Versions (2026-03-31)

**Reported:** axios versions **1.14.1** and **0.30.4** contain an internal RAT (Remote Access Trojan) that compromises env files and other sensitive data.

**Why:** These versions could exfiltrate secrets (.env, credentials) from any project that installs them — either directly or via transitive dependencies.

**How to apply:** Never upgrade axios past 1.13.6 until a verified safe release is confirmed. Check lock files and node_modules when onboarding new dependencies.

---

### Our Exposure Status: NOT AFFECTED

None of our repos had the compromised versions installed. All were on safe versions (1.13.6 or 1.7.9).

### Mitigation Applied (2026-03-31)

**1. Version pinning (removed `^` caret) — 5 package.json files:**

| Repo | Pinned Version |
|------|---------------|
| autorepairshop/packages/api-client | `1.13.6` |
| autorepairshop/apps/admin | `1.13.6` |
| autorepairshop/apps/customer | `1.13.6` |
| farmcore/frontend | `1.13.6` |
| reactnodefullstack/afya/frontend | `1.7.9` |

**2. npm `overrides` added — same 5 package.json files:**
Redirects any transitive dependency on axios@1.14.1 or axios@0.30.4 to the safe pinned version. Prevents sub-dependencies from pulling in compromised versions.

**3. `.npmrc` with `save-exact=true` — 7 repo roots:**
- autorepairshop/
- farmcore/
- reactnodefullstack/
- uwc-web-co/uwc-marketing-site/
- uwc-web-co/uwc-agency-admin/
- uwc-web-co/uwc-client-portal/
- uwc-web-co/uwc-base-template/

Prevents future `npm install <pkg>` from adding caret ranges.

### Repos WITHOUT Axios (no action needed)
All UWC Web Co repos (marketing-site, agency-admin, client-portal, base-template, video-pipeline, all client sites) and all Mychama repos use native `fetch` — no axios dependency.

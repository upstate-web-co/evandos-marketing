#!/bin/bash
# Fetches live data from agency-admin D1 and writes chat context JSON.
# Run before build or on-demand to refresh chat agent context.
# Usage: ./scripts/refresh-chat-context.sh

set -e

OUT="src/lib/chat-context-data.json"

echo "[chat-context] Querying agency-admin D1..."

# Active projects with public-safe fields
PROJECTS=$(npx wrangler d1 execute agency-db --remote --json --command "
  SELECT p.title, p.current_phase, p.project_type, p.tier, p.live_url,
         c.business_name
  FROM projects p
  LEFT JOIN clients c ON p.client_id = c.id
  WHERE p.status = 'active'
  ORDER BY p.created_at DESC
" 2>/dev/null)

# Counts
CLIENTS=$(npx wrangler d1 execute agency-db --remote --json --command "
  SELECT COUNT(*) as count FROM clients WHERE status = 'active'
" 2>/dev/null)

COMPLETED=$(npx wrangler d1 execute agency-db --remote --json --command "
  SELECT COUNT(*) as count FROM projects WHERE current_phase IN ('launch', 'maintenance')
" 2>/dev/null)

# Recent agent reports
REPORTS=$(npx wrangler d1 execute agency-db --remote --json --command "
  SELECT agent_type, title FROM agent_reports ORDER BY created_at DESC LIMIT 5
" 2>/dev/null)

# Build JSON using node
#
# Session 2B (2026-04-24) — tiers, processes, stack, differentiators, launchedOn
# are baked into this script so chat personas stop hardcoding them. When UWC
# pricing or stack decisions change, update the block below + re-run the
# script (or let the next deploy's prebuild hook refresh it). Sourced from
# CLAUDE.md Rules 50, 66, 71, 72, 73 + BUSINESS.md tier rows.
node -e "
const projects = ${PROJECTS};
const clients = ${CLIENTS};
const completed = ${COMPLETED};
const reports = ${REPORTS};

const rows = projects[0]?.results || [];
const clientCount = clients[0]?.results?.[0]?.count || 0;
const completedCount = completed[0]?.results?.[0]?.count || 0;
const reportRows = reports[0]?.results || [];

const context = {
  summary: {
    activeClients: clientCount,
    activeProjects: rows.length,
    completedProjects: completedCount,
  },
  portfolio: rows
    .filter(p => p.live_url)
    .map(p => (p.business_name || p.title) + ' (' + p.project_type + ', ' + p.live_url + ')'),
  currentWork: rows
    .filter(p => !['launch','maintenance'].includes(p.current_phase))
    .map(p => (p.business_name || p.title) + ' — ' + p.current_phase + ' phase'),
  recentGovernance: reportRows.map(r => r.title),
  tiers: [
    { name: 'Spark', range: '\$350–\$750', timeline: '3–5 days', scope: 'A rapid single-page site — portfolio, landing, microsite' },
    { name: 'Starter', range: '\$750–\$1,200', timeline: '1–2 weeks', scope: 'A polished 3–5 page small-business site' },
    { name: 'Business', range: '\$1,800–\$3,500', timeline: '2–3 weeks', scope: 'Multi-page site with booking, contact flows, blog' },
    { name: 'Store', range: '\$3,500–\$7,500', timeline: '3–4 weeks', scope: 'E-commerce with Stripe, cart, inventory basics' },
    { name: 'Custom App', range: '\$3,500–\$15,000+', timeline: '4–12 weeks', scope: 'Django + React custom application, with 3 client sign-off gates' },
  ],
  processes: {
    website: 'Discovery → Design → Build → Review → Launch → Maintenance',
    app: 'Discovery → Architecture → UX Prototype (Gate 1 signoff) → Backend → API → Frontend MVP (Gate 2 signoff) → Integration → Production readiness → Deploy → Marketing site (Gate 3 signoff, Launch)',
  },
  stack: {
    websites: 'Astro 5 + Cloudflare Pages + D1 + R2 + Tailwind v4',
    apps: 'Django + PostgreSQL + React, deployed on Fly.io (default) or Hetzner',
  },
  differentiators: [
    { label: 'Automated design-direction pipeline', detail: 'Every brand questionnaire auto-generates three direction candidates (typography + palette + layout) for the client to pick — prevents the \"AI-slop\" sameness most builders produce.' },
    { label: 'Three-gate app workflow', detail: 'Custom apps ship through Prototype / MVP / Launch gates with explicit client sign-off at each — no surprise at handoff.' },
    { label: 'Self-serve client portal', detail: 'Clients approve gates, request content edits, annotate screenshots, restart app services, and file incidents directly — no support ticket ping-pong for routine things.' },
    { label: '10-agent governance review', detail: 'Every project is reviewed by specialized agents (Ghost User, Ghost Creator, Stack Optimiser, Software Dev, Marketing Exec, Portal Customer, and more) before and during delivery — a structured quality check, not a vibe-check.' },
    { label: 'Hand-coded, client-owned', detail: 'No WordPress, no page builder, no vendor lock-in. Clients get the code, the repo, the domain. If UWC disappeared, they could hire anyone.' },
  ],
  launchedOn: 'April 7, 2026',
  updatedAt: new Date().toISOString(),
};

require('fs').writeFileSync('${OUT}', JSON.stringify(context, null, 2));
console.log('[chat-context] Written to ${OUT}');
console.log('[chat-context] ' + context.summary.activeProjects + ' projects, ' + context.portfolio.length + ' live, ' + context.currentWork.length + ' in progress, ' + context.tiers.length + ' tiers');
"

# analytics_traffic.md — CF Analytics + GA4

## CF Analytics Worker

```typescript
// src/pages/api/analytics/cf.ts
export async function GET({ request, locals }: APIContext) {
  const { CF_ANALYTICS_TOKEN, CF_ZONE_ID } = locals.runtime.env
  const url = new URL(request.url)
  const days = url.searchParams.get('days') ?? '30'

  const query = `
    query {
      viewer {
        zones(filter: { zoneTag: "${CF_ZONE_ID}" }) {
          httpRequests1dGroups(
            limit: ${days}
            filter: { date_gt: "${new Date(Date.now() - parseInt(days) * 86400000).toISOString().split('T')[0]}" }
            orderBy: [date_ASC]
          ) {
            date: dimensions { date }
            sum { pageViews requests bytes }
            uniq { uniques }
          }
        }
      }
    }
  `

  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CF_ANALYTICS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  })

  const data = await res.json()
  return Response.json(data)
}
```

## GA4 Data API Worker

```typescript
// src/pages/api/analytics/ga4.ts
export async function GET({ request, locals }: APIContext) {
  const { GA4_PROPERTY_ID, GA4_SERVICE_ACCOUNT_JSON } = locals.runtime.env

  // GA4 Data API uses OAuth2 service account — complex in Workers
  // Simpler: use Measurement Protocol for event tracking (not reporting)
  // For reporting: use GA4 Data API with service account JWT

  // Simple approach: store daily snapshots via a scheduled Worker
  // Serve the snapshots from D1 (analytics_daily table)
  const { DB } = locals.runtime.env
  const url = new URL(request.url)
  const days = parseInt(url.searchParams.get('days') ?? '30')

  const rows = await DB.prepare(`
    SELECT * FROM analytics_daily
    ORDER BY date DESC
    LIMIT ?
  `).bind(days).all()

  return Response.json(rows.results)
}
```

## Cron: Daily Analytics Snapshot

```toml
# wrangler.toml — two crons: one for social posts, one for analytics
[triggers]
crons = [
  "*/5 * * * *",   # social post queue — every 5 minutes
  "0 2 * * *",     # analytics snapshot — daily at 2am UTC
]
```

```typescript
// Handle both crons in src/pages/api/social/cron.ts
export async function GET({ request, locals }: APIContext) {
  const isSocialCron = request.headers.get('X-Cron-Trigger') !== 'analytics'
  if (isSocialCron) {
    return await handleSocialCron(locals.runtime.env)
  } else {
    return await handleAnalyticsCron(locals.runtime.env)
  }
}
```

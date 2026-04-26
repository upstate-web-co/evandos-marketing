import { getEnv } from '../../../lib/env'
import type { APIContext } from 'astro'

export async function GET({ request, locals }: APIContext) {
  try {
    const env = getEnv(locals)
    const { CF_ANALYTICS_TOKEN, CF_ZONE_ID } = env

    if (!CF_ANALYTICS_TOKEN || !CF_ZONE_ID) {
      return Response.json({ error: 'CF Analytics not configured', code: 'SERVICE_NOT_CONFIGURED', data: null }, { status: 200 })
    }

    const url = new URL(request.url)
    const days = Math.min(parseInt(url.searchParams.get('days') ?? '30'), 90)
    const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]

    const query = `
      query {
        viewer {
          zones(filter: { zoneTag: "${CF_ZONE_ID}" }) {
            httpRequests1dGroups(
              limit: ${days}
              filter: { date_gt: "${since}" }
              orderBy: [date_ASC]
            ) {
              dimensions { date }
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
  } catch (err) {
    console.error('[analytics/cf] Error:', err)
    return Response.json({ error: 'Failed to fetch CF analytics', code: 'FETCH_FAILED' }, { status: 500 })
  }
}

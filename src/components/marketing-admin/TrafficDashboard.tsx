import { useState, useEffect } from 'react'

interface DayData {
  date: string
  pageViews: number
  uniques: number
}

interface AnalyticsDaily {
  date: string
  page_views: number
  unique_visitors: number
  top_pages_json: string
  source_json: string
}

export default function TrafficDashboard() {
  const [cfData, setCfData] = useState<DayData[]>([])
  const [ga4Data, setGa4Data] = useState<AnalyticsDaily[]>([])
  const [days, setDays] = useState(7)
  const [loading, setLoading] = useState(true)
  const [cfError, setCfError] = useState<string | null>(null)

  async function fetchData() {
    setLoading(true)

    const [cfRes, ga4Res] = await Promise.all([
      fetch(`/api/analytics/cf?days=${days}`).then((r) => r.json()).catch(() => ({ error: 'Failed to fetch' })),
      fetch(`/api/analytics/ga4?days=${days}`).then((r) => r.json()).catch(() => ({ data: [] })),
    ])

    // Parse CF Analytics GraphQL response
    if (cfRes?.data?.viewer?.zones?.[0]?.httpRequests1dGroups) {
      const groups = cfRes.data.viewer.zones[0].httpRequests1dGroups
      setCfData(
        groups.map((g: any) => ({
          date: g.dimensions.date,
          pageViews: g.sum.pageViews,
          uniques: g.uniq.uniques,
        }))
      )
      setCfError(null)
    } else {
      setCfData([])
      setCfError(cfRes?.error || 'CF Analytics not configured — add CF_ANALYTICS_TOKEN and CF_ZONE_ID env vars')
    }

    setGa4Data(ga4Res?.data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [days])

  const totalPageViews = cfData.reduce((s, d) => s + d.pageViews, 0)
  const totalUniques = cfData.reduce((s, d) => s + d.uniques, 0)
  const maxViews = Math.max(...cfData.map((d) => d.pageViews), 1)

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex gap-2">
        {[7, 14, 30].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              days === d
                ? 'bg-[#B85C38] text-white'
                : 'border border-[#F7F4EF]/10 text-[#F7F4EF]/50 hover:text-[#F7F4EF] hover:border-[#F7F4EF]/20'
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-[#F7F4EF]/50">Loading analytics...</p>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Page Views" value={totalPageViews} source="CF" />
            <StatCard label="Unique Visitors" value={totalUniques} source="CF" />
            <StatCard
              label="Avg Daily Views"
              value={cfData.length ? Math.round(totalPageViews / cfData.length) : 0}
              source="CF"
            />
            <StatCard
              label="GA4 Snapshots"
              value={ga4Data.length}
              source="GA4"
            />
          </div>

          {/* CF Analytics chart */}
          <div className="border border-[#F7F4EF]/10 rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-4">Daily Page Views (Cloudflare)</h3>
            {cfError ? (
              <p className="text-xs text-[#F7F4EF]/40">{cfError}</p>
            ) : cfData.length === 0 ? (
              <p className="text-xs text-[#F7F4EF]/40">No data available for this period.</p>
            ) : (
              <div className="flex items-end gap-1 h-32">
                {cfData.map((d) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                    <div
                      className="w-full bg-[#B85C38]/60 hover:bg-[#B85C38] rounded-t transition-colors"
                      style={{ height: `${(d.pageViews / maxViews) * 100}%`, minHeight: '2px' }}
                    />
                    <span className="text-[10px] text-[#F7F4EF]/30 hidden sm:block">
                      {d.date.slice(5)}
                    </span>
                    <div className="absolute bottom-full mb-1 hidden group-hover:block bg-[#1A1814] border border-[#F7F4EF]/20 rounded px-2 py-1 text-xs whitespace-nowrap z-10">
                      {d.date}: {d.pageViews} views, {d.uniques} unique
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* GA4 snapshots */}
          {ga4Data.length > 0 && (
            <div className="border border-[#F7F4EF]/10 rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-3">GA4 Daily Snapshots</h3>
              <div className="space-y-2">
                {ga4Data.slice(0, 10).map((row) => (
                  <div key={row.date} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-xs text-[#F7F4EF]/60">{row.date}</span>
                    <div className="flex gap-4 text-xs">
                      <span>{row.page_views} views</span>
                      <span className="text-[#F7F4EF]/50">{row.unique_visitors} unique</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ga4Data.length === 0 && (
            <div className="border border-[#F7F4EF]/10 rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-2">GA4 Data</h3>
              <p className="text-xs text-[#F7F4EF]/40">
                No GA4 snapshots yet. Data will populate once the daily analytics cron runs (Phase 10).
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, source }: { label: string; value: number; source: string }) {
  return (
    <div className="border border-[#F7F4EF]/10 rounded-xl p-4">
      <p className="text-2xl font-bold text-[#B85C38]">{value.toLocaleString()}</p>
      <p className="text-xs text-[#F7F4EF]/50 mt-1">{label}</p>
      <p className="text-[10px] text-[#F7F4EF]/25 mt-0.5">{source}</p>
    </div>
  )
}

import { useState, useEffect } from 'react'

interface Stats {
  posts_this_week: number
  scheduled: number
  platforms_connected: number
  failed: number
  drafts: number
}

export default function DashboardStats() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    fetch('/api/marketing-admin/stats')
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setStats(data)
      })
      .catch(() => {})
  }, [])

  const items = [
    { label: 'Posts This Week', value: stats?.posts_this_week ?? '--' },
    { label: 'Scheduled', value: stats?.scheduled ?? '--' },
    { label: 'Failed', value: stats?.failed ?? '--' },
    { label: 'Platforms Connected', value: stats?.platforms_connected ?? '--' },
    { label: 'Drafts', value: stats?.drafts ?? '--' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
      {items.map(({ label, value }) => (
        <div key={label}>
          <p className="text-2xl font-bold text-[#B85C38]">{value}</p>
          <p className="text-xs text-[#F7F4EF]/40 mt-1">{label}</p>
        </div>
      ))}
    </div>
  )
}

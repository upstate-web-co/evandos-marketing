import { useState, useEffect } from 'react'

interface Subscriber {
  id: string
  email: string
  name: string | null
  source: string
  status: string
  subscribed_at: string
  unsubscribed_at: string | null
}

const sourceStyles: Record<string, string> = {
  website: 'bg-blue-900/30 text-blue-300',
  blog: 'bg-purple-900/30 text-purple-300',
  'lead-magnet': 'bg-amber-900/30 text-amber-300',
  manual: 'bg-gray-700/30 text-gray-300',
}

export default function SubscribersList() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [stats, setStats] = useState({ active: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'active' | 'unsubscribed'>('all')

  useEffect(() => {
    fetch('/api/marketing-admin/subscribers')
      .then((r) => r.json())
      .then((data) => {
        setSubscribers(data.subscribers ?? [])
        setStats(data.stats ?? { active: 0, total: 0 })
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = subscribers.filter((s) => {
    if (filter === 'all') return true
    return s.status === filter
  })

  if (loading) return <p className="text-sm text-[#F7F4EF]/50">Loading...</p>

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="flex gap-4">
        <div className="border border-[#F7F4EF]/10 rounded-lg px-4 py-3">
          <p className="text-2xl font-bold">{stats.active}</p>
          <p className="text-xs text-[#F7F4EF]/50">Active subscribers</p>
        </div>
        <div className="border border-[#F7F4EF]/10 rounded-lg px-4 py-3">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-[#F7F4EF]/50">Total all-time</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'active', 'unsubscribed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs rounded-lg capitalize transition-colors ${
              filter === f
                ? 'bg-[#B85C38] text-white'
                : 'border border-[#F7F4EF]/10 text-[#F7F4EF]/50 hover:text-[#F7F4EF]'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <p className="text-sm text-[#F7F4EF]/40 py-8 text-center">No subscribers yet.</p>
      ) : (
        <div className="border border-[#F7F4EF]/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#F7F4EF]/10 text-[#F7F4EF]/50 text-xs">
                <th className="text-left px-4 py-3 font-medium">Email</th>
                <th className="text-left px-4 py-3 font-medium">Source</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-[#F7F4EF]/5 hover:bg-[#F7F4EF]/5">
                  <td className="px-4 py-3 font-mono text-xs">{s.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${sourceStyles[s.source] ?? sourceStyles.manual}`}>
                      {s.source}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      s.status === 'active' ? 'bg-green-900/30 text-green-300' : 'bg-red-900/30 text-red-300'
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#F7F4EF]/40">
                    {new Date(s.subscribed_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'

interface ScheduledPost {
  id: string
  platform: string
  content: string
  scheduled_at: string
  posted_at: string | null
  status: string
  draft_title: string | null
  error_message: string | null
}

const statusColors: Record<string, string> = {
  draft: 'bg-[#F7F4EF]/10 text-[#F7F4EF]/50',
  scheduled: 'bg-blue-900/30 text-blue-300',
  posting: 'bg-yellow-900/30 text-yellow-300',
  posted: 'bg-green-900/30 text-green-300',
  failed: 'bg-red-900/30 text-red-300',
  cancelled: 'bg-[#F7F4EF]/5 text-[#F7F4EF]/30 line-through',
}

const platformLabels: Record<string, string> = {
  facebook: 'FB',
  instagram: 'IG',
  linkedin: 'LI',
  gbp: 'GBP',
}

interface Suggestion {
  day: string
  platform: string
  topic: string
  content_idea: string
  best_time: string
}

export default function ContentCalendar() {
  const [posts, setPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  async function fetchPosts() {
    try {
      const params = new URLSearchParams({ days: '30' })
      if (filter) params.set('status', filter)

      const res = await fetch(`/api/marketing-admin/schedule?${params}`)
      const data = await res.json()
      setPosts(data.posts ?? [])
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPosts() }, [filter])

  async function cancelPost(id: string) {
    if (!confirm('Cancel this scheduled post?')) return

    await fetch('/api/marketing-admin/schedule', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    fetchPosts()
  }

  async function suggestPosts() {
    setSuggesting(true)
    setSuggestions([])

    try {
      const res = await fetch('/api/marketing-admin/ai-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()

      if (data.error) return
      setSuggestions(data.suggestions ?? [])
      setShowSuggestions(true)
    } catch {
      // silently fail
    } finally {
      setSuggesting(false)
    }
  }

  // Group posts by date
  const grouped = posts.reduce<Record<string, ScheduledPost[]>>((acc, post) => {
    const date = post.scheduled_at.split(' ')[0] ?? post.scheduled_at.split('T')[0]
    if (!acc[date]) acc[date] = []
    acc[date].push(post)
    return acc
  }, {})

  const sortedDates = Object.keys(grouped).sort()

  return (
    <div className="space-y-4">
      {/* Filters + Suggest */}
      <div className="flex items-center gap-2 flex-wrap">
        {[null, 'scheduled', 'posted', 'failed'].map((s) => (
          <button
            key={s ?? 'all'}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs rounded-lg capitalize transition-colors ${
              filter === s
                ? 'bg-[#B85C38] text-white'
                : 'border border-[#F7F4EF]/10 text-[#F7F4EF]/50 hover:text-[#F7F4EF]'
            }`}
          >
            {s ?? 'All'}
          </button>
        ))}
        <button
          onClick={suggestPosts}
          disabled={suggesting}
          className="ml-auto px-3 py-1.5 text-xs border border-[#B85C38]/30 text-[#B85C38] rounded-lg hover:bg-[#B85C38]/10 transition-colors disabled:opacity-50"
        >
          {suggesting ? 'Thinking...' : 'AI Suggest Week'}
        </button>
      </div>

      {/* AI Suggestions */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="border border-[#B85C38]/20 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-[#B85C38] font-medium">Suggested Posts for Next Week</p>
            <button onClick={() => setShowSuggestions(false)} className="text-xs text-[#F7F4EF]/30 hover:text-[#F7F4EF]">Dismiss</button>
          </div>
          {suggestions.map((s, i) => (
            <div key={i} className="flex items-start gap-3 bg-[#F7F4EF]/5 rounded-lg p-3">
              <div className="shrink-0 text-center">
                <p className="text-xs font-medium">{s.day}</p>
                <p className="text-[10px] text-[#F7F4EF]/30">{s.best_time}</p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-[#B85C38]">{platformLabels[s.platform] ?? s.platform.toUpperCase()}</span>
                  <span className="text-xs font-medium">{s.topic}</span>
                </div>
                <p className="text-xs text-[#F7F4EF]/50 mt-1">{s.content_idea}</p>
              </div>
              <a
                href={`/marketing-admin/compose`}
                className="text-[10px] text-[#B85C38] hover:underline shrink-0"
              >
                Draft
              </a>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-[#F7F4EF]/50">Loading...</p>
      ) : sortedDates.length === 0 ? (
        <div className="border border-[#F7F4EF]/10 rounded-xl p-8 text-center">
          <p className="text-sm text-[#F7F4EF]/40">No posts found.</p>
          <a href="/marketing-admin/compose" className="text-sm text-[#B85C38] hover:underline mt-2 inline-block">
            Compose a post
          </a>
        </div>
      ) : (
        sortedDates.map((date) => (
          <div key={date}>
            <h3 className="text-xs font-semibold text-[#F7F4EF]/40 uppercase tracking-wide mb-2">
              {formatDate(date)}
            </h3>
            <div className="space-y-2">
              {grouped[date].map((post) => (
                <a
                  key={post.id}
                  href={`/marketing-admin/post/${post.id}`}
                  className="flex items-start gap-3 p-4 border border-[#F7F4EF]/10 rounded-xl hover:border-[#F7F4EF]/20 transition-colors block"
                >
                  {/* Platform badge */}
                  <span className="text-xs font-mono font-bold text-[#B85C38] w-8 shrink-0 pt-0.5">
                    {platformLabels[post.platform] ?? post.platform}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {post.draft_title && (
                      <p className="text-xs text-[#F7F4EF]/40 mb-0.5">{post.draft_title}</p>
                    )}
                    <p className="text-sm text-[#F7F4EF]/80 line-clamp-2">{post.content}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusColors[post.status] ?? statusColors.draft}`}>
                        {post.status}
                      </span>
                      <span className="text-[10px] text-[#F7F4EF]/30">
                        {post.scheduled_at.slice(11, 16) || 'no time'}
                      </span>
                      {post.error_message && (
                        <span className="text-[10px] text-red-400 truncate max-w-48">{post.error_message}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {post.status === 'scheduled' && (
                    <button
                      onClick={(e) => { e.preventDefault(); cancelPost(post.id) }}
                      className="text-xs text-[#F7F4EF]/30 hover:text-red-400 transition-colors shrink-0"
                    >
                      Cancel
                    </button>
                  )}
                </a>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = d.getTime() - today.getTime()
  const daysDiff = Math.round(diff / 86400000)

  if (daysDiff === 0) return 'Today'
  if (daysDiff === 1) return 'Tomorrow'
  if (daysDiff === -1) return 'Yesterday'

  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

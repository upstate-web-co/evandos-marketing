import { useState, useEffect } from 'react'

interface ContentHistoryEntry {
  content: string
  changed_at: string
}

interface Post {
  id: string
  content_draft_id: string | null
  platform: string
  content: string
  media_r2_key: string | null
  media_url: string | null
  scheduled_at: string
  posted_at: string | null
  status: string
  external_id: string | null
  error_message: string | null
  retry_count: number
  ai_generated: number
  content_history_json: string | null
  created_at: string
  updated_at: string
  draft_title: string | null
  draft_body: string | null
}

import { STATUS_STYLES, PLATFORM_LABELS } from '../../lib/constants'
import AlertMessage from './AlertMessage'

export default function PostDetail({ postId }: { postId: string }) {
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ content: '', scheduled_at: '' })
  const [saving, setSaving] = useState(false)
  const [repurposing, setRepurposing] = useState(false)
  const [repurposed, setRepurposed] = useState<Record<string, string> | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function fetchPost() {
    try {
      const res = await fetch(`/api/marketing-admin/post/${postId}`)
      const data = await res.json()
      if (data.post) setPost(data.post)
      else setMessage({ type: 'error', text: data.error ?? 'Post not found' })
    } catch {
      setMessage({ type: 'error', text: 'Failed to load post' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPost() }, [postId])

  function startEdit() {
    if (!post) return
    setEditing(true)
    setForm({
      content: post.content,
      scheduled_at: post.scheduled_at.replace(' ', 'T').slice(0, 16),
    })
    setMessage(null)
  }

  async function save() {
    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch(`/api/marketing-admin/post/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: form.content,
          scheduled_at: new Date(form.scheduled_at).toISOString().replace('T', ' ').slice(0, 19),
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error ?? 'Failed to save' })
        return
      }

      setMessage({ type: 'success', text: 'Post updated' })
      setEditing(false)
      await fetchPost()
    } catch {
      setMessage({ type: 'error', text: 'Network error' })
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(newStatus: string) {
    const label = newStatus === 'cancelled' ? 'Cancel' : newStatus === 'scheduled' ? 'Reschedule' : `Set to ${newStatus}`
    if (!confirm(`${label} this post?`)) return

    try {
      const res = await fetch(`/api/marketing-admin/post/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (res.ok) await fetchPost()
    } catch {
      setMessage({ type: 'error', text: 'Failed to update status' })
    }
  }

  async function repurpose() {
    if (!post) return
    setRepurposing(true)
    setRepurposed(null)

    try {
      const res = await fetch('/api/marketing-admin/ai-repurpose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: post.content, sourcePlatform: post.platform }),
      })
      const data = await res.json()

      if (data.error) {
        setMessage({ type: 'error', text: data.error })
        return
      }

      setRepurposed(data.versions)
    } catch {
      setMessage({ type: 'error', text: 'Failed to repurpose' })
    } finally {
      setRepurposing(false)
    }
  }

  if (loading) return <p className="text-sm text-[#F7F4EF]/50">Loading...</p>
  if (!post) return <p className="text-sm text-red-400">Post not found.</p>

  return (
    <div className="space-y-6">
      <AlertMessage message={message} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-1 rounded-full ${STATUS_STYLES[post.status] ?? STATUS_STYLES.draft}`}>
            {post.status}
          </span>
          <span className="text-sm font-medium">{PLATFORM_LABELS[post.platform] ?? post.platform}</span>
        </div>
        <div className="flex gap-2">
          {(post.status === 'scheduled' || post.status === 'draft') && (
            <>
              <button onClick={startEdit} className="px-3 py-1.5 text-xs border border-[#F7F4EF]/10 rounded-lg hover:border-[#B85C38]/50 hover:text-[#B85C38] transition-colors">
                Edit
              </button>
              <button onClick={() => updateStatus('cancelled')} className="px-3 py-1.5 text-xs border border-[#F7F4EF]/10 rounded-lg hover:border-red-500/50 hover:text-red-400 transition-colors">
                Cancel
              </button>
            </>
          )}
          {post.status === 'failed' && (
            <button onClick={() => updateStatus('scheduled')} className="px-3 py-1.5 text-xs bg-[#B85C38] text-white rounded-lg hover:bg-[#a04e2f] transition-colors">
              Retry
            </button>
          )}
          {post.status === 'cancelled' && (
            <button onClick={() => updateStatus('scheduled')} className="px-3 py-1.5 text-xs border border-[#F7F4EF]/10 rounded-lg hover:border-[#B85C38]/50 hover:text-[#B85C38] transition-colors">
              Reschedule
            </button>
          )}
          <button
            onClick={repurpose}
            disabled={repurposing}
            className="px-3 py-1.5 text-xs border border-[#B85C38]/30 text-[#B85C38] rounded-lg hover:bg-[#B85C38]/10 transition-colors disabled:opacity-50"
          >
            {repurposing ? 'Repurposing...' : 'Repurpose'}
          </button>
        </div>
      </div>

      {/* Content */}
      {editing ? (
        <div className="border border-[#F7F4EF]/10 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-xs text-[#F7F4EF]/50 mb-1">Content</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              rows={6}
              className="w-full bg-[#F7F4EF]/5 border border-[#F7F4EF]/10 rounded-lg px-3 py-2 text-sm text-[#F7F4EF]"
            />
          </div>
          <div>
            <label className="block text-xs text-[#F7F4EF]/50 mb-1">Scheduled For</label>
            <input
              type="datetime-local"
              value={form.scheduled_at}
              onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
              className="bg-[#F7F4EF]/5 border border-[#F7F4EF]/10 rounded-lg px-3 py-2 text-sm text-[#F7F4EF]"
            />
          </div>
          <div className="flex gap-3">
            <button onClick={save} disabled={saving} className="px-4 py-2 bg-[#B85C38] text-white text-sm font-medium rounded-lg hover:bg-[#a04e2f] transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-[#F7F4EF]/50 hover:text-[#F7F4EF] transition-colors">Cancel</button>
          </div>
        </div>
      ) : (
        <div className="border border-[#F7F4EF]/10 rounded-xl p-5">
          <p className="text-sm text-[#F7F4EF]/80 whitespace-pre-wrap">{post.content}</p>
        </div>
      )}

      {/* Repurposed versions */}
      {repurposed && (
        <div className="border border-[#B85C38]/20 rounded-xl p-5 space-y-4">
          <p className="text-xs text-[#B85C38] font-medium">AI Repurposed Versions</p>
          {Object.entries(repurposed).map(([platform, text]) => (
            <div key={platform} className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs text-[#F7F4EF]/50 capitalize">{platform === 'gbp' ? 'Google Business' : platform}</p>
                <button
                  onClick={() => navigator.clipboard.writeText(text)}
                  className="text-[10px] text-[#B85C38] hover:underline"
                >
                  Copy
                </button>
              </div>
              <p className="text-sm text-[#F7F4EF]/70 whitespace-pre-wrap bg-[#F7F4EF]/5 rounded-lg p-3">{text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Media */}
      {post.media_url && (
        <div className="border border-[#F7F4EF]/10 rounded-xl p-5">
          <p className="text-xs text-[#F7F4EF]/50 mb-2">Attached Image</p>
          <img src={post.media_url} alt="" className="max-h-48 rounded-lg" />
          <p className="text-xs text-[#F7F4EF]/30 mt-2 font-mono break-all">{post.media_url}</p>
        </div>
      )}

      {/* Details */}
      <div className="border border-[#F7F4EF]/10 rounded-xl p-5">
        <p className="text-xs text-[#F7F4EF]/50 mb-3">Details</p>
        <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
          <div>
            <p className="text-xs text-[#F7F4EF]/30">Scheduled</p>
            <p className="text-[#F7F4EF]/70">{post.scheduled_at}</p>
          </div>
          {post.posted_at && (
            <div>
              <p className="text-xs text-[#F7F4EF]/30">Posted</p>
              <p className="text-[#F7F4EF]/70">{post.posted_at}</p>
            </div>
          )}
          {post.external_id && (
            <div>
              <p className="text-xs text-[#F7F4EF]/30">Platform Post ID</p>
              <p className="text-[#F7F4EF]/70 font-mono text-xs">{post.external_id}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-[#F7F4EF]/30">Retry Count</p>
            <p className="text-[#F7F4EF]/70">{post.retry_count}/3</p>
          </div>
          <div>
            <p className="text-xs text-[#F7F4EF]/30">Created</p>
            <p className="text-[#F7F4EF]/70">{post.created_at}</p>
          </div>
          <div>
            <p className="text-xs text-[#F7F4EF]/30">Last Updated</p>
            <p className="text-[#F7F4EF]/70">{post.updated_at}</p>
          </div>
        </div>
      </div>

      {/* Error */}
      {post.error_message && (
        <div className="border border-red-500/30 rounded-xl p-5 bg-red-900/10">
          <p className="text-xs text-red-400 mb-1">Error</p>
          <p className="text-sm text-red-300">{post.error_message}</p>
        </div>
      )}

      {/* AI badge */}
      {post.ai_generated === 1 && (
        <div className="flex items-center gap-2 text-xs text-[#B85C38]">
          <span className="px-2 py-0.5 bg-[#B85C38]/10 rounded-full">AI-assisted content</span>
        </div>
      )}

      {/* Content edit history */}
      {post.content_history_json && (() => {
        const history: ContentHistoryEntry[] = JSON.parse(post.content_history_json)
        if (history.length === 0) return null
        return (
          <details className="border border-[#F7F4EF]/10 rounded-xl">
            <summary className="px-5 py-3 cursor-pointer text-xs text-[#F7F4EF]/50 hover:text-[#F7F4EF]/70">
              Edit history ({history.length} {history.length === 1 ? 'revision' : 'revisions'})
            </summary>
            <div className="px-5 pb-4 space-y-3">
              {history.slice().reverse().map((entry, i) => (
                <div key={i} className="text-sm">
                  <p className="text-xs text-[#F7F4EF]/30 mb-1">
                    {new Date(entry.changed_at).toLocaleString()}
                  </p>
                  <p className="text-[#F7F4EF]/50 whitespace-pre-wrap bg-[#F7F4EF]/5 rounded-lg p-3 text-xs">{entry.content}</p>
                </div>
              ))}
            </div>
          </details>
        )
      })()}

      {/* Draft reference */}
      {post.draft_title && (
        <div className="border border-[#F7F4EF]/10 rounded-xl p-5">
          <p className="text-xs text-[#F7F4EF]/50 mb-1">From Draft</p>
          <p className="text-sm text-[#F7F4EF]/60">{post.draft_title}</p>
        </div>
      )}
    </div>
  )
}

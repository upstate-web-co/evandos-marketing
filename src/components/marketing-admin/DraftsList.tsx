import { useState, useEffect } from 'react'
import AlertMessage from './AlertMessage'

interface Draft {
  id: string
  title: string | null
  body: string
  platforms_json: string
  media_r2_keys_json: string
  status: string
  ai_generated: number
  created_at: string
  updated_at: string
}

import { STATUS_STYLES } from '../../lib/constants'

export default function DraftsList() {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Draft | null>(null)
  const [form, setForm] = useState({ title: '', body: '', platforms: [] as string[] })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function fetchDrafts() {
    try {
      const res = await fetch('/api/marketing-admin/drafts')
      const data = await res.json()
      setDrafts(data.drafts ?? [])
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDrafts() }, [])

  function startEdit(draft: Draft) {
    setEditing(draft)
    setForm({
      title: draft.title ?? '',
      body: draft.body,
      platforms: JSON.parse(draft.platforms_json || '[]'),
    })
    setMessage(null)
  }

  function cancel() {
    setEditing(null)
    setMessage(null)
  }

  async function save() {
    if (!form.body.trim()) {
      setMessage({ type: 'error', text: 'Content is required' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/marketing-admin/drafts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing!.id,
          title: form.title || null,
          body: form.body,
          platforms: form.platforms,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error ?? 'Failed to save' })
        return
      }

      setMessage({ type: 'success', text: 'Draft updated' })
      setEditing(null)
      await fetchDrafts()
    } catch {
      setMessage({ type: 'error', text: 'Network error' })
    } finally {
      setSaving(false)
    }
  }

  async function archiveDraft(id: string) {
    if (!confirm('Archive this draft?')) return

    await fetch('/api/marketing-admin/drafts', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'archived' }),
    })
    fetchDrafts()
  }

  function useInComposer(draft: Draft) {
    // Navigate to compose with draft content pre-filled via URL params
    const params = new URLSearchParams({ draft_id: draft.id })
    window.location.href = `/marketing-admin/compose?${params}`
  }

  if (loading) return <p className="text-sm text-[#F7F4EF]/50">Loading...</p>

  return (
    <div className="space-y-4">
      <AlertMessage message={message} />

      {editing ? (
        <div className="border border-[#F7F4EF]/10 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-sm">Edit Draft</h3>

          <div>
            <label className="block text-xs text-[#F7F4EF]/50 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Internal title (optional)"
              className="w-full bg-[#F7F4EF]/5 border border-[#F7F4EF]/10 rounded-lg px-3 py-2 text-sm text-[#F7F4EF] placeholder-[#F7F4EF]/30"
            />
          </div>

          <div>
            <label className="block text-xs text-[#F7F4EF]/50 mb-1">Content</label>
            <textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              rows={6}
              className="w-full bg-[#F7F4EF]/5 border border-[#F7F4EF]/10 rounded-lg px-3 py-2 text-sm text-[#F7F4EF] placeholder-[#F7F4EF]/30"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={save} disabled={saving} className="px-4 py-2 bg-[#B85C38] text-white text-sm font-medium rounded-lg hover:bg-[#a04e2f] transition-colors disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button onClick={cancel} className="px-4 py-2 text-sm text-[#F7F4EF]/50 hover:text-[#F7F4EF] transition-colors">Cancel</button>
          </div>
        </div>
      ) : drafts.length === 0 ? (
        <div className="border border-[#F7F4EF]/10 rounded-xl p-8 text-center">
          <p className="text-sm text-[#F7F4EF]/40">No drafts yet.</p>
          <a href="/marketing-admin/compose" className="text-sm text-[#B85C38] hover:underline mt-2 inline-block">Compose a post</a>
        </div>
      ) : (
        <div className="space-y-2">
          {drafts.map((draft) => {
            const platforms: string[] = JSON.parse(draft.platforms_json || '[]')
            const mediaKeys: string[] = JSON.parse(draft.media_r2_keys_json || '[]')

            return (
              <div key={draft.id} className="p-4 border border-[#F7F4EF]/10 rounded-xl hover:border-[#F7F4EF]/20 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    {draft.title && <p className="text-xs text-[#F7F4EF]/40 mb-0.5">{draft.title}</p>}
                    <p className="text-sm text-[#F7F4EF]/80 line-clamp-2">{draft.body}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_STYLES[draft.status] ?? statusStyles.draft}`}>
                        {draft.status}
                      </span>
                      {draft.ai_generated === 1 && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-900/30 text-purple-300">AI</span>
                      )}
                      {platforms.map((p) => (
                        <span key={p} className="text-[10px] text-[#F7F4EF]/30 capitalize">{p}</span>
                      ))}
                      {mediaKeys.length > 0 && (
                        <span className="text-[10px] text-[#F7F4EF]/30">{mediaKeys.length} image{mediaKeys.length > 1 ? 's' : ''}</span>
                      )}
                      <span className="text-[10px] text-[#F7F4EF]/20">{new Date(draft.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => startEdit(draft)} className="px-2 py-1 text-xs border border-[#F7F4EF]/10 rounded-lg hover:border-[#B85C38]/50 hover:text-[#B85C38] transition-colors">
                      Edit
                    </button>
                    <button onClick={() => useInComposer(draft)} className="px-2 py-1 text-xs border border-[#F7F4EF]/10 rounded-lg hover:border-[#B85C38]/50 hover:text-[#B85C38] transition-colors">
                      Schedule
                    </button>
                    {draft.status !== 'archived' && (
                      <button onClick={() => archiveDraft(draft.id)} className="px-2 py-1 text-xs border border-[#F7F4EF]/10 rounded-lg hover:border-red-500/50 hover:text-red-400 transition-colors">
                        Archive
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

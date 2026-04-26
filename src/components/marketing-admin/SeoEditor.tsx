import { useState, useEffect } from 'react'
import AlertMessage from './AlertMessage'

interface SeoPage {
  id: string
  path: string
  title: string | null
  description: string | null
  schema_json: string | null
  noindex: number
  updated_at: string
}

export default function SeoEditor() {
  const [pages, setPages] = useState<SeoPage[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState({ path: '', title: '', description: '', schema_json: '', noindex: false })
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function fetchPages() {
    try {
      const res = await fetch('/api/marketing-admin/seo')
      const data = await res.json()
      setPages(data.pages ?? [])
    } catch {
      setMessage({ type: 'error', text: 'Failed to load SEO pages' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchPages() }, [])

  function startEdit(page: SeoPage) {
    setEditing(page.path)
    setForm({
      path: page.path,
      title: page.title ?? '',
      description: page.description ?? '',
      schema_json: page.schema_json ?? '',
      noindex: page.noindex === 1,
    })
    setMessage(null)
  }

  function startNew() {
    setEditing('__new__')
    setForm({ path: '', title: '', description: '', schema_json: '', noindex: false })
    setMessage(null)
  }

  function cancel() {
    setEditing(null)
    setMessage(null)
  }

  async function save() {
    if (!form.path.startsWith('/')) {
      setMessage({ type: 'error', text: 'Path must start with /' })
      return
    }

    if (form.schema_json) {
      try {
        JSON.parse(form.schema_json)
      } catch {
        setMessage({ type: 'error', text: 'Schema JSON is invalid' })
        return
      }
    }

    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/marketing-admin/seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error ?? 'Failed to save' })
        return
      }

      setMessage({ type: 'success', text: 'Saved' })
      setEditing(null)
      await fetchPages()
    } catch {
      setMessage({ type: 'error', text: 'Network error' })
    } finally {
      setSaving(false)
    }
  }

  async function deletePage(path: string) {
    if (!confirm(`Delete SEO overrides for ${path}?`)) return

    try {
      await fetch('/api/marketing-admin/seo', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      })
      await fetchPages()
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete' })
    }
  }

  async function aiGenerate() {
    if (!form.path.startsWith('/')) {
      setMessage({ type: 'error', text: 'Enter a path first' })
      return
    }

    setAiLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/marketing-admin/ai-seo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: form.path,
          currentTitle: form.title || undefined,
          currentDescription: form.description || undefined,
        }),
      })
      const data = await res.json()

      if (data.error) {
        setMessage({ type: 'error', text: data.error })
        return
      }

      setForm((prev) => ({
        ...prev,
        title: data.title || prev.title,
        description: data.description || prev.description,
      }))
      setMessage({ type: 'success', text: 'AI suggestions applied' })
    } catch {
      setMessage({ type: 'error', text: 'Failed to generate suggestions' })
    } finally {
      setAiLoading(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-[#F7F4EF]/50">Loading...</p>
  }

  return (
    <div>
      <AlertMessage message={message} />

      {editing ? (
        <div className="border border-[#F7F4EF]/10 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-sm">
            {editing === '__new__' ? 'Add SEO Override' : `Edit: ${editing}`}
          </h3>

          <div>
            <label className="block text-xs text-[#F7F4EF]/50 mb-1">Path</label>
            <input
              type="text"
              value={form.path}
              onChange={(e) => setForm({ ...form, path: e.target.value })}
              disabled={editing !== '__new__'}
              placeholder="/"
              className="w-full bg-[#F7F4EF]/5 border border-[#F7F4EF]/10 rounded-lg px-3 py-2 text-sm text-[#F7F4EF] placeholder-[#F7F4EF]/30 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-xs text-[#F7F4EF]/50 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Page title (leave blank for default)"
              className="w-full bg-[#F7F4EF]/5 border border-[#F7F4EF]/10 rounded-lg px-3 py-2 text-sm text-[#F7F4EF] placeholder-[#F7F4EF]/30"
            />
            <p className="text-xs text-[#F7F4EF]/30 mt-1">{form.title.length}/60 characters</p>
          </div>

          <div>
            <label className="block text-xs text-[#F7F4EF]/50 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Meta description (leave blank for default)"
              rows={3}
              className="w-full bg-[#F7F4EF]/5 border border-[#F7F4EF]/10 rounded-lg px-3 py-2 text-sm text-[#F7F4EF] placeholder-[#F7F4EF]/30"
            />
            <p className="text-xs text-[#F7F4EF]/30 mt-1">{form.description.length}/160 characters</p>
          </div>

          <button
            type="button"
            onClick={aiGenerate}
            disabled={aiLoading}
            className="px-4 py-2 border border-[#B85C38]/30 text-[#B85C38] text-sm font-medium rounded-lg hover:bg-[#B85C38]/10 transition-colors disabled:opacity-50"
          >
            {aiLoading ? 'Generating...' : 'AI Generate Title & Description'}
          </button>

          <div>
            <label className="block text-xs text-[#F7F4EF]/50 mb-1">Schema JSON (JSON-LD override)</label>
            <textarea
              value={form.schema_json}
              onChange={(e) => setForm({ ...form, schema_json: e.target.value })}
              placeholder='{"@context":"https://schema.org",...}'
              rows={4}
              className="w-full bg-[#F7F4EF]/5 border border-[#F7F4EF]/10 rounded-lg px-3 py-2 text-sm text-[#F7F4EF] placeholder-[#F7F4EF]/30 font-mono text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="noindex"
              checked={form.noindex}
              onChange={(e) => setForm({ ...form, noindex: e.target.checked })}
              className="rounded"
            />
            <label htmlFor="noindex" className="text-sm text-[#F7F4EF]/70">noindex (hide from search engines)</label>
          </div>

          {/* SERP Preview */}
          {(form.title || form.description) && (
            <div className="border border-[#F7F4EF]/10 rounded-xl p-4 bg-white/5">
              <p className="text-xs text-[#F7F4EF]/40 mb-2">Google Search Preview</p>
              <div className="space-y-0.5">
                <p className="text-[#8ab4f8] text-base leading-tight truncate">
                  {form.title || 'Page Title'} | Upstate Web Co.
                </p>
                <p className="text-[#bdc1c6] text-xs truncate">
                  upstate-web.com{form.path || '/'}
                </p>
                <p className="text-[#bdc1c6] text-sm leading-snug line-clamp-2">
                  {form.description || 'No description set. Google will generate one from page content.'}
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 bg-[#B85C38] text-white text-sm font-medium rounded-lg hover:bg-[#a04e2f] transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={cancel}
              className="px-4 py-2 text-sm text-[#F7F4EF]/50 hover:text-[#F7F4EF] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            onClick={startNew}
            className="mb-4 px-4 py-2 bg-[#B85C38] text-white text-sm font-medium rounded-lg hover:bg-[#a04e2f] transition-colors"
          >
            + Add Page Override
          </button>

          {pages.length === 0 ? (
            <p className="text-sm text-[#F7F4EF]/40">No SEO overrides yet. Add one to customize page titles, descriptions, and schema.</p>
          ) : (
            <div className="space-y-2">
              {pages.map((page) => (
                <div key={page.path} className="flex items-center justify-between p-4 border border-[#F7F4EF]/10 rounded-xl hover:border-[#F7F4EF]/20 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium font-mono">{page.path}</p>
                    <p className="text-xs text-[#F7F4EF]/50 truncate mt-0.5">
                      {page.title || '(default title)'}
                    </p>
                    {page.noindex === 1 && (
                      <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-red-900/30 text-red-300">noindex</span>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4 shrink-0">
                    <button
                      onClick={() => startEdit(page)}
                      className="px-3 py-1.5 text-xs border border-[#F7F4EF]/10 rounded-lg hover:border-[#B85C38]/50 hover:text-[#B85C38] transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deletePage(page.path)}
                      className="px-3 py-1.5 text-xs border border-[#F7F4EF]/10 rounded-lg hover:border-red-500/50 hover:text-red-400 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

import { useState } from 'react'
import AlertMessage from './AlertMessage'

const PLATFORMS = ['facebook', 'instagram', 'linkedin', 'gbp'] as const
type Platform = typeof PLATFORMS[number]

const PLATFORM_CHAR_LIMITS: Record<Platform, number> = {
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
  gbp: 1500,
}

export default function PostComposer() {
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [platforms, setPlatforms] = useState<Platform[]>([])
  const [scheduledAt, setScheduledAt] = useState('')
  const [mediaFile, setMediaFile] = useState<File | null>(null)
  const [mediaPreview, setMediaPreview] = useState<string | null>(null)
  const [mediaR2Key, setMediaR2Key] = useState<string | null>(null)
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [showAi, setShowAi] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function togglePlatform(p: Platform) {
    setPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]))
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setMediaFile(file)
    setMediaR2Key(null)
    setMediaUrl(null)

    // Create local preview
    const reader = new FileReader()
    reader.onload = () => setMediaPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  function removeMedia() {
    setMediaFile(null)
    setMediaPreview(null)
    setMediaR2Key(null)
    setMediaUrl(null)
  }

  async function uploadMedia(): Promise<{ key: string; url: string } | null> {
    if (!mediaFile) return null
    if (mediaR2Key && mediaUrl) return { key: mediaR2Key, url: mediaUrl }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', mediaFile)

      const res = await fetch('/api/marketing-admin/upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()

      if (!res.ok || !data.ok) {
        setMessage({ type: 'error', text: data.error ?? 'Upload failed' })
        return null
      }

      setMediaR2Key(data.key)
      setMediaUrl(data.url)
      return { key: data.key, url: data.url }
    } catch {
      setMessage({ type: 'error', text: 'Upload failed' })
      return null
    } finally {
      setUploading(false)
    }
  }

  async function generateDraft() {
    if (!aiPrompt.trim()) {
      setMessage({ type: 'error', text: 'Enter a prompt for AI assist' })
      return
    }

    setAiLoading(true)
    setMessage(null)

    try {
      const res = await fetch('/api/marketing-admin/ai-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: aiPrompt,
          platform: platforms[0] ?? undefined,
          existingContent: content || undefined,
        }),
      })
      const data = await res.json()

      if (data.error) {
        setMessage({ type: 'error', text: data.error })
        return
      }

      setContent(data.draft)
      setShowAi(false)
      setAiPrompt('')
      setMessage({ type: 'success', text: 'AI draft generated' })
    } catch {
      setMessage({ type: 'error', text: 'Failed to generate draft' })
    } finally {
      setAiLoading(false)
    }
  }

  async function saveDraft() {
    if (!content.trim()) {
      setMessage({ type: 'error', text: 'Content is required' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      // Upload media first if attached
      let uploadResult: { key: string; url: string } | null = null
      if (mediaFile) {
        uploadResult = await uploadMedia()
        if (!uploadResult) { setSaving(false); return }
      }

      const res = await fetch('/api/marketing-admin/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || null,
          body: content,
          platforms,
          media_r2_keys: uploadResult ? [uploadResult.key] : [],
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error ?? 'Failed to save' })
        return
      }

      setMessage({ type: 'success', text: 'Draft saved' })
    } catch {
      setMessage({ type: 'error', text: 'Network error' })
    } finally {
      setSaving(false)
    }
  }

  async function schedulePost() {
    if (!content.trim()) {
      setMessage({ type: 'error', text: 'Content is required' })
      return
    }
    if (platforms.length === 0) {
      setMessage({ type: 'error', text: 'Select at least one platform' })
      return
    }
    if (!scheduledAt) {
      setMessage({ type: 'error', text: 'Pick a date and time' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      // Upload media first if attached
      let uploadResult: { key: string; url: string } | null = null
      if (mediaFile) {
        uploadResult = await uploadMedia()
        if (!uploadResult) { setSaving(false); return }
      }

      // Save the draft
      const draftRes = await fetch('/api/marketing-admin/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title || null,
          body: content,
          platforms,
          media_r2_keys: uploadResult ? [uploadResult.key] : [],
        }),
      })
      const draftData = await draftRes.json()

      if (!draftRes.ok) {
        setMessage({ type: 'error', text: draftData.error ?? 'Failed to save draft' })
        return
      }

      const draftId = draftData.draft?.id

      // Schedule one post per platform
      const isoDate = new Date(scheduledAt).toISOString().replace('T', ' ').slice(0, 19)

      const results = await Promise.all(
        platforms.map((platform) =>
          fetch('/api/marketing-admin/schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content_draft_id: draftId,
              platform,
              content,
              scheduled_at: isoDate,
              media_r2_key: uploadResult?.key ?? null,
              media_url: uploadResult?.url ?? null,
            }),
          })
        )
      )

      const allOk = results.every((r) => r.ok)
      if (allOk) {
        setMessage({ type: 'success', text: `Scheduled for ${platforms.join(', ')}` })
        setContent('')
        setTitle('')
        setPlatforms([])
        setScheduledAt('')
        removeMedia()
      } else {
        setMessage({ type: 'error', text: 'Some platforms failed to schedule' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' })
    } finally {
      setSaving(false)
    }
  }

  const charCount = content.length
  const activeLimit = platforms.length > 0
    ? Math.min(...platforms.map(p => PLATFORM_CHAR_LIMITS[p]))
    : null
  const minDatetime = new Date(Date.now() + 5 * 60_000).toISOString().slice(0, 16) // 5 min from now

  return (
    <div className="space-y-5">
      <AlertMessage message={message} />

      <div>
        <label className="block text-xs text-[#F7F4EF]/50 mb-1">Title (optional, internal only)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. March launch announcement"
          className="w-full bg-[#F7F4EF]/5 border border-[#F7F4EF]/10 rounded-lg px-3 py-2 text-sm text-[#F7F4EF] placeholder-[#F7F4EF]/30"
        />
      </div>

      <div>
        <label className="block text-xs text-[#F7F4EF]/50 mb-1">Content</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your post..."
          rows={6}
          className="w-full bg-[#F7F4EF]/5 border border-[#F7F4EF]/10 rounded-lg px-3 py-2 text-sm text-[#F7F4EF] placeholder-[#F7F4EF]/30"
        />
        <div className="flex items-center gap-2 mt-1">
          <p className={`text-xs ${activeLimit && charCount > activeLimit ? 'text-red-400' : 'text-[#F7F4EF]/30'}`}>
            {charCount}{activeLimit ? ` / ${activeLimit.toLocaleString()}` : ''} characters
            {activeLimit && charCount > activeLimit && ' (over limit)'}
          </p>
          <button
            type="button"
            onClick={() => setShowAi(!showAi)}
            className="text-xs text-[#B85C38] hover:text-[#B85C38]/80 transition-colors ml-auto"
          >
            {showAi ? 'Hide AI Assist' : 'AI Assist'}
          </button>
        </div>

        {showAi && (
          <div className="mt-3 p-3 border border-[#B85C38]/20 rounded-lg bg-[#B85C38]/5 space-y-2">
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. Write a post about our spring web design special"
              className="w-full bg-[#F7F4EF]/5 border border-[#F7F4EF]/10 rounded-lg px-3 py-2 text-sm text-[#F7F4EF] placeholder-[#F7F4EF]/30"
              onKeyDown={(e) => e.key === 'Enter' && generateDraft()}
            />
            <button
              onClick={generateDraft}
              disabled={aiLoading}
              className="px-3 py-1.5 bg-[#B85C38] text-white text-xs font-medium rounded-lg hover:bg-[#a04e2f] transition-colors disabled:opacity-50"
            >
              {aiLoading ? 'Generating...' : 'Generate'}
            </button>
          </div>
        )}
      </div>

      {/* Media Upload */}
      <div>
        <label className="block text-xs text-[#F7F4EF]/50 mb-1">Image (optional)</label>
        {mediaPreview ? (
          <div className="relative inline-block">
            <img
              src={mediaPreview}
              alt="Preview"
              className="max-h-40 rounded-lg border border-[#F7F4EF]/10"
            />
            <button
              type="button"
              onClick={removeMedia}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-500"
            >
              &times;
            </button>
            {uploading && (
              <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center">
                <span className="text-xs text-white">Uploading...</span>
              </div>
            )}
          </div>
        ) : (
          <label className="flex items-center gap-2 px-3 py-2 border border-dashed border-[#F7F4EF]/20 rounded-lg cursor-pointer hover:border-[#B85C38]/50 transition-colors">
            <svg className="w-4 h-4 text-[#F7F4EF]/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs text-[#F7F4EF]/40">Add image (JPEG, PNG, GIF, WebP — max 10MB)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        )}
      </div>

      <div>
        <label className="block text-xs text-[#F7F4EF]/50 mb-2">Platforms</label>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <button
              key={p}
              onClick={() => togglePlatform(p)}
              className={`px-3 py-1.5 text-xs rounded-lg capitalize transition-colors ${
                platforms.includes(p)
                  ? 'bg-[#B85C38] text-white'
                  : 'border border-[#F7F4EF]/10 text-[#F7F4EF]/50 hover:text-[#F7F4EF] hover:border-[#F7F4EF]/20'
              }`}
            >
              {p === 'gbp' ? 'Google Business' : p}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs text-[#F7F4EF]/50 mb-1">Schedule For</label>
        <input
          type="datetime-local"
          value={scheduledAt}
          min={minDatetime}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="bg-[#F7F4EF]/5 border border-[#F7F4EF]/10 rounded-lg px-3 py-2 text-sm text-[#F7F4EF]"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button
          onClick={saveDraft}
          disabled={saving}
          className="px-4 py-2 border border-[#F7F4EF]/10 text-sm font-medium rounded-lg hover:border-[#F7F4EF]/20 hover:text-[#F7F4EF] text-[#F7F4EF]/70 transition-colors disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Draft'}
        </button>
        <button
          onClick={schedulePost}
          disabled={saving}
          className="px-4 py-2 bg-[#B85C38] text-white text-sm font-medium rounded-lg hover:bg-[#a04e2f] transition-colors disabled:opacity-50"
        >
          {saving ? 'Scheduling...' : 'Schedule Post'}
        </button>
      </div>
    </div>
  )
}

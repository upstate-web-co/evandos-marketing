import { useState } from 'react'
import AlertMessage from './AlertMessage'

interface Outline {
  title: string
  slug: string
  metaDescription: string
  targetKeywords: string[]
  sections: { heading: string; notes: string }[]
  internalLinks: string[]
  estimatedWordCount: number
}

export default function BlogOutlineGenerator() {
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [outline, setOutline] = useState<Outline | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function generate() {
    if (!topic.trim()) {
      setMessage({ type: 'error', text: 'Enter a topic' })
      return
    }

    setLoading(true)
    setOutline(null)
    setMessage(null)

    try {
      const res = await fetch('/api/marketing-admin/ai-blog-outline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      })
      const data = await res.json()

      if (data.error) {
        setMessage({ type: 'error', text: data.error })
        return
      }

      setOutline(data)
    } catch {
      setMessage({ type: 'error', text: 'Failed to generate outline' })
    } finally {
      setLoading(false)
    }
  }

  function copyOutline() {
    if (!outline) return

    const text = [
      `# ${outline.title}`,
      '',
      `Slug: ${outline.slug}`,
      `Meta: ${outline.metaDescription}`,
      `Keywords: ${outline.targetKeywords.join(', ')}`,
      `Word count: ~${outline.estimatedWordCount}`,
      '',
      ...outline.sections.map((s) => `## ${s.heading}\n${s.notes}`),
      '',
      `Internal links: ${outline.internalLinks.join(', ')}`,
    ].join('\n')

    navigator.clipboard.writeText(text)
    setMessage({ type: 'success', text: 'Outline copied to clipboard' })
  }

  return (
    <div className="space-y-5">
      <AlertMessage message={message} />

      <div>
        <label className="block text-xs text-[#F7F4EF]/50 mb-1">Blog Topic</label>
        <div className="flex gap-3">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Why every Greenville restaurant needs a website in 2026"
            className="flex-1 bg-[#F7F4EF]/5 border border-[#F7F4EF]/10 rounded-lg px-3 py-2 text-sm text-[#F7F4EF] placeholder-[#F7F4EF]/30"
            onKeyDown={(e) => e.key === 'Enter' && generate()}
          />
          <button
            onClick={generate}
            disabled={loading}
            className="px-4 py-2 bg-[#B85C38] text-white text-sm font-medium rounded-lg hover:bg-[#a04e2f] transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? 'Generating...' : 'Generate Outline'}
          </button>
        </div>
      </div>

      {outline && (
        <div className="border border-[#F7F4EF]/10 rounded-xl p-5 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-lg">{outline.title}</h3>
              <p className="text-xs text-[#F7F4EF]/40 font-mono mt-1">/{outline.slug}</p>
            </div>
            <button
              onClick={copyOutline}
              className="px-3 py-1.5 text-xs border border-[#F7F4EF]/10 rounded-lg hover:border-[#B85C38]/50 hover:text-[#B85C38] transition-colors shrink-0"
            >
              Copy All
            </button>
          </div>

          <div>
            <p className="text-xs text-[#F7F4EF]/50 mb-1">Meta Description</p>
            <p className="text-sm text-[#F7F4EF]/70">{outline.metaDescription}</p>
          </div>

          <div>
            <p className="text-xs text-[#F7F4EF]/50 mb-2">Target Keywords</p>
            <div className="flex flex-wrap gap-1.5">
              {outline.targetKeywords.map((kw) => (
                <span key={kw} className="text-xs px-2 py-0.5 rounded-full bg-[#B85C38]/10 text-[#B85C38]">{kw}</span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-[#F7F4EF]/50 mb-3">Sections ({outline.sections.length})</p>
            <div className="space-y-3">
              {outline.sections.map((section, i) => (
                <div key={i} className="bg-[#F7F4EF]/5 rounded-lg p-3">
                  <p className="text-sm font-medium">{section.heading}</p>
                  <p className="text-xs text-[#F7F4EF]/50 mt-1">{section.notes}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-[#F7F4EF]/40">
            <p>~{outline.estimatedWordCount} words</p>
            <p>Links: {outline.internalLinks.join(', ')}</p>
          </div>
        </div>
      )}
    </div>
  )
}

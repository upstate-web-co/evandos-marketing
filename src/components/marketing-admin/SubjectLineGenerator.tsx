import { useState } from 'react'

interface SubjectLine {
  text: string
  reasoning: string
}

export default function SubjectLineGenerator() {
  const [topic, setTopic] = useState('')
  const [loading, setLoading] = useState(false)
  const [lines, setLines] = useState<SubjectLine[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function generate() {
    if (!topic.trim()) {
      setMessage({ type: 'error', text: 'Enter a topic' })
      return
    }

    setLoading(true)
    setLines([])
    setMessage(null)

    try {
      const res = await fetch('/api/marketing-admin/ai-subject-lines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic }),
      })
      const data = await res.json()

      if (data.error) {
        setMessage({ type: 'error', text: data.error })
        return
      }

      setLines(data.subject_lines ?? [])
    } catch {
      setMessage({ type: 'error', text: 'Failed to generate' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-[#F7F4EF]/50 mb-1">Email Topic</label>
        <div className="flex gap-3">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Spring web design tips for local businesses"
            className="flex-1 bg-[#F7F4EF]/5 border border-[#F7F4EF]/10 rounded-lg px-3 py-2 text-sm text-[#F7F4EF] placeholder-[#F7F4EF]/30"
            onKeyDown={(e) => e.key === 'Enter' && generate()}
          />
          <button
            onClick={generate}
            disabled={loading}
            className="px-4 py-2 bg-[#B85C38] text-white text-sm font-medium rounded-lg hover:bg-[#a04e2f] transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>

      {message && (
        <p role="alert" className={`text-sm ${message.type === 'success' ? 'text-green-300' : 'text-red-300'}`}>{message.text}</p>
      )}

      {lines.length > 0 && (
        <div className="space-y-2">
          {lines.map((line, i) => (
            <div
              key={i}
              className="flex items-start justify-between gap-3 p-3 border border-[#F7F4EF]/10 rounded-lg hover:border-[#F7F4EF]/20 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{line.text}</p>
                <p className="text-xs text-[#F7F4EF]/40 mt-1">{line.reasoning}</p>
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(line.text); setMessage({ type: 'success', text: 'Copied!' }) }}
                className="text-xs text-[#B85C38] hover:underline shrink-0"
              >
                Copy
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

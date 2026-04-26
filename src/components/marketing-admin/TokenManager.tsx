import { useState, useEffect } from 'react'
import AlertMessage from './AlertMessage'

interface TokenStatus {
  platform: string
  account_id: string
  scope: string | null
  expires_at: string
  updated_at: string
  status: 'valid' | 'expiring_soon' | 'expired'
}

const PLATFORMS = [
  { id: 'facebook', label: 'Facebook Page', hint: 'Page Access Token (never expires unless revoked)', needsRefresh: false },
  { id: 'instagram', label: 'Instagram Business', hint: 'Same Page Access Token as Facebook', needsRefresh: false },
  { id: 'linkedin', label: 'LinkedIn Company', hint: 'OAuth2 token — expires in 60 days', needsRefresh: true },
  { id: 'gbp', label: 'Google Business Profile', hint: 'OAuth2 token — expires in 1 hour, auto-refreshes', needsRefresh: true },
]

const statusStyles: Record<string, string> = {
  valid: 'bg-green-900/30 text-green-300',
  expiring_soon: 'bg-yellow-900/30 text-yellow-300',
  expired: 'bg-red-900/30 text-red-300',
  not_connected: 'bg-[#F7F4EF]/10 text-[#F7F4EF]/40',
}

export default function TokenManager() {
  const [tokens, setTokens] = useState<TokenStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState({
    platform: '',
    access_token: '',
    refresh_token: '',
    expires_at: '',
    account_id: '',
    scope: '',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  async function fetchTokens() {
    try {
      const res = await fetch('/api/marketing-admin/tokens')
      const data = await res.json()
      setTokens(data.tokens ?? [])
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTokens() }, [])

  function getTokenForPlatform(platformId: string): TokenStatus | undefined {
    return tokens.find((t) => t.platform === platformId)
  }

  function startEdit(platformId: string) {
    const existing = getTokenForPlatform(platformId)
    setEditing(platformId)
    setForm({
      platform: platformId,
      access_token: '',
      refresh_token: '',
      expires_at: existing?.expires_at ?? '',
      account_id: existing?.account_id ?? '',
      scope: existing?.scope ?? '',
    })
    setMessage(null)
  }

  function cancel() {
    setEditing(null)
    setMessage(null)
  }

  async function save() {
    if (!form.access_token) {
      setMessage({ type: 'error', text: 'Access token is required' })
      return
    }
    if (!form.account_id) {
      setMessage({ type: 'error', text: 'Account ID is required' })
      return
    }
    if (!form.expires_at) {
      setMessage({ type: 'error', text: 'Expiry date is required' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const res = await fetch('/api/marketing-admin/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: form.platform,
          access_token: form.access_token,
          refresh_token: form.refresh_token || null,
          expires_at: new Date(form.expires_at).toISOString(),
          account_id: form.account_id,
          scope: form.scope || null,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMessage({ type: 'error', text: data.error ?? 'Failed to save' })
        return
      }

      setMessage({ type: 'success', text: `${form.platform} token saved and encrypted` })
      setEditing(null)
      await fetchTokens()
    } catch {
      setMessage({ type: 'error', text: 'Network error' })
    } finally {
      setSaving(false)
    }
  }

  async function disconnect(platform: string) {
    if (!confirm(`Disconnect ${platform}? The encrypted token will be permanently deleted.`)) return
    try {
      const res = await fetch('/api/marketing-admin/tokens', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform }),
      })
      if (res.ok) {
        setMessage({ type: 'success', text: `${platform} disconnected` })
        await fetchTokens()
      } else {
        setMessage({ type: 'error', text: 'Failed to disconnect' })
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' })
    }
  }

  if (loading) return <p className="text-sm text-[#F7F4EF]/50">Loading...</p>

  return (
    <div className="space-y-4">
      <AlertMessage message={message} />

      {editing ? (
        <div className="border border-[#F7F4EF]/10 rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-sm capitalize">
            Configure {PLATFORMS.find((p) => p.id === editing)?.label ?? editing}
          </h3>

          <div>
            <label className="block text-xs text-[#F7F4EF]/50 mb-1">Account ID</label>
            <input
              type="text"
              value={form.account_id}
              onChange={(e) => setForm({ ...form, account_id: e.target.value })}
              placeholder={editing === 'facebook' ? 'Page ID (e.g. 123456789)' : editing === 'instagram' ? 'IG Business Account ID' : editing === 'linkedin' ? 'Organization ID (numeric)' : 'accounts/123/locations/456'}
              className="w-full bg-[#F7F4EF]/5 border border-[#F7F4EF]/10 rounded-lg px-3 py-2 text-sm text-[#F7F4EF] placeholder-[#F7F4EF]/30"
            />
          </div>

          <div>
            <label className="block text-xs text-[#F7F4EF]/50 mb-1">Access Token</label>
            <textarea
              value={form.access_token}
              onChange={(e) => setForm({ ...form, access_token: e.target.value })}
              placeholder="Paste the access token here — it will be encrypted before storage"
              rows={3}
              className="w-full bg-[#F7F4EF]/5 border border-[#F7F4EF]/10 rounded-lg px-3 py-2 text-sm text-[#F7F4EF] placeholder-[#F7F4EF]/30 font-mono text-xs"
            />
          </div>

          {PLATFORMS.find((p) => p.id === editing)?.needsRefresh && (
            <div>
              <label className="block text-xs text-[#F7F4EF]/50 mb-1">Refresh Token (for auto-renewal)</label>
              <textarea
                value={form.refresh_token}
                onChange={(e) => setForm({ ...form, refresh_token: e.target.value })}
                placeholder="OAuth2 refresh token"
                rows={2}
                className="w-full bg-[#F7F4EF]/5 border border-[#F7F4EF]/10 rounded-lg px-3 py-2 text-sm text-[#F7F4EF] placeholder-[#F7F4EF]/30 font-mono text-xs"
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-[#F7F4EF]/50 mb-1">Expires At</label>
            <input
              type="datetime-local"
              value={form.expires_at ? form.expires_at.slice(0, 16) : ''}
              onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
              className="bg-[#F7F4EF]/5 border border-[#F7F4EF]/10 rounded-lg px-3 py-2 text-sm text-[#F7F4EF]"
            />
            <p className="text-xs text-[#F7F4EF]/30 mt-1">
              {editing === 'facebook' || editing === 'instagram'
                ? 'Page tokens never expire — set far future (e.g. 2030)'
                : editing === 'linkedin'
                  ? 'LinkedIn tokens expire in 60 days'
                  : 'GBP tokens expire in 1 hour — auto-refreshed by scheduler'}
            </p>
          </div>

          <div>
            <label className="block text-xs text-[#F7F4EF]/50 mb-1">Scope (optional)</label>
            <input
              type="text"
              value={form.scope}
              onChange={(e) => setForm({ ...form, scope: e.target.value })}
              placeholder="e.g. pages_manage_posts,instagram_content_publish"
              className="w-full bg-[#F7F4EF]/5 border border-[#F7F4EF]/10 rounded-lg px-3 py-2 text-sm text-[#F7F4EF] placeholder-[#F7F4EF]/30"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 bg-[#B85C38] text-white text-sm font-medium rounded-lg hover:bg-[#a04e2f] transition-colors disabled:opacity-50"
            >
              {saving ? 'Encrypting & Saving...' : 'Save Token'}
            </button>
            <button onClick={cancel} className="px-4 py-2 text-sm text-[#F7F4EF]/50 hover:text-[#F7F4EF] transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {PLATFORMS.map(({ id, label, hint }) => {
            const token = getTokenForPlatform(id)
            const status = token?.status ?? 'not_connected'

            return (
              <div key={id} className="flex items-center justify-between p-4 border border-[#F7F4EF]/10 rounded-xl hover:border-[#F7F4EF]/20 transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{label}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusStyles[status]}`}>
                      {status === 'not_connected' ? 'not connected' : status.replace('_', ' ')}
                    </span>
                  </div>
                  {token ? (
                    <div className="text-xs text-[#F7F4EF]/40 mt-1 space-y-0.5">
                      <p>Account: <span className="font-mono">{token.account_id}</span></p>
                      <p>Expires: {new Date(token.expires_at).toLocaleDateString()}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-[#F7F4EF]/30 mt-1">{hint}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0 ml-4">
                  <button
                    onClick={() => startEdit(id)}
                    className="px-3 py-1.5 text-xs border border-[#F7F4EF]/10 rounded-lg hover:border-[#B85C38]/50 hover:text-[#B85C38] transition-colors"
                  >
                    {token ? 'Update' : 'Connect'}
                  </button>
                  {token && (
                    <button
                      onClick={() => disconnect(id)}
                      className="px-3 py-1.5 text-xs border border-[#F7F4EF]/10 rounded-lg hover:border-red-500/50 hover:text-red-400 transition-colors"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

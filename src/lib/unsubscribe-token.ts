// ─── HMAC-signed unsubscribe tokens ─────────────────
// Replaces insecure base64(email) with HMAC-SHA256 signed tokens.
// Token format: base64(email).hmac_hex
// Only the server with the secret can generate valid tokens.

async function hmacSign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

export async function createUnsubscribeToken(email: string, secret: string): Promise<string> {
  const payload = btoa(email)
  const signature = await hmacSign(payload, secret)
  return `${payload}.${signature}`
}

export async function verifyUnsubscribeToken(token: string, secret: string): Promise<string | null> {
  const dotIndex = token.lastIndexOf('.')
  if (dotIndex === -1) return null

  const payload = token.slice(0, dotIndex)
  const signature = token.slice(dotIndex + 1)

  const expected = await hmacSign(payload, secret)
  if (signature !== expected) return null

  try {
    return atob(payload)
  } catch {
    return null
  }
}

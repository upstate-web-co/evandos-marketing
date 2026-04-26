// Token encryption/decryption uses AES-256-GCM via Web Crypto API
// Available in both Cloudflare Workers and browser (but tokens are server-only)

const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256
const IV_LENGTH = 12 // 96 bits for AES-GCM

async function getKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret.padEnd(32, '0').slice(0, 32)),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: encoder.encode('uwc-social-tokens'), iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encrypt(plaintext: string, secret: string): Promise<string> {
  const key = await getKey(secret)
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, encoded)
  // Concatenate IV + ciphertext, base64 encode
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return btoa(String.fromCharCode(...combined))
}

export async function decrypt(encrypted: string, secret: string): Promise<string> {
  const key = await getKey(secret)
  const combined = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0))
  const iv = combined.slice(0, IV_LENGTH)
  const ciphertext = combined.slice(IV_LENGTH)
  const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext)
  return new TextDecoder().decode(decrypted)
}

export interface StoredToken {
  platform: string
  access_token: string // decrypted
  refresh_token: string | null // decrypted
  expires_at: string
  account_id: string
  scope: string | null
}

export async function getValidToken(
  db: any,
  platform: string,
  encryptionKey: string
): Promise<StoredToken | null> {
  const row = await db
    .prepare('SELECT * FROM social_tokens WHERE platform = ?1')
    .bind(platform)
    .first()

  if (!row) return null

  const token: StoredToken = {
    platform: row.platform,
    access_token: await decrypt(row.access_token, encryptionKey),
    refresh_token: row.refresh_token ? await decrypt(row.refresh_token, encryptionKey) : null,
    expires_at: row.expires_at,
    account_id: row.account_id,
    scope: row.scope,
  }

  return token
}

export async function storeToken(
  db: any,
  platform: string,
  accessToken: string,
  refreshToken: string | null,
  expiresAt: string,
  accountId: string,
  scope: string | null,
  encryptionKey: string
): Promise<void> {
  const encAccessToken = await encrypt(accessToken, encryptionKey)
  const encRefreshToken = refreshToken ? await encrypt(refreshToken, encryptionKey) : null

  await db
    .prepare(
      `INSERT INTO social_tokens (platform, access_token, refresh_token, expires_at, account_id, scope, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))
       ON CONFLICT(platform) DO UPDATE SET
         access_token = ?2,
         refresh_token = ?3,
         expires_at = ?4,
         account_id = ?5,
         scope = ?6,
         updated_at = datetime('now')`
    )
    .bind(platform, encAccessToken, encRefreshToken, expiresAt, accountId, scope)
    .run()
}

export function isTokenExpired(expiresAt: string): boolean {
  return new Date(expiresAt) <= new Date()
}

export function isTokenExpiringSoon(expiresAt: string, minutesBefore = 5): boolean {
  const expiry = new Date(expiresAt).getTime()
  const now = Date.now()
  return expiry - now < minutesBefore * 60 * 1000
}

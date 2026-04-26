import { getEnv } from '../../../lib/env'
import type { APIContext } from 'astro'
import { storeToken, isTokenExpired, isTokenExpiringSoon } from '../../../lib/social/tokens'
import { StoreTokenSchema } from '../../../lib/schemas'

export async function GET({ locals }: APIContext) {
  try {
    const env = getEnv(locals)
    const db = env.DB
    if (!db) return Response.json({ error: 'Database not configured', code: 'DB_NOT_CONFIGURED' }, { status: 500 })

    // Return token status (not the actual tokens)
    const { results } = await db
      .prepare('SELECT platform, expires_at, account_id, scope, updated_at FROM social_tokens ORDER BY platform ASC')
      .all()

    const tokens = results.map((row: any) => ({
      platform: row.platform,
      account_id: row.account_id,
      scope: row.scope,
      expires_at: row.expires_at,
      updated_at: row.updated_at,
      status: isTokenExpired(row.expires_at)
        ? 'expired'
        : isTokenExpiringSoon(row.expires_at, 60)
          ? 'expiring_soon'
          : 'valid',
    }))

    return Response.json({ tokens })
  } catch (err) {
    console.error('[tokens] GET error:', err)
    return Response.json({ error: 'Failed to fetch tokens', code: 'FETCH_FAILED' }, { status: 500 })
  }
}

export async function POST({ request, locals }: APIContext) {
  try {
    const env = getEnv(locals)
    const db = env.DB
    const encryptionKey = env.SOCIAL_TOKEN_ENCRYPTION_KEY

    if (!db || !encryptionKey) {
      return Response.json({ error: 'Database or encryption key not configured', code: 'DB_NOT_CONFIGURED' }, { status: 500 })
    }

    const body = await request.json()
    const parsed = StoreTokenSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', code: 'VALIDATION_ERROR', issues: parsed.error.issues }, { status: 400 })
    }

    const { platform, access_token, refresh_token, expires_at, account_id, scope } = parsed.data
    await storeToken(db, platform, access_token, refresh_token ?? null, expires_at, account_id, scope ?? null, encryptionKey)

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[tokens] POST error:', err)
    return Response.json({ error: 'Failed to store token', code: 'CREATE_FAILED' }, { status: 500 })
  }
}

// C6: Token disconnect — purge encrypted token from D1
export async function DELETE({ request, locals }: APIContext) {
  try {
    const env = getEnv(locals)
    const db = env.DB
    if (!db) return Response.json({ error: 'Database not configured', code: 'DB_NOT_CONFIGURED' }, { status: 500 })

    const body = await request.json()
    const { platform } = body

    if (!platform || typeof platform !== 'string') {
      return Response.json({ error: 'platform is required', code: 'VALIDATION_ERROR' }, { status: 400 })
    }

    await db.prepare('DELETE FROM social_tokens WHERE platform = ?1').bind(platform).run()

    return Response.json({ ok: true })
  } catch (err) {
    console.error('[tokens] DELETE error:', err)
    return Response.json({ error: 'Failed to disconnect platform', code: 'DELETE_FAILED' }, { status: 500 })
  }
}

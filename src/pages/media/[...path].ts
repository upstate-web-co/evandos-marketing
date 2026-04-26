import type { APIContext } from 'astro'
import { getEnv } from '../../lib/env'

export async function GET({ params, locals }: APIContext) {
  try {
    const env = getEnv(locals)
    const bucket = env.MEDIA

    if (!bucket) {
      return new Response('Storage not configured', { status: 500 })
    }

    const key = params.path
    if (!key) {
      return new Response('Not found', { status: 404 })
    }

    const object = await bucket.get(key)
    if (!object) {
      return new Response('Not found', { status: 404 })
    }

    const headers = new Headers()
    headers.set('Content-Type', object.httpMetadata?.contentType ?? 'application/octet-stream')
    headers.set('Cache-Control', 'public, max-age=31536000, immutable')

    return new Response(object.body, { headers })
  } catch (err) {
    console.error('[media] Error:', err)
    return new Response('Internal error', { status: 500 })
  }
}

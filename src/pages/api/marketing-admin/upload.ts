import { getEnv } from '../../../lib/env'
import type { APIContext } from 'astro'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

// Site URL used to build absolute media URLs for social platform APIs
const SITE_URL = 'https://uwc-marketing-site.pages.dev'

export async function POST({ request, locals }: APIContext) {
  try {
    const env = getEnv(locals)
    const bucket = env.MEDIA

    if (!bucket) {
      return Response.json({ error: 'R2 storage not configured', code: 'SERVICE_NOT_CONFIGURED' }, { status: 500 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return Response.json({ error: 'No file provided', code: 'VALIDATION_ERROR' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return Response.json(
        { error: `Unsupported file type: ${file.type}. Allowed: JPEG, PNG, GIF, WebP` },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return Response.json({ error: 'File too large. Maximum 10MB.', code: 'VALIDATION_ERROR' }, { status: 400 })
    }

    // Generate unique key: social/YYYY-MM/uuid.ext
    const now = new Date()
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const ext = file.name.split('.').pop() ?? 'jpg'
    const id = crypto.randomUUID()
    const key = `social/${month}/${id}.${ext}`

    // Upload to R2
    await bucket.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    })

    // Build absolute public URL — social platform APIs need full URLs to fetch images
    const baseUrl = env.R2_PUBLIC_URL || env.SITE_URL || SITE_URL
    const publicUrl = `${baseUrl}/media/${key}`

    return Response.json({
      ok: true,
      key,
      url: publicUrl,
      size: file.size,
      type: file.type,
    })
  } catch (err) {
    console.error('[upload] Error:', err)
    return Response.json({ error: 'Upload failed', code: 'UPLOAD_FAILED' }, { status: 500 })
  }
}

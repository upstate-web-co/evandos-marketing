// Meta Graph API v21.0 — Facebook Page + Instagram Business
// Always use Page Access Token (never expires unless revoked)

const API_BASE = 'https://graph.facebook.com/v21.0'

interface MetaPostResult {
  success: boolean
  postId?: string
  error?: string
}

// Post to Facebook Page feed
export async function postToFacebook(
  pageId: string,
  accessToken: string,
  message: string,
  mediaUrl?: string
): Promise<MetaPostResult> {
  try {
    const body: Record<string, string> = { message, access_token: accessToken }

    if (mediaUrl) {
      // Photo post
      const res = await fetch(`${API_BASE}/${pageId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, url: mediaUrl }),
      })
      const data = await res.json()

      if (data.error) return { success: false, error: data.error.message }
      return { success: true, postId: data.id }
    }

    // Text post
    const res = await fetch(`${API_BASE}/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()

    if (data.error) return { success: false, error: data.error.message }
    return { success: true, postId: data.id }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// Post to Instagram Business Account (two-step: create container, then publish)
export async function postToInstagram(
  igAccountId: string,
  accessToken: string,
  caption: string,
  mediaUrl: string // Required for IG — must be a publicly accessible URL
): Promise<MetaPostResult> {
  try {
    // Step 1: Create media container
    const containerRes = await fetch(`${API_BASE}/${igAccountId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: mediaUrl,
        caption,
        access_token: accessToken,
      }),
    })
    const containerData = await containerRes.json()

    if (containerData.error) return { success: false, error: containerData.error.message }

    const creationId = containerData.id

    // Step 2: Publish the container
    const publishRes = await fetch(`${API_BASE}/${igAccountId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        creation_id: creationId,
        access_token: accessToken,
      }),
    })
    const publishData = await publishRes.json()

    if (publishData.error) return { success: false, error: publishData.error.message }
    return { success: true, postId: publishData.id }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

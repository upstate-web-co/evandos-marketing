// Google Business Profile API — Local Posts
// Token expires every hour — must refresh with refresh_token

const API_BASE = 'https://mybusiness.googleapis.com/v4'

interface GbpPostResult {
  success: boolean
  postId?: string
  error?: string
}

export async function postToGbp(
  locationName: string, // e.g. "accounts/123/locations/456"
  accessToken: string,
  summary: string,
  callToActionUrl?: string
): Promise<GbpPostResult> {
  try {
    const body: any = {
      languageCode: 'en',
      summary,
      topicType: 'STANDARD',
    }

    if (callToActionUrl) {
      body.callToAction = {
        actionType: 'LEARN_MORE',
        url: callToActionUrl,
      }
    }

    const res = await fetch(`${API_BASE}/${locationName}/localPosts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errorText = await res.text()
      return { success: false, error: `GBP API ${res.status}: ${errorText}` }
    }

    const data = await res.json()
    return { success: true, postId: data.name }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// Refresh Google OAuth2 token
export async function refreshGoogleToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<{ access_token: string; expires_in: number } | null> {
  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    })

    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })

    if (!res.ok) return null

    return await res.json()
  } catch {
    return null
  }
}

// LinkedIn API v2 — Organization (Company Page) posts
// Token expires in 60 days — must refresh

const API_BASE = 'https://api.linkedin.com/v2'

interface LinkedInPostResult {
  success: boolean
  postId?: string
  error?: string
}

export async function postToLinkedIn(
  orgId: string, // numeric org ID (not URN)
  accessToken: string,
  text: string
): Promise<LinkedInPostResult> {
  try {
    const body = {
      author: `urn:li:organization:${orgId}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text },
          shareMediaCategory: 'NONE',
        },
      },
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    }

    const res = await fetch(`${API_BASE}/ugcPosts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errorText = await res.text()
      return { success: false, error: `LinkedIn API ${res.status}: ${errorText}` }
    }

    const postId = res.headers.get('x-restli-id') ?? undefined
    return { success: true, postId }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

// Refresh LinkedIn OAuth2 token
export async function refreshLinkedInToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<{ access_token: string; expires_in: number; refresh_token?: string } | null> {
  try {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    })

    const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
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

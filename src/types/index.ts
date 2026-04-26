// TypeScript interfaces matching D1 marketing schema 1:1
// Source of truth: migrations/0001_marketing_schema.sql + 0002 + 0003

export interface ContentDraft {
  id: string
  title: string | null
  body: string
  platforms_json: string // JSON array of platform strings
  media_r2_keys_json: string // JSON array of R2 key strings
  status: 'draft' | 'scheduled' | 'archived'
  ai_generated: number // 0 or 1
  created_at: string
  updated_at: string
}

export interface SocialPost {
  id: string
  content_draft_id: string | null
  platform: 'facebook' | 'instagram' | 'linkedin' | 'gbp'
  content: string
  media_r2_key: string | null
  media_url: string | null
  scheduled_at: string
  posted_at: string | null
  status: 'draft' | 'scheduled' | 'posting' | 'posted' | 'failed' | 'cancelled'
  external_id: string | null
  error_message: string | null
  retry_count: number
  ai_generated: number // 0 or 1
  content_history_json: string | null // JSON array of { content, changed_at }
  created_at: string
  updated_at: string
}

export interface SocialPostWithDraft extends SocialPost {
  draft_title: string | null
  draft_body: string | null
  draft_platforms: string | null
  media_r2_keys_json: string | null
}

export interface ContentHistoryEntry {
  content: string
  changed_at: string
}

export interface SocialToken {
  id: string
  platform: 'facebook' | 'instagram' | 'linkedin' | 'gbp'
  access_token: string // encrypted in D1
  refresh_token: string | null // encrypted in D1
  expires_at: string
  account_id: string
  scope: string | null
  created_at: string
  updated_at: string
}

export interface TokenStatus {
  platform: string
  account_id: string
  scope: string | null
  expires_at: string
  updated_at: string
  status: 'valid' | 'expiring_soon' | 'expired'
}

export interface SeoPage {
  id: string
  path: string
  title: string | null
  description: string | null
  og_image_r2_key: string | null
  schema_json: string | null
  noindex: number // 0 or 1
  updated_at: string
}

export interface AnalyticsDaily {
  id: string
  date: string
  page_views: number
  unique_visitors: number
  top_pages_json: string // JSON array
  source_json: string // JSON array
  cf_raw_json: string | null
  ga4_raw_json: string | null
  created_at: string
}

export interface DashboardStats {
  posts_this_week: number
  scheduled: number
  platforms_connected: number
  failed: number
  drafts: number
}

export type Platform = 'facebook' | 'instagram' | 'linkedin' | 'gbp'
export const PLATFORMS: readonly Platform[] = ['facebook', 'instagram', 'linkedin', 'gbp'] as const

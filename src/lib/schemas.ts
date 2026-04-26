import { z } from 'zod'

// ─── Contact Form (public) ──────────────────────────

export const ContactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email address'),
  business: z.string().max(200).optional().default(''),
  message: z.string().min(10, 'Message must be at least 10 characters').max(5000),
})

// ─── Content Drafts ─────────────────────────────────

export const CreateDraftSchema = z.object({
  title: z.string().max(500).optional(),
  body: z.string().min(1, 'Content body is required'),
  platforms: z.array(z.enum(['facebook', 'instagram', 'linkedin', 'gbp'])).optional().default([]),
  media_r2_keys: z.array(z.string()).optional().default([]),
})

export const UpdateDraftSchema = z.object({
  id: z.string().min(1, 'id is required'),
  title: z.string().max(500).nullable().optional(),
  body: z.string().min(1).nullable().optional(),
  platforms: z.array(z.enum(['facebook', 'instagram', 'linkedin', 'gbp'])).optional(),
  status: z.enum(['draft', 'scheduled', 'archived']).optional(),
})

// ─── Social Post Scheduling ─────────────────────────

export const SchedulePostSchema = z.object({
  content_draft_id: z.string().optional(),
  platform: z.enum(['facebook', 'instagram', 'linkedin', 'gbp']),
  content: z.string().min(1, 'Content is required'),
  scheduled_at: z.string().min(1, 'Scheduled time is required'),
  media_r2_key: z.string().optional(),
  media_url: z.string().optional(),
})

export const CancelPostSchema = z.object({
  id: z.string().min(1, 'id is required'),
})

// ─── Post Detail Update ─────────────────────────────

export const UpdatePostSchema = z.object({
  content: z.string().min(1).optional(),
  scheduled_at: z.string().optional(),
  status: z.enum(['scheduled', 'cancelled']).optional(),
}).refine(data => Object.values(data).some(v => v !== undefined), {
  message: 'At least one field must be provided',
})

// ─── SEO Pages ──────────────────────────────────────

export const UpsertSeoSchema = z.object({
  path: z.string().min(1, 'Path is required').startsWith('/'),
  title: z.string().max(200).nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  schema_json: z.string().nullable().optional(),
  noindex: z.boolean().optional().default(false),
})

export const DeleteSeoSchema = z.object({
  path: z.string().min(1, 'Path is required').startsWith('/'),
})

// ─── Social Tokens ──────────────────────────────────

export const StoreTokenSchema = z.object({
  platform: z.enum(['facebook', 'instagram', 'linkedin', 'gbp']),
  access_token: z.string().min(1, 'Access token is required'),
  refresh_token: z.string().nullable().optional(),
  expires_at: z.string().min(1, 'Expiry is required'),
  account_id: z.string().min(1, 'Account ID is required'),
  scope: z.string().nullable().optional(),
})

// ─── AI Draft ───────────────────────────────────────

export const AiDraftSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required'),
  platform: z.enum(['facebook', 'instagram', 'linkedin', 'gbp']).optional(),
  existingContent: z.string().optional(),
})

export const AiSeoSchema = z.object({
  path: z.string().min(1, 'Path is required').startsWith('/'),
  currentTitle: z.string().optional(),
  currentDescription: z.string().optional(),
})

export const AiRepurposeSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  sourcePlatform: z.enum(['facebook', 'instagram', 'linkedin', 'gbp']),
})

export const AiCalendarSchema = z.object({
  days: z.number().int().min(1).max(30).optional().default(7),
  existingPosts: z.array(z.string()).optional().default([]),
})

export const AiSubjectLinesSchema = z.object({
  topic: z.string().min(1, 'Topic is required'),
  count: z.number().int().min(1).max(10).optional().default(5),
})

export const AiBlogOutlineSchema = z.object({
  topic: z.string().min(1, 'Topic is required'),
  targetKeywords: z.array(z.string()).optional().default([]),
})

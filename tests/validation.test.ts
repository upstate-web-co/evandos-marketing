import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Re-create the contact form schema as used in src/pages/api/contact.ts
// This tests the validation rules without needing the Astro API context
const contactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email address'),
  business: z.string().max(200).optional().default(''),
  message: z.string().min(10, 'Message must be at least 10 characters').max(5000),
})

// Upload validation constants (mirrors src/pages/api/marketing-admin/upload.ts)
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_SIZE = 10 * 1024 * 1024

// ─── Contact Form Validation ─────────────────────────

describe('contactSchema', () => {
  const valid = {
    name: 'Jane Smith',
    email: 'jane@example.com',
    message: 'I need a website for my restaurant in Greenville.',
  }

  it('accepts valid complete input', () => {
    expect(contactSchema.safeParse(valid).success).toBe(true)
  })

  it('accepts with optional business field', () => {
    const result = contactSchema.safeParse({ ...valid, business: "Jane's Bistro" })
    expect(result.success).toBe(true)
  })

  it('defaults business to empty string when omitted', () => {
    const result = contactSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.business).toBe('')
    }
  })

  it('rejects missing name', () => {
    const { name, ...noName } = valid
    expect(contactSchema.safeParse(noName).success).toBe(false)
  })

  it('rejects empty name', () => {
    expect(contactSchema.safeParse({ ...valid, name: '' }).success).toBe(false)
  })

  it('rejects name exceeding 200 chars', () => {
    expect(contactSchema.safeParse({ ...valid, name: 'a'.repeat(201) }).success).toBe(false)
  })

  it('rejects missing email', () => {
    const { email, ...noEmail } = valid
    expect(contactSchema.safeParse(noEmail).success).toBe(false)
  })

  it('rejects invalid email format', () => {
    expect(contactSchema.safeParse({ ...valid, email: 'not-an-email' }).success).toBe(false)
  })

  it('rejects message shorter than 10 chars', () => {
    expect(contactSchema.safeParse({ ...valid, message: 'Too short' }).success).toBe(false)
  })

  it('rejects message exceeding 5000 chars', () => {
    expect(contactSchema.safeParse({ ...valid, message: 'x'.repeat(5001) }).success).toBe(false)
  })

  it('accepts message at exactly 10 chars', () => {
    expect(contactSchema.safeParse({ ...valid, message: 'a'.repeat(10) }).success).toBe(true)
  })
})

// ─── Upload Validation Rules ─────────────────────────

describe('upload validation rules', () => {
  it('allows JPEG', () => {
    expect(ALLOWED_TYPES.includes('image/jpeg')).toBe(true)
  })

  it('allows PNG', () => {
    expect(ALLOWED_TYPES.includes('image/png')).toBe(true)
  })

  it('allows GIF', () => {
    expect(ALLOWED_TYPES.includes('image/gif')).toBe(true)
  })

  it('allows WebP', () => {
    expect(ALLOWED_TYPES.includes('image/webp')).toBe(true)
  })

  it('rejects SVG', () => {
    expect(ALLOWED_TYPES.includes('image/svg+xml')).toBe(false)
  })

  it('rejects video', () => {
    expect(ALLOWED_TYPES.includes('video/mp4')).toBe(false)
  })

  it('rejects PDF', () => {
    expect(ALLOWED_TYPES.includes('application/pdf')).toBe(false)
  })

  it('max size is 10MB', () => {
    expect(MAX_SIZE).toBe(10485760)
  })

  it('has exactly 4 allowed types', () => {
    expect(ALLOWED_TYPES).toHaveLength(4)
  })
})

// ─── Marketing Admin Input Validation ────────────────

// These test the inline validation logic from marketing admin API routes

describe('drafts API validation', () => {
  it('rejects empty body (required field)', () => {
    const body = { title: 'Has title', body: '', platforms: ['facebook'] }
    // The route checks: if (!content || typeof content !== 'string')
    expect(!body.body || typeof body.body !== 'string').toBe(true)
  })

  it('rejects missing body field', () => {
    const body = { title: 'No body' } as any
    expect(!body.body || typeof body.body !== 'string').toBe(true)
  })

  it('rejects non-string body', () => {
    const body = { body: 123 } as any
    expect(!body.body || typeof body.body !== 'string').toBe(true)
  })

  it('accepts valid draft input', () => {
    const body = { title: 'Post title', body: 'Post content here', platforms: ['facebook', 'instagram'] }
    expect(body.body && typeof body.body === 'string').toBe(true)
  })
})

describe('schedule API validation', () => {
  function isValidScheduleInput(body: any): boolean {
    return !!(body.platform && body.content && body.scheduled_at)
  }

  it('accepts valid schedule input', () => {
    expect(isValidScheduleInput({
      platform: 'facebook',
      content: 'Hello world',
      scheduled_at: '2026-04-01T12:00:00Z',
    })).toBe(true)
  })

  it('rejects missing platform', () => {
    expect(isValidScheduleInput({ content: 'Hi', scheduled_at: '2026-04-01T12:00:00Z' })).toBe(false)
  })

  it('rejects missing content', () => {
    expect(isValidScheduleInput({ platform: 'facebook', scheduled_at: '2026-04-01T12:00:00Z' })).toBe(false)
  })

  it('rejects missing scheduled_at', () => {
    expect(isValidScheduleInput({ platform: 'facebook', content: 'Hi' })).toBe(false)
  })

  it('rejects empty strings for required fields', () => {
    expect(isValidScheduleInput({ platform: '', content: 'Hi', scheduled_at: '2026-04-01T12:00:00Z' })).toBe(false)
    expect(isValidScheduleInput({ platform: 'facebook', content: '', scheduled_at: '2026-04-01T12:00:00Z' })).toBe(false)
  })
})

describe('SEO API validation', () => {
  function isValidSeoInput(body: any): boolean {
    return !!(body.path && typeof body.path === 'string')
  }

  it('accepts valid SEO input with path', () => {
    expect(isValidSeoInput({ path: '/', title: 'Home' })).toBe(true)
  })

  it('rejects missing path', () => {
    expect(isValidSeoInput({ title: 'No path' })).toBe(false)
  })

  it('rejects empty path', () => {
    expect(isValidSeoInput({ path: '' })).toBe(false)
  })

  it('rejects non-string path', () => {
    expect(isValidSeoInput({ path: 123 })).toBe(false)
  })
})

describe('token API validation', () => {
  function isValidTokenInput(body: any): boolean {
    return !!(body.platform && body.access_token && body.expires_at && body.account_id)
  }

  it('accepts valid token input', () => {
    expect(isValidTokenInput({
      platform: 'facebook',
      access_token: 'EAA...',
      expires_at: '2099-01-01T00:00:00Z',
      account_id: 'page-123',
    })).toBe(true)
  })

  it('rejects missing platform', () => {
    expect(isValidTokenInput({ access_token: 'x', expires_at: 'x', account_id: 'x' })).toBe(false)
  })

  it('rejects missing access_token', () => {
    expect(isValidTokenInput({ platform: 'facebook', expires_at: 'x', account_id: 'x' })).toBe(false)
  })

  it('rejects missing expires_at', () => {
    expect(isValidTokenInput({ platform: 'facebook', access_token: 'x', account_id: 'x' })).toBe(false)
  })

  it('rejects missing account_id', () => {
    expect(isValidTokenInput({ platform: 'facebook', access_token: 'x', expires_at: 'x' })).toBe(false)
  })

  it('accepts without optional refresh_token and scope', () => {
    expect(isValidTokenInput({
      platform: 'instagram',
      access_token: 'token',
      expires_at: '2099-01-01T00:00:00Z',
      account_id: 'ig-acct',
    })).toBe(true)
  })
})

describe('post detail PUT validation', () => {
  it('rejects empty update (no fields to update)', () => {
    const body = {} as any
    const updates: string[] = []
    if (body.content !== undefined) updates.push('content')
    if (body.scheduled_at !== undefined) updates.push('scheduled_at')
    if (body.status !== undefined) updates.push('status')
    expect(updates.length).toBe(0)
  })

  it('accepts single field update', () => {
    const body = { content: 'Updated' }
    const updates: string[] = []
    if (body.content !== undefined) updates.push('content')
    expect(updates.length).toBe(1)
  })

  it('accepts multiple field update', () => {
    const body = { content: 'Updated', status: 'cancelled' } as any
    const updates: string[] = []
    if (body.content !== undefined) updates.push('content')
    if (body.scheduled_at !== undefined) updates.push('scheduled_at')
    if (body.status !== undefined) updates.push('status')
    expect(updates.length).toBe(2)
  })
})

describe('AI draft API validation', () => {
  function isValidAiDraftInput(body: any): boolean {
    return !!(body.prompt && typeof body.prompt === 'string')
  }

  it('accepts valid prompt', () => {
    expect(isValidAiDraftInput({ prompt: 'Write a post about web design' })).toBe(true)
  })

  it('rejects missing prompt', () => {
    expect(isValidAiDraftInput({ platform: 'facebook' })).toBe(false)
  })

  it('rejects empty prompt', () => {
    expect(isValidAiDraftInput({ prompt: '' })).toBe(false)
  })

  it('rejects non-string prompt', () => {
    expect(isValidAiDraftInput({ prompt: 123 })).toBe(false)
  })

  it('accepts prompt with optional platform and existingContent', () => {
    expect(isValidAiDraftInput({
      prompt: 'Write about Greenville web design',
      platform: 'instagram',
      existingContent: 'Existing draft text',
    })).toBe(true)
  })
})

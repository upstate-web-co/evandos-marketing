import { getEnv } from '../../../lib/env'
import type { APIContext } from 'astro'
import { z } from 'zod'

interface EmailTemplate {
  id: string
  slug: string
  name: string
  subject: string
  body: string
  template_type: string
  step_number: number | null
  delay_days: number | null
  is_active: number
  metadata: string
  created_at: string
  updated_at: string
}

const UpdateTemplateSchema = z.object({
  subject: z.string().min(1).max(500).optional(),
  body: z.string().min(1).max(10000).optional(),
  name: z.string().min(1).max(200).optional(),
  delay_days: z.number().int().min(0).max(90).optional(),
  is_active: z.number().int().min(0).max(1).optional(),
})

// GET: list all email templates
export async function GET({ locals }: APIContext) {
  try {
    const env = getEnv(locals)
    if (!env.DB) return Response.json({ error: 'DB not configured' }, { status: 500 })

    const { results } = await env.DB
      .prepare('SELECT * FROM email_templates ORDER BY template_type ASC, step_number ASC, name ASC')
      .all<EmailTemplate>()

    return Response.json({ data: { templates: results } })
  } catch (err) {
    console.error('GET /api/marketing-admin/email-templates error:', err)
    return Response.json({ error: 'Failed to fetch templates' }, { status: 500 })
  }
}

// PUT: update a template by slug
export async function PUT({ request, locals }: APIContext) {
  try {
    const env = getEnv(locals)
    if (!env.DB) return Response.json({ error: 'DB not configured' }, { status: 500 })

    const raw = await request.json()
    const { slug, ...fields } = raw
    if (!slug || typeof slug !== 'string') {
      return Response.json({ error: 'slug is required' }, { status: 400 })
    }

    const parsed = UpdateTemplateSchema.safeParse(fields)
    if (!parsed.success) {
      return Response.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 400 })
    }

    const updates = parsed.data
    const setClauses: string[] = []
    const values: unknown[] = []

    if (updates.subject !== undefined) { setClauses.push('subject = ?'); values.push(updates.subject) }
    if (updates.body !== undefined) { setClauses.push('body = ?'); values.push(updates.body) }
    if (updates.name !== undefined) { setClauses.push('name = ?'); values.push(updates.name) }
    if (updates.delay_days !== undefined) { setClauses.push('delay_days = ?'); values.push(updates.delay_days) }
    if (updates.is_active !== undefined) { setClauses.push('is_active = ?'); values.push(updates.is_active) }

    if (setClauses.length === 0) {
      return Response.json({ error: 'No fields to update' }, { status: 400 })
    }

    setClauses.push("updated_at = datetime('now')")
    values.push(slug)

    const result = await env.DB
      .prepare(`UPDATE email_templates SET ${setClauses.join(', ')} WHERE slug = ? RETURNING *`)
      .bind(...values)
      .first<EmailTemplate>()

    if (!result) {
      return Response.json({ error: 'Template not found' }, { status: 404 })
    }

    return Response.json({ data: { template: result } })
  } catch (err) {
    console.error('PUT /api/marketing-admin/email-templates error:', err)
    return Response.json({ error: 'Failed to update template' }, { status: 500 })
  }
}

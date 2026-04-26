import { getEnv } from '../../lib/env'
import type { APIContext } from 'astro'
import { z } from 'zod'

const PartialLeadSchema = z.object({
  email: z.string().email(),
  name: z.string().max(200).optional().default(''),
  business_name: z.string().max(200).optional().default(''),
})

export async function POST({ request, locals }: APIContext) {
  try {
    const env = getEnv(locals)
    if (!env.DB) return Response.json({ ok: true })

    const body = await request.json()
    const result = PartialLeadSchema.safeParse(body)
    if (!result.success) return Response.json({ ok: true })

    const { email, name, business_name } = result.data

    // Don't save if they already submitted a full lead
    const existing = await env.DB.prepare(
      "SELECT id FROM leads WHERE email = ? AND created_at > datetime('now', '-1 day')"
    ).bind(email.toLowerCase()).first()
    if (existing) return Response.json({ ok: true })

    // Don't save duplicate partial leads
    const existingPartial = await env.DB.prepare(
      "SELECT id FROM partial_leads WHERE email = ? AND created_at > datetime('now', '-1 day')"
    ).bind(email.toLowerCase()).first()
    if (existingPartial) return Response.json({ ok: true })

    await env.DB.prepare(
      "INSERT INTO partial_leads (email, name, business_name) VALUES (?, ?, ?)"
    ).bind(email.toLowerCase(), name || null, business_name || null).run()

    return Response.json({ ok: true })
  } catch {
    return Response.json({ ok: true })
  }
}

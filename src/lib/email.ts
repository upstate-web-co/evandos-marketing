import { Resend } from 'resend'

// ─── Branded Email Wrapper ─────────────────────────
// Wraps any email content in a consistent UWC branded template.
// Use for broadcasts, nurture emails, or any email that should look "official".
// 1:1 client replies should NOT use this — they should look personal.

export function brandedEmailWrapper(content: string, opts?: { unsubscribeUrl?: string; preheader?: string }): string {
  const unsubBlock = opts?.unsubscribeUrl
    ? `<p style="margin: 0; font-size: 12px;"><a href="${opts.unsubscribeUrl}" style="color: #B85C38; text-decoration: underline;">Unsubscribe</a></p>`
    : ''
  const preheader = opts?.preheader
    ? `<span style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${opts.preheader}</span>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #F7F4EF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #F7F4EF;">
    <tr><td align="center" style="padding: 32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
        <!-- Header -->
        <tr><td style="padding: 24px 32px 16px; border-bottom: 1px solid #f0ece6;">
          <span style="font-size: 14px; font-weight: 700; color: #B85C38; letter-spacing: 0.5px;">UPSTATE WEB CO.</span>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding: 24px 32px 32px; color: #374151; font-size: 15px; line-height: 1.7;">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding: 20px 32px; background-color: #faf8f5; border-top: 1px solid #f0ece6;">
          <p style="margin: 0 0 4px; font-size: 13px; color: #6b7280;">Joshua — Upstate Web Co.</p>
          <p style="margin: 0 0 8px; font-size: 12px; color: #9ca3af;">Web design for solopreneurs and small businesses</p>
          ${unsubBlock}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

interface ContactEmailData {
  name: string
  email: string
  business?: string
  message: string
}

export async function sendContactEmail(apiKey: string, data: ContactEmailData) {
  const resend = new Resend(apiKey)

  const { error } = await resend.emails.send({
    from: 'Upstate Web Co. <contact@upstate-web.com>',
    to: 'hello@upstate-web.com',
    replyTo: data.email,
    subject: `New inquiry from ${data.name}${data.business ? ` (${data.business})` : ''}`,
    text: [
      `Name: ${data.name}`,
      `Email: ${data.email}`,
      data.business ? `Business: ${data.business}` : null,
      '',
      'Message:',
      data.message,
    ]
      .filter(Boolean)
      .join('\n'),
  })

  if (error) {
    throw new Error(`Failed to send email: ${error.message}`)
  }
}

export async function sendWelcomeEmail(apiKey: string, to: string, unsubscribeUrl: string) {
  const resend = new Resend(apiKey)

  const { error } = await resend.emails.send({
    from: 'Upstate Web Co. <hello@upstate-web.com>',
    to,
    subject: 'Welcome to Upstate Web Co. updates',
    text: [
      "Thanks for subscribing! You'll get occasional web design tips, pricing guides, and digital marketing advice — tailored for small businesses and solopreneurs.",
      '',
      "We keep it short and useful. No spam, ever.",
      '',
      '— Upstate Web Co.',
      'Greenville, SC',
      '',
      `Unsubscribe: ${unsubscribeUrl}`,
    ].join('\n'),
  })

  if (error) {
    console.error('[email] Welcome email failed:', error.message)
  }
}

export async function sendLeadMagnetEmail(apiKey: string, to: string, downloadUrl: string, unsubscribeUrl: string) {
  const resend = new Resend(apiKey)

  const { error } = await resend.emails.send({
    from: 'Upstate Web Co. <hello@upstate-web.com>',
    to,
    subject: 'Your free website checklist is ready',
    text: [
      "Here's your free Website Audit Checklist for SC Businesses:",
      '',
      downloadUrl,
      '',
      "Use it to check your site's speed, SEO, mobile experience, and local search presence. If anything looks off, we're happy to help — just reply to this email.",
      '',
      '— Upstate Web Co.',
      'Greenville, SC',
      '',
      `Unsubscribe: ${unsubscribeUrl}`,
    ].join('\n'),
  })

  if (error) {
    console.error('[email] Lead magnet email failed:', error.message)
  }
}

// ─── Nurture Sequence Emails ────────────────────────

export interface NurtureEmailConfig {
  apiKey: string
  to: string
  unsubscribeUrl: string
  siteUrl: string
  industry?: string | null
}

/**
 * 5-email nurture sequence. Step 0 = welcome (handled by sendWelcomeEmail).
 * Steps 1-4 are sent on days 1, 3, 5, 7 after signup.
 */
export const NURTURE_STEPS = [
  { step: 1, delayDays: 1, subject: 'Is your website costing you customers?' },
  { step: 2, delayDays: 3, subject: 'One thing you can do today to get more calls' },
  { step: 3, delayDays: 5, subject: 'How a Greenville business doubled their leads' },
  { step: 4, delayDays: 7, subject: 'Ready to talk about your website?' },
  { step: 5, delayDays: 10, subject: 'What a website actually costs (no surprises)' },
  { step: 6, delayDays: 14, subject: 'Our clients said it better than we could' },
  { step: 7, delayDays: 21, subject: 'Still thinking about it?' },
] as const

function getNurtureStep3Body(config: NurtureEmailConfig): string {
  const industry = config.industry

  if (industry === 'personal-care') {
    return [
      "Fade House is a barbershop in Spartanburg that had a 4.9-star reputation — but no website and no online booking.",
      '',
      "Customers booked through Instagram DMs. No-shows were costing $300-500 a month in lost chair time. A competitor opened two blocks away with online booking.",
      '',
      "We built them a website with online booking, per-barber scheduling, and a $10 refundable deposit system. The result:",
      "- No-shows dropped immediately (when money's on the line, people show up)",
      "- An AI chat assistant handles 50+ daily questions about hours and pricing",
      "- New customers find them on Google instead of going to the competition",
      '',
      `Read the full story: ${config.siteUrl}/work/fade-cuts-barbershop`,
      '',
      "If you run a salon, barbershop, or spa — online booking with deposits changes the game.",
      '',
      '— Upstate Web Co.',
      '',
      `Unsubscribe: ${config.unsubscribeUrl}`,
    ].join('\n')
  }

  if (industry === 'retail') {
    return [
      "Peach & Thread is a women's boutique in downtown Greenville with 4,200 Instagram followers — but no online store.",
      '',
      "Customers were trying to buy through DMs. Out-of-state followers couldn't shop at all. And fall season — 60% of annual revenue — was approaching fast.",
      '',
      "We built them an online store with their top 50 products, Stripe checkout, and a Friday New Arrivals feature. The result:",
      "- Customers can browse, pick sizes, and checkout without DM back-and-forth",
      "- Out-of-state followers can finally buy",
      "- Friday drops drive weekly repeat traffic to the site",
      '',
      `Read the full story: ${config.siteUrl}/work/peach-thread-boutique`,
      '',
      "If you run a retail shop with a social media following, you're sitting on an audience that wants to buy from you online.",
      '',
      '— Upstate Web Co.',
      '',
      `Unsubscribe: ${config.unsubscribeUrl}`,
    ].join('\n')
  }

  if (industry === 'home-services') {
    return [
      "Ridgemark Property Services is a home services company in Greenville offering landscaping, HVAC, and plumbing — but they had no website.",
      '',
      "Homeowners searching for local services found competitors instead. Great before-and-after work was trapped on social media.",
      '',
      "We built them a professional site with dedicated service pages, a project gallery, and local SEO. The result:",
      "- Showing up when homeowners search for services in Greenville and Greer",
      "- Before-and-after gallery converting browsers into callers",
      "- Contact form with instant notifications so no lead gets missed",
      '',
      `Read the full story: ${config.siteUrl}/work/lookaround-home-services`,
      '',
      "If you run a home services business, your next customer is searching Google right now. A professional site turns those searches into jobs.",
      '',
      '— Upstate Web Co.',
      '',
      `Unsubscribe: ${config.unsubscribeUrl}`,
    ].join('\n')
  }

  if (industry === 'saas') {
    return [
      "MyChama is a group savings platform that was struggling with slow load times and high hosting costs.",
      '',
      "Their app shipped heavy code to every visitor — even pages that were just showing information. Mobile users on variable connections suffered the most.",
      '',
      "We rebuilt the frontend to only ship code where it was actually needed. The result:",
      "- Page load time dropped from 3.2 seconds to under 1 second",
      "- 70% less code for users to download",
      "- Hosting moved to Cloudflare's global edge network — faster and built to scale",
      '',
      `Read the full story: ${config.siteUrl}/work/chama-saas-migration`,
      '',
      "If you run a SaaS product, speed and reliability directly impact growth. Modern web technology makes both possible.",
      '',
      '— Upstate Web Co.',
      '',
      `Unsubscribe: ${config.unsubscribeUrl}`,
    ].join('\n')
  }

  // Default: Shira (professional services / general)
  return [
    "We recently worked with a business in the Upstate that had no website — just a social media page.",
    '',
    "They were losing customers to competitors who showed up on Google. People searching for their services couldn't find them.",
    '',
    "We built them a custom website optimized for local search. Within 6 weeks:",
    "- They appeared on the first page of Google for their target keywords",
    "- They started getting 3-5 qualified leads per week through their contact form",
    "- The site loads in under 2 seconds on any device",
    '',
    `Read the full story: ${config.siteUrl}/work/shira-brand-website`,
    '',
    "Every business is different, but the fundamentals are the same: show up on Google, look professional, make it easy to get in touch.",
    '',
    '— Upstate Web Co.',
    '',
    `Unsubscribe: ${config.unsubscribeUrl}`,
  ].join('\n')
}

export async function sendNurtureEmail(config: NurtureEmailConfig, step: number): Promise<boolean> {
  const resend = new Resend(config.apiKey)

  const bodies: Record<number, string> = {
    1: [
      "Quick question: when was the last time you checked how your website looks on a phone?",
      '',
      "Here's why it matters:",
      "- 60% of Google searches happen on mobile",
      "- Slow sites lose 53% of visitors in under 3 seconds",
      "- Google ranks mobile-friendly sites higher",
      '',
      "If your site takes more than 2 seconds to load, or if the text is hard to read on a phone, you're losing customers to competitors who got this right.",
      '',
      `We wrote a guide on the 5 signs your website needs attention: ${config.siteUrl}/blog/how-much-does-a-website-cost-south-carolina`,
      '',
      '— Upstate Web Co.',
      '',
      `Unsubscribe: ${config.unsubscribeUrl}`,
    ].join('\n'),

    2: [
      "Here's one free thing you can do today that most small businesses in SC skip:",
      '',
      "Claim and complete your Google Business Profile.",
      '',
      "It takes about 15 minutes and it's completely free. Here's what to do:",
      "1. Go to business.google.com and claim your listing",
      "2. Fill in EVERY field — hours, services, photos, description",
      "3. Add your website URL",
      "4. Ask 2-3 happy customers to leave a review",
      '',
      "Businesses with complete GBP profiles get 7x more clicks than incomplete ones. That's free traffic from people actively searching for what you offer.",
      '',
      `Want a more complete checklist? Check out our free Website Audit Checklist: ${config.siteUrl}/checklist`,
      '',
      '— Upstate Web Co.',
      '',
      `Unsubscribe: ${config.unsubscribeUrl}`,
    ].join('\n'),

    3: getNurtureStep3Body(config),

    4: [
      "Over the past week, we've shared tips on mobile speed, Google Business Profile, and a real case study from the Upstate.",
      '',
      "If any of that resonated — if you know your website could be working harder for your business — we'd love to chat.",
      '',
      "No sales pitch. Just a quick conversation about where you are and what might help:",
      '',
      "Common questions we answer on these calls:",
      "- How much would a new site actually cost?",
      "- What's the realistic timeline?",
      "- Should I fix my current site or start fresh?",
      "- What would make the biggest difference for my specific business?",
      '',
      `Start here (takes 3 minutes): ${config.siteUrl}/get-started`,
      `Or just reply to this email — I read every one.`,
      '',
      '— Joshua',
      'Upstate Web Co.',
      'Greenville, SC',
      '',
      `Unsubscribe: ${config.unsubscribeUrl}`,
    ].join('\n'),

    5: [
      "The #1 question we get: how much does a website cost?",
      '',
      "Here's the honest breakdown:",
      '',
      "Starter Presence ($750-$1,200):",
      "- 1 page, contact form, Google Business Profile setup",
      "- Perfect for businesses that just need to be found online",
      "- Live in 1-2 weeks",
      '',
      "Business Website ($1,800-$3,500):",
      "- 5-7 pages, blog/CMS, Stripe payments, SEO foundation",
      "- For businesses ready to generate leads and sell online",
      "- Live in 2-3 weeks",
      '',
      "Online Store ($3,500-$7,500):",
      "- Product catalog, shopping cart, checkout, order management",
      "- For businesses selling products online",
      "- Live in 3-5 weeks",
      '',
      "No hidden fees. No monthly platform charges. You own everything.",
      '',
      `Full pricing breakdown: ${config.siteUrl}/blog/how-much-does-a-website-cost-south-carolina`,
      '',
      '— Upstate Web Co.',
      '',
      `Unsubscribe: ${config.unsubscribeUrl}`,
    ].join('\n'),

    6: [
      "We could tell you how great we are. Instead, here's what our clients say:",
      '',
      '"The site feels completely different now. Pages load instantly and our members actually use the mobile app without complaining about speed." — MyChama',
      '',
      "\"Everything a chef needs to run their business is in one place. The AI assistants on the public pages are the differentiator.\" — Chef's Delight",
      '',
      "What these projects have in common: a clear goal, a realistic timeline, and a build process that delivered working results at every milestone.",
      '',
      `See all our work: ${config.siteUrl}/work`,
      '',
      "If your business needs the same kind of clarity, we're here.",
      '',
      '— Upstate Web Co.',
      '',
      `Unsubscribe: ${config.unsubscribeUrl}`,
    ].join('\n'),

    7: [
      "It's been a few weeks since you signed up, and we haven't heard from you.",
      '',
      "That's totally fine — not everyone is ready right away.",
      '',
      "But if your website is still on your mind, here are two easy next steps:",
      '',
      `1. Fill out our quick project form (3 minutes): ${config.siteUrl}/get-started`,
      "   We'll review it and send you a recommendation + fixed-price quote within a day.",
      '',
      "2. Just reply to this email with your question.",
      "   Even a one-liner like 'I have a barbershop, what would a site cost?' works.",
      '',
      "Either way, no pressure. We'll be here when you're ready.",
      '',
      '— Joshua',
      'Upstate Web Co.',
      'Greenville, SC',
      '',
      `Unsubscribe: ${config.unsubscribeUrl}`,
    ].join('\n'),
  }

  const stepConfig = NURTURE_STEPS.find(s => s.step === step)
  if (!stepConfig || !bodies[step]) return false

  const { error } = await resend.emails.send({
    from: 'Upstate Web Co. <hello@upstate-web.com>',
    to: config.to,
    subject: stepConfig.subject,
    text: bodies[step],
  })

  if (error) {
    console.error(`[email] Nurture step ${step} failed for ${config.to}:`, error.message)
    return false
  }

  return true
}

// ─── Lead Intake Emails ─────────────────────────────

interface LeadEmailData {
  name: string
  email: string
  business_name: string
  site_type: string
  budget_range: string
  timeline: string
  project_description: string
}

const SITE_TYPE_LABELS: Record<string, string> = {
  starter: 'Starter Presence',
  business: 'Business Website',
  store: 'Online Store',
  unsure: 'Not sure yet',
}

const BUDGET_LABELS: Record<string, string> = {
  under_750: 'Under $750',
  '750_1500': '$750–$1,500',
  '1500_3500': '$1,500–$3,500',
  '3500_plus': '$3,500+',
  unsure: 'Not sure yet',
}

const TIMELINE_LABELS: Record<string, string> = {
  asap: 'As soon as possible',
  '1_2_weeks': '1–2 weeks',
  '1_month': 'About a month',
  '2_3_months': '2–3 months',
  no_rush: 'No rush',
}

export async function sendLeadConfirmationEmail(apiKey: string, data: LeadEmailData) {
  const resend = new Resend(apiKey)

  const siteTypeLabel = SITE_TYPE_LABELS[data.site_type] ?? data.site_type
  const budgetLabel = BUDGET_LABELS[data.budget_range] ?? data.budget_range
  const timelineLabel = TIMELINE_LABELS[data.timeline] ?? data.timeline

  const { error } = await resend.emails.send({
    from: 'Upstate Web Co. <hello@upstate-web.com>',
    to: data.email,
    subject: `We got your project details, ${data.name}`,
    text: [
      `Hi ${data.name},`,
      '',
      `Thanks for telling us about ${data.business_name}. We've received your project details and will review them within one business day.`,
      '',
      "Here's a summary of what you told us:",
      `  Project type: ${siteTypeLabel}`,
      `  Budget range: ${budgetLabel}`,
      `  Timeline: ${timelineLabel}`,
      `  Your goal: ${data.project_description.slice(0, 200)}${data.project_description.length > 200 ? '...' : ''}`,
      '',
      "Here's what happens next:",
      '1. We review your project scope and timeline',
      '2. We put together a recommendation and fixed-price quote',
      "3. We send it your way — no obligation, no pressure",
      '',
      'If you have any questions in the meantime, just reply to this email.',
      '',
      '— Joshua',
      'Upstate Web Co.',
      'Greenville, SC',
    ].join('\n'),
  })

  if (error) {
    console.error('[email] Lead confirmation email failed:', error.message)
  }
}

export async function sendLeadNotificationEmail(apiKey: string, data: LeadEmailData & { id: string }) {
  const resend = new Resend(apiKey)

  const { error } = await resend.emails.send({
    from: 'Upstate Web Co. <contact@upstate-web.com>',
    to: 'hello@upstate-web.com',
    replyTo: data.email,
    subject: `New lead: ${data.business_name} (${SITE_TYPE_LABELS[data.site_type] ?? data.site_type})`,
    text: [
      'New lead from the website:',
      '',
      `Name: ${data.name}`,
      `Email: ${data.email}`,
      `Business: ${data.business_name}`,
      `Site type: ${SITE_TYPE_LABELS[data.site_type] ?? data.site_type}`,
      `Budget: ${BUDGET_LABELS[data.budget_range] ?? data.budget_range}`,
      `Timeline: ${TIMELINE_LABELS[data.timeline] ?? data.timeline}`,
      '',
      'Project description:',
      data.project_description,
      '',
      `View in admin: https://agency.upstate-web.com/leads/${data.id}`,
    ].join('\n'),
  })

  if (error) {
    console.error('[email] Lead notification email failed:', error.message)
  }
}

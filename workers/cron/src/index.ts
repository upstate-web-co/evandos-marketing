// Standalone CF Worker with cron triggers
// Calls the Pages API endpoints to process scheduled posts and analytics

export interface Env {
  PAGES_URL: string
  CRON_SECRET: string
  RESEND_API_KEY?: string
  ALERT_EMAIL?: string
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    // Determine which cron fired
    const isSocialCron = event.cron === '*/5 * * * *'
    const isAnalyticsCron = event.cron === '0 2 * * *'
    const isNurtureCron = event.cron === '0 9 * * *' // daily at 9am UTC

    if (isSocialCron) {
      ctx.waitUntil(processSocialPosts(env))
    }

    if (isAnalyticsCron) {
      ctx.waitUntil(processAnalyticsSnapshot(env))
    }

    if (isNurtureCron) {
      ctx.waitUntil(processNurtureEmails(env))
    }
  },
}

async function processSocialPosts(env: Env) {
  try {
    const res = await fetch(`${env.PAGES_URL}/api/social/cron`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': env.CRON_SECRET,
      },
    })

    const data = await res.json() as { processed?: number; errors?: string[] }

    // Send alert if there were failures
    if (data.errors && data.errors.length > 0 && env.RESEND_API_KEY && env.ALERT_EMAIL) {
      await sendFailureAlert(env, data.errors)
    }

    console.log(`[cron] Social posts: ${data.processed ?? 0} processed, ${data.errors?.length ?? 0} errors`)
  } catch (err) {
    console.error('[cron] Social post processing failed:', err)

    if (env.RESEND_API_KEY && env.ALERT_EMAIL) {
      await sendFailureAlert(env, [`Cron processing failed: ${err}`])
    }
  }
}

async function processAnalyticsSnapshot(env: Env) {
  // Placeholder: will call an analytics snapshot endpoint when available
  console.log('[cron] Analytics snapshot triggered — not yet implemented')
}

async function processNurtureEmails(env: Env) {
  try {
    const res = await fetch(`${env.PAGES_URL}/api/nurture-send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': env.CRON_SECRET,
      },
    })

    const data = await res.json() as { sent?: number; failed?: number; checked?: number }
    console.log(`[cron] Nurture emails: ${data.sent ?? 0} sent, ${data.failed ?? 0} failed, ${data.checked ?? 0} checked`)

    if (data.failed && data.failed > 0 && env.RESEND_API_KEY && env.ALERT_EMAIL) {
      await sendFailureAlert(env, [`${data.failed} nurture email(s) failed to send`])
    }
  } catch (err) {
    console.error('[cron] Nurture email processing failed:', err)
  }
}

async function sendFailureAlert(env: Env, errors: string[]) {
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'UWC Bot <noreply@upstate-web.com>',
        to: env.ALERT_EMAIL,
        subject: `[UWC] Social posting failed (${errors.length} error${errors.length > 1 ? 's' : ''})`,
        text: `The following social posts failed:\n\n${errors.join('\n\n')}\n\nCheck the admin dashboard for details.`,
      }),
    })
  } catch (err) {
    console.error('[cron] Failed to send alert email:', err)
  }
}

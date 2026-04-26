# /schedule-social — Schedule a Social Post

When the user runs `/schedule-social`:

1. Ask for: content text, platforms (multi-select: facebook/instagram/linkedin/gbp), scheduled datetime
2. Ask: does this post have an image? (instagram requires one)
3. Validate datetime is in the future
4. Generate the D1 INSERT statements (one row per platform):
```typescript
const draftId = crypto.randomUUID()
// First create the draft
await DB.prepare(
  'INSERT INTO content_drafts (id, body, platforms_json) VALUES (?, ?, ?)'
).bind(draftId, content, JSON.stringify(platforms)).run()

// Then create one social_posts row per platform
for (const platform of platforms) {
  await DB.prepare(
    'INSERT INTO social_posts (content_draft_id, platform, content, scheduled_at) VALUES (?, ?, ?, ?)'
  ).bind(draftId, platform, content, scheduledAt).run()
}
```
5. Confirm: "Post will go live at [time] SC time via the 5-minute cron"

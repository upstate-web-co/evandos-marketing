// Centralized model version — update here when upgrading Claude.
// Must match uwc-agency-admin/src/lib/ai.ts and uwc-base-template/src/lib/ai.ts.
export const AI_MODEL = 'claude-sonnet-4-6'

export async function callClaude(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens = 1024
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!response.ok) {
    const errText = await response.text()
    console.error('[ai] Anthropic error:', errText)
    throw new Error('AI service error')
  }

  const data = await response.json()
  return data.content?.[0]?.text ?? ''
}

export function getApiKey(env: Record<string, any>): string | null {
  return env.ANTHROPIC_API_KEY ?? null
}

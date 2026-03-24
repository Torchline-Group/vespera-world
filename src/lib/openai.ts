type ChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>
}

export async function callOpenAIChat(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
  const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`LLM request failed: ${res.status} ${text}`)
  }

  const data = (await res.json()) as ChatCompletionResponse
  return data.choices?.[0]?.message?.content?.trim() ?? null
}

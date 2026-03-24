import { callOpenAIChat } from '@/lib/openai'
import { NextRequest, NextResponse } from 'next/server'

type TranslatePayload = {
  text?: string
  source?: 'en' | 'es' | 'auto'
  target?: 'en' | 'es'
}

export async function POST(req: NextRequest) {
  let body: TranslatePayload
  try {
    body = (await req.json()) as TranslatePayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const text = (body.text ?? '').trim()
  if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 })

  const source = body.source === 'en' || body.source === 'es' ? body.source : 'auto'
  const target = body.target === 'es' ? 'es' : 'en'

  try {
    const translated = await callOpenAIChat([
      {
        role: 'system',
        content:
          'You are a translation engine. Return only the translated text without explanations or quotes.',
      },
      {
        role: 'user',
        content: `Translate this text from ${source} to ${target}:\n\n${text}`,
      },
    ])

    if (!translated) {
      return NextResponse.json({ ok: true, translated: text, provider: 'fallback' })
    }

    return NextResponse.json({ ok: true, translated, provider: 'openai' })
  } catch (e) {
    return NextResponse.json(
      {
        ok: true,
        translated: text,
        provider: 'fallback',
        warning: e instanceof Error ? e.message : 'translation provider unavailable',
      },
      { status: 200 },
    )
  }
}

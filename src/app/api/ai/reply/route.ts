import { callOpenAIChat } from '@/lib/openai'
import { buildVesperaSystemPrompt } from '@/lib/vespera-context'
import { NextRequest, NextResponse } from 'next/server'

type AiPayload = {
  question?: string
  language?: 'en' | 'es'
  leadContext?: string
}

function fallbackAnswer(question: string, language: 'en' | 'es') {
  if (language === 'es') {
    return `Entendido. Aqui tienes una respuesta preliminar basada en el contexto de Vespera:\n\n${question}\n\nVespera integra CRM, mensajeria multicanal y operaciones para creadores/agencias. Si quieres una respuesta mas precisa, agrega datos del cliente (segmento, estado del lead, canal, y objetivo comercial).`
  }
  return `Understood. Here is a preliminary answer based on Vespera context:\n\n${question}\n\nVespera unifies CRM, omnichannel messaging, and creator operations for agencies/creators. For a sharper answer, include customer details (segment, lead stage, channel, and commercial goal).`
}

export async function POST(req: NextRequest) {
  let body: AiPayload
  try {
    body = (await req.json()) as AiPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const question = (body.question ?? '').trim()
  if (!question) {
    return NextResponse.json({ error: 'question is required' }, { status: 400 })
  }

  const language = body.language === 'es' ? 'es' : 'en'
  const system = buildVesperaSystemPrompt(language)
  const userPrompt = `${question}\n\nAdditional CRM context:\n${(body.leadContext ?? 'N/A').trim()}`

  try {
    const answer =
      (await callOpenAIChat([
        { role: 'system', content: system },
        { role: 'user', content: userPrompt },
      ])) ?? fallbackAnswer(question, language)

    return NextResponse.json({ ok: true, answer, provider: answer ? 'llm_or_fallback' : 'fallback' })
  } catch (e) {
    return NextResponse.json(
      {
        ok: true,
        answer: fallbackAnswer(question, language),
        provider: 'fallback',
        warning: e instanceof Error ? e.message : 'AI provider unavailable',
      },
      { status: 200 },
    )
  }
}

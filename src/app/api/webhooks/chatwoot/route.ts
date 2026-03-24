import { ingestInboxMessage } from '@/lib/inbox-ingest'
import { createAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

type ChatwootPayload = {
  event?: string
  content?: string
  message_type?: 'incoming' | 'outgoing' | string
  conversation?: {
    id?: number | string
    meta?: {
      sender?: {
        name?: string
        email?: string
        phone_number?: string
      }
    }
  }
  id?: number | string
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized webhook' }, { status: 401 })
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-chatwoot-token')?.trim()
  const key = req.headers.get('x-vespera-api-key')?.trim()
  const configuredToken = process.env.CHATWOOT_WEBHOOK_TOKEN?.trim()
  const configuredKey = process.env.INBOX_API_KEY?.trim()

  const authorized =
    (configuredToken && token === configuredToken) || (configuredKey && key && key === configuredKey)
  if (!authorized) return unauthorized()

  let body: ChatwootPayload
  try {
    body = (await req.json()) as ChatwootPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const content = (body.content ?? '').trim()
  if (!content) return NextResponse.json({ ok: true, ignored: 'empty-content' })

  const senderUserId =
    process.env.DEFAULT_AGENT_USER_ID?.trim() || process.env.DEFAULT_ADMIN_USER_ID?.trim()
  if (!senderUserId) {
    return NextResponse.json(
      { error: 'Set DEFAULT_AGENT_USER_ID or DEFAULT_ADMIN_USER_ID for webhook ingestion.' },
      { status: 400 },
    )
  }

  const conversationId = body.conversation?.id ?? body.id
  const contact = body.conversation?.meta?.sender
  const roomName =
    contact?.name?.trim() ||
    contact?.email?.trim() ||
    contact?.phone_number?.trim() ||
    `Chatwoot conversation ${conversationId ?? 'unknown'}`

  const providerRoomId = conversationId ? String(conversationId) : undefined
  const externalContact = contact?.phone_number || contact?.email || undefined
  const direction = body.message_type === 'outgoing' ? 'outbound' : 'inbound'

  let supabase
  try {
    supabase = createAdminClient()
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : 'Supabase admin is not configured. Set SUPABASE_SERVICE_ROLE_KEY.',
      },
      { status: 500 },
    )
  }
  try {
    const result = await ingestInboxMessage(supabase, {
      roomName,
      channel: 'whatsapp',
      provider: 'chatwoot',
      providerRoomId,
      externalContact,
      content,
      direction,
      senderUserId,
      originalLanguage: 'auto',
      metadata: {
        source: 'chatwoot-webhook',
        event: body.event ?? 'message_created',
        rawMessageId: body.id ?? null,
      },
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to process Chatwoot webhook' },
      { status: 500 },
    )
  }
}

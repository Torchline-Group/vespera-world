import { ingestInboxMessage } from '@/lib/inbox-ingest'
import { createAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

type HelpwisePayload = {
  event?: string
  data?: {
    conversation?: {
      id?: number | string
      subject?: string
      channel?: string
      customer?: {
        name?: string
        email?: string
        phone?: string
      }
    }
    message?: {
      id?: number | string
      direction?: 'incoming' | 'outgoing' | string
      text?: string
      body?: string
      content?: string
    }
  }
}

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized webhook' }, { status: 401 })
}

function mapChannel(channel?: string) {
  const value = (channel ?? '').toLowerCase()
  if (value.includes('whatsapp')) return 'whatsapp' as const
  if (value.includes('telegram')) return 'telegram' as const
  if (value.includes('email')) return 'email' as const
  return 'internal' as const
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('x-helpwise-token')?.trim()
  const key = req.headers.get('x-vespera-api-key')?.trim()
  const configuredToken = process.env.HELPWISE_WEBHOOK_TOKEN?.trim()
  const configuredKey = process.env.INBOX_API_KEY?.trim()

  const authorized =
    (configuredToken && token === configuredToken) || (configuredKey && key && key === configuredKey)
  if (!authorized) return unauthorized()

  let body: HelpwisePayload
  try {
    body = (await req.json()) as HelpwisePayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const message = body.data?.message
  const conversation = body.data?.conversation
  const content = (message?.text ?? message?.body ?? message?.content ?? '').trim()
  if (!content) return NextResponse.json({ ok: true, ignored: 'empty-content' })

  const senderUserId =
    process.env.DEFAULT_AGENT_USER_ID?.trim() || process.env.DEFAULT_ADMIN_USER_ID?.trim()
  if (!senderUserId) {
    return NextResponse.json(
      { error: 'Set DEFAULT_AGENT_USER_ID or DEFAULT_ADMIN_USER_ID for webhook ingestion.' },
      { status: 400 },
    )
  }

  const roomName =
    conversation?.subject?.trim() ||
    conversation?.customer?.name?.trim() ||
    conversation?.customer?.email?.trim() ||
    `Helpwise conversation ${conversation?.id ?? 'unknown'}`

  const providerRoomId = conversation?.id ? String(conversation.id) : undefined
  const externalContact = conversation?.customer?.email || conversation?.customer?.phone || undefined
  const direction = message?.direction === 'outgoing' ? 'outbound' : 'inbound'

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
      channel: mapChannel(conversation?.channel),
      provider: 'helpwise',
      providerRoomId,
      externalContact,
      content,
      direction,
      senderUserId,
      originalLanguage: 'auto',
      metadata: {
        source: 'helpwise-webhook',
        event: body.event ?? 'conversation.message_created',
        rawMessageId: message?.id ?? null,
      },
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to process Helpwise webhook' },
      { status: 500 },
    )
  }
}

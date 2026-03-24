import { createAdminClient } from '@/lib/supabase-admin'
import { ingestInboxMessage } from '@/lib/inbox-ingest'
import type { ChannelType, ProviderType } from '@/lib/types'
import { NextRequest, NextResponse } from 'next/server'

type Direction = 'inbound' | 'outbound' | 'system'

type InboundMessagePayload = {
  roomId?: number
  roomName?: string
  leadId?: number
  channel?: ChannelType
  provider?: ProviderType
  providerRoomId?: string
  externalContact?: string
  content?: string
  direction?: Direction
  senderUserId?: string
  originalLanguage?: string
  translatedLanguage?: string
  translatedContent?: string
  metadata?: Record<string, unknown>
}

const ALLOWED_CHANNELS: ChannelType[] = ['internal', 'email', 'whatsapp', 'telegram', 'call']
const ALLOWED_PROVIDERS: ProviderType[] = [
  'native',
  'chatwoot',
  'helpwise',
  'whatsapp',
  'telegram',
  'email',
  'voice',
]

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 })
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-vespera-api-key')?.trim()
  const configuredKey = process.env.INBOX_API_KEY?.trim()
  if (!configuredKey || !apiKey || apiKey !== configuredKey) {
    return unauthorized()
  }

  let body: InboundMessagePayload
  try {
    body = (await req.json()) as InboundMessagePayload
  } catch {
    return badRequest('Invalid JSON body')
  }

  const content = (body.content ?? '').trim()
  if (!content) return badRequest('content is required')

  const channel: ChannelType = ALLOWED_CHANNELS.includes(body.channel as ChannelType)
    ? (body.channel as ChannelType)
    : 'internal'
  const provider: ProviderType = ALLOWED_PROVIDERS.includes(body.provider as ProviderType)
    ? (body.provider as ProviderType)
    : 'native'
  const direction: Direction =
    body.direction === 'inbound' || body.direction === 'outbound' || body.direction === 'system'
      ? body.direction
      : 'inbound'

  const senderUserId =
    body.senderUserId?.trim() ||
    process.env.DEFAULT_AGENT_USER_ID?.trim() ||
    process.env.DEFAULT_ADMIN_USER_ID?.trim()

  if (!senderUserId) {
    return badRequest('senderUserId is required (or set DEFAULT_AGENT_USER_ID in env)')
  }

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
      roomId: body.roomId,
      roomName: body.roomName,
      leadId: body.leadId,
      channel,
      provider,
      providerRoomId: body.providerRoomId,
      externalContact: body.externalContact,
      content,
      direction,
      senderUserId,
      originalLanguage: body.originalLanguage,
      translatedLanguage: body.translatedLanguage,
      translatedContent: body.translatedContent,
      metadata: body.metadata,
    })
    return NextResponse.json({
      ok: true,
      roomId: result.roomId,
      messageId: result.messageId,
      createdAt: result.createdAt,
      assignedTo: result.assignedTo ?? null,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Could not create message' },
      { status: 500 },
    )
  }
}

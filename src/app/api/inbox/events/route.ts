import { createAdminClient } from '@/lib/supabase-admin'
import type { ChannelType } from '@/lib/types'
import { NextRequest, NextResponse } from 'next/server'

type EventPayload = {
  leadId?: number
  roomId?: number
  channel?: ChannelType
  direction?: 'inbound' | 'outbound'
  subject?: string
  body?: string
  status?: string
  externalId?: string
  createdBy?: string
}

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

  let body: EventPayload
  try {
    body = (await req.json()) as EventPayload
  } catch {
    return badRequest('Invalid JSON body')
  }

  const content = (body.body ?? '').trim()
  if (!content) return badRequest('body is required')

  const channel: ChannelType =
    body.channel && ['internal', 'email', 'whatsapp', 'telegram', 'call'].includes(body.channel)
      ? body.channel
      : 'internal'
  const direction = body.direction === 'inbound' ? 'inbound' : 'outbound'

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

  const { data, error } = await supabase
    .from('communication_events')
    .insert({
      lead_id: body.leadId ?? null,
      room_id: body.roomId ?? null,
      channel,
      direction,
      subject: body.subject ?? null,
      body: content,
      status: body.status?.trim() || 'logged',
      external_id: body.externalId ?? null,
      created_by: body.createdBy ?? null,
    })
    .select('id, created_at')
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? 'Could not create communication event' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    eventId: (data as { id: number }).id,
    createdAt: (data as { created_at: string }).created_at,
  })
}

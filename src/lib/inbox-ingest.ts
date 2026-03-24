import type { ChannelType, ProviderType } from '@/lib/types'
import type { SupabaseClient } from '@supabase/supabase-js'

type Direction = 'inbound' | 'outbound' | 'system'

export type IngestMessageInput = {
  roomId?: number
  roomName?: string
  leadId?: number
  channel: ChannelType
  provider: ProviderType
  providerRoomId?: string
  externalContact?: string
  content: string
  direction: Direction
  senderUserId: string
  originalLanguage?: string
  translatedLanguage?: string
  translatedContent?: string
  metadata?: Record<string, unknown>
}

type BasicRow = { id: number }

function nowIso() {
  return new Date().toISOString()
}

export async function ingestInboxMessage(
  supabase: SupabaseClient,
  input: IngestMessageInput,
): Promise<{ roomId: number; messageId: number; createdAt: string; assignedTo?: string }> {
  const roomId = await ensureRoom(supabase, input)
  await ensureParticipant(supabase, roomId, input.senderUserId)

  const assignedTo = await runAssignmentAndSlaBeforeInsert(supabase, roomId, input)

  const { data: message, error: messageError } = await supabase
    .from('chat_messages')
    .insert({
      room_id: roomId,
      sender_id: input.senderUserId,
      content: input.content,
      direction: input.direction,
      original_language: input.originalLanguage ?? null,
      translated_language: input.translatedLanguage ?? null,
      translated_content: input.translatedContent ?? null,
      metadata: input.metadata ?? {},
    })
    .select('id, created_at')
    .single()

  if (messageError || !message) {
    throw new Error(messageError?.message ?? 'Could not create message')
  }

  if (input.direction === 'inbound' || input.direction === 'outbound') {
    await supabase.from('communication_events').insert({
      room_id: roomId,
      lead_id: input.leadId ?? null,
      channel: input.channel,
      direction: input.direction,
      subject: null,
      body: input.content,
      status: 'logged',
      external_id: input.providerRoomId ?? null,
      created_by: input.senderUserId,
    })
  }

  await runSlaAfterInsert(supabase, roomId, input)

  return {
    roomId,
    messageId: (message as { id: number }).id,
    createdAt: (message as { created_at: string }).created_at,
    assignedTo,
  }
}

async function ensureRoom(supabase: SupabaseClient, input: IngestMessageInput): Promise<number> {
  if (input.roomId) return input.roomId

  if (input.providerRoomId) {
    const { data: existingByProvider } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('provider', input.provider)
      .eq('provider_room_id', input.providerRoomId)
      .maybeSingle()

    if (existingByProvider?.id) return existingByProvider.id as number
  }

  if (input.externalContact) {
    const { data: existingByContact } = await supabase
      .from('chat_rooms')
      .select('id')
      .eq('provider', input.provider)
      .eq('external_contact', input.externalContact)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingByContact?.id) return existingByContact.id as number
  }

  const roomName = input.roomName?.trim() || `${input.channel} conversation`
  const { data: room, error: roomError } = await supabase
    .from('chat_rooms')
    .insert({
      name: roomName,
      lead_id: input.leadId ?? null,
      channel: input.channel,
      provider: input.provider,
      provider_room_id: input.providerRoomId ?? null,
      external_contact: input.externalContact ?? null,
      status: 'open',
      priority: 'normal',
    })
    .select('id')
    .single()

  if (roomError || !room) {
    throw new Error(roomError?.message ?? 'Could not create conversation room')
  }
  return (room as BasicRow).id
}

async function ensureParticipant(supabase: SupabaseClient, roomId: number, userId: string) {
  const { error } = await supabase
    .from('chat_participants')
    .upsert({ room_id: roomId, user_id: userId }, { onConflict: 'room_id,user_id' })
  if (error) throw new Error(`Could not attach participant: ${error.message}`)
}

async function runAssignmentAndSlaBeforeInsert(
  supabase: SupabaseClient,
  roomId: number,
  input: IngestMessageInput,
) {
  const { data: room, error: roomError } = await supabase
    .from('chat_rooms')
    .select('assigned_to, sla_first_response_due_at, first_response_at, status')
    .eq('id', roomId)
    .single()

  if (roomError || !room) throw new Error(roomError?.message ?? 'Could not load room')

  let assignedTo = room.assigned_to as string | null

  if (input.direction === 'inbound') {
    if (!assignedTo) {
      assignedTo = await autoAssignAgent(supabase)
      if (assignedTo) {
        await ensureParticipant(supabase, roomId, assignedTo)
      }
    }

    const updates: Record<string, unknown> = {
      last_inbound_at: nowIso(),
      status: room.status === 'closed' ? 'open' : room.status,
    }

    if (!room.sla_first_response_due_at && !room.first_response_at) {
      const due = new Date(Date.now() + 15 * 60 * 1000).toISOString()
      updates.sla_first_response_due_at = due
      updates.sla_status = 'active'
    }

    if (assignedTo) {
      updates.assigned_to = assignedTo
    }

    const { error: updateError } = await supabase.from('chat_rooms').update(updates).eq('id', roomId)
    if (updateError) throw new Error(updateError.message)
  }

  return assignedTo ?? undefined
}

async function runSlaAfterInsert(supabase: SupabaseClient, roomId: number, input: IngestMessageInput) {
  if (input.direction !== 'outbound') return

  const { data: room, error: roomError } = await supabase
    .from('chat_rooms')
    .select('first_response_at, sla_first_response_due_at, sla_status')
    .eq('id', roomId)
    .single()

  if (roomError || !room) return
  if (room.first_response_at) return
  if (!room.sla_first_response_due_at) return

  const now = new Date()
  const due = new Date(room.sla_first_response_due_at as string)
  const slaStatus = now <= due ? 'met' : 'breached'

  await supabase
    .from('chat_rooms')
    .update({
      first_response_at: now.toISOString(),
      sla_status: slaStatus,
    })
    .eq('id', roomId)
}

async function autoAssignAgent(supabase: SupabaseClient): Promise<string | null> {
  const { data: candidates, error: cError } = await supabase
    .from('profiles')
    .select('id, role')
    .in('role', ['sales', 'support', 'admin'])

  if (cError || !candidates || candidates.length === 0) return null

  const ids = candidates.map((c) => c.id as string)
  const { data: openRooms, error: rError } = await supabase
    .from('chat_rooms')
    .select('assigned_to')
    .in('assigned_to', ids)
    .in('status', ['open', 'pending'])

  if (rError) return ids[0] ?? null

  const loadMap = new Map<string, number>()
  for (const id of ids) loadMap.set(id, 0)
  for (const row of openRooms ?? []) {
    const assigned = row.assigned_to as string | null
    if (!assigned) continue
    loadMap.set(assigned, (loadMap.get(assigned) ?? 0) + 1)
  }

  let bestId: string | null = null
  let minLoad = Number.MAX_SAFE_INTEGER
  for (const id of ids) {
    const load = loadMap.get(id) ?? 0
    if (load < minLoad) {
      minLoad = load
      bestId = id
    }
  }
  return bestId
}

import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

type PortalProfile = {
  id: string
  full_name: string
  role: string
  avatar_url: string | null
  created_at?: string | null
}

type PortalForm = {
  id: number
  title: string
  description: string | null
  status: string
  fields_json?: string
  updated_at?: string | null
}

type PortalSubmission = {
  id: number
  form_id: number
  submitted_by: string | null
  created_at: string
  payload_json: string
}

type SignedDoc = {
  id: number
  title: string
  signer_name: string
  signed_at: string
}

type ChatRoomSnapshot = {
  id: number
  name: string | null
  channel: string | null
  last_inbound_at: string | null
  first_response_at: string | null
  sla_status: string | null
  assigned_to: string | null
}

type CommunicationEvent = {
  id: number
  room_id: number | null
  lead_id: number | null
  channel: string
  direction: string
  subject: string | null
  body: string | null
  created_at: string
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [{ data: profile, error: profileErr }, { data: forms, error: formsErr }, { data: submissions, error: subsErr }] =
    await Promise.all([
      supabase.from('profiles').select('id,full_name,role,avatar_url,created_at').eq('id', user.id).single<PortalProfile>(),
      supabase
        .from('portal_forms')
        .select('id,title,description,status,fields_json,updated_at')
        .eq('created_by', user.id)
        .order('updated_at', { ascending: false }),
      supabase
        .from('portal_form_submissions')
        .select('id,form_id,submitted_by,created_at,payload_json')
        .eq('submitted_by', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 })
  if (formsErr) return NextResponse.json({ error: formsErr.message }, { status: 500 })
  if (subsErr) return NextResponse.json({ error: subsErr.message }, { status: 500 })

  const [{ data: signedDocs, error: docsErr }, { data: chatRooms, error: roomsErr }] = await Promise.all([
    supabase
      .from('portal_ack_signatures')
      .select('id,title,signer_name,signed_at')
      .eq('created_by', user.id)
      .order('signed_at', { ascending: false })
      .limit(50),
    supabase
      .from('chat_rooms')
      .select('id,name,channel,last_inbound_at,first_response_at,sla_status,assigned_to')
      .order('last_inbound_at', { ascending: false })
      .limit(25),
  ])

  if (docsErr) return NextResponse.json({ error: docsErr.message }, { status: 500 })
  if (roomsErr) return NextResponse.json({ error: roomsErr.message }, { status: 500 })

  const chatRoomsTyped = (chatRooms ?? []) as ChatRoomSnapshot[]
  const roomIds = chatRoomsTyped.map((r) => r.id)
  let commEvents: CommunicationEvent[] = []
  if (roomIds.length > 0) {
    const { data: events, error: eventsErr } = await supabase
      .from('communication_events')
      .select('id,room_id,lead_id,channel,direction,subject,body,created_at')
      .in('room_id', roomIds)
      .order('created_at', { ascending: false })
      .limit(30)
    if (eventsErr) return NextResponse.json({ error: eventsErr.message }, { status: 500 })
    commEvents = (events ?? []) as CommunicationEvent[]
  }

  // Build derived “requests/tasks” status: a form is “submitted” if it has >= 1 submission by this user.
  const submissionByForm = new Map<number, { count: number; lastSubmittedAt?: string }>()
  for (const s of submissions ?? []) {
    const prev = submissionByForm.get(s.form_id) ?? { count: 0 }
    prev.count += 1
    if (!prev.lastSubmittedAt) prev.lastSubmittedAt = s.created_at
    submissionByForm.set(s.form_id, prev)
  }

  const formsTyped = (forms ?? []) as PortalForm[]
  const submissionsTyped = (submissions ?? []) as PortalSubmission[]

  const formsWithProgress = formsTyped.map((f) => {
    const p = submissionByForm.get(f.id)
    return {
      ...f,
      submittedCount: p?.count ?? 0,
      lastSubmittedAt: p?.lastSubmittedAt ?? null,
      statusComputed: (p?.count ?? 0) > 0 ? 'submitted' : 'pending',
    }
  })

  const submissionsOut = submissionsTyped
  return NextResponse.json({
    profile: (profile ?? null) as PortalProfile | null,
    forms: formsWithProgress,
    submissions: submissionsOut,
    signedDocs: (signedDocs ?? []) as SignedDoc[],
    comms: {
      chatRooms: chatRoomsTyped,
      events: commEvents ?? [],
    },
  })
}


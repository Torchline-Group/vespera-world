'use client'

import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase-browser'
import type { CannedResponse, ChannelType, ChatRoom, Profile, ProviderType } from '@/lib/types'
import { useRouter } from 'next/navigation'
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

type ChatParticipantRow = {
  room_id: number
  chat_rooms: ChatRoom | null
}

type ChatMessageRow = {
  id: number
  room_id: number
  sender_id: string
  content: string
  direction: 'inbound' | 'outbound' | 'system'
  created_at: string
  original_language: string | null
  translated_content: string | null
  translated_language: string | null
  profiles: { full_name: string | null } | null
}

type EventRow = {
  id: number
  room_id: number | null
  channel: ChannelType
  direction: 'inbound' | 'outbound'
  subject: string | null
  body: string
  created_at: string
}

const CHANNELS: ChannelType[] = ['internal', 'email', 'whatsapp', 'telegram', 'call']
const PROVIDERS: ProviderType[] = ['native', 'chatwoot', 'helpwise', 'whatsapp', 'telegram', 'email', 'voice']

function IconInboxGold({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--vespera-gold)"
      strokeWidth={1.5}
      width={22}
      height={22}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337L5.05 21l1.395-3.72C5.512 15.042 4 13.574 4 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
      />
    </svg>
  )
}

function IconChatMuted({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      width={48}
      height={48}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337L5.05 21l1.395-3.72C5.512 15.042 4 13.574 4 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
      />
    </svg>
  )
}

function formatMessageTime(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())
}

function normalizeMessageRow(row: {
  id: number
  room_id: number
  sender_id: string
  content: string
  direction: 'inbound' | 'outbound' | 'system'
  created_at: string
  original_language: string | null
  translated_content: string | null
  translated_language: string | null
  profiles: { full_name: string | null } | Array<{ full_name: string | null }> | null
}): ChatMessageRow {
  const p = Array.isArray(row.profiles) ? row.profiles[0] ?? null : row.profiles
  return {
    ...row,
    profiles: p,
  }
}

export default function ChatPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [ready, setReady] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const [rooms, setRooms] = useState<ChatParticipantRow[]>([])
  const [roomsLoading, setRoomsLoading] = useState(true)
  const [roomsError, setRoomsError] = useState<string | null>(null)

  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null)
  const [messages, setMessages] = useState<ChatMessageRow[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesError, setMessagesError] = useState<string | null>(null)
  const [activeChannel, setActiveChannel] = useState<ChannelType | 'all'>('all')

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [translatedById, setTranslatedById] = useState<Record<number, string>>({})
  const [targetLanguage, setTargetLanguage] = useState<'en' | 'es'>('es')
  const [translatingId, setTranslatingId] = useState<number | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [newRoomChannel, setNewRoomChannel] = useState<ChannelType>('internal')
  const [newRoomProvider, setNewRoomProvider] = useState<ProviderType>('native')
  const [newRoomExternalContact, setNewRoomExternalContact] = useState('')
  const [creatingRoom, setCreatingRoom] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const [eventChannel, setEventChannel] = useState<ChannelType>('call')
  const [eventDirection, setEventDirection] = useState<'inbound' | 'outbound'>('outbound')
  const [eventSubject, setEventSubject] = useState('')
  const [eventBody, setEventBody] = useState('')
  const [eventSaving, setEventSaving] = useState(false)

  const [aiQuestion, setAiQuestion] = useState('')
  const [aiLanguage, setAiLanguage] = useState<'en' | 'es'>('es')
  const [aiAnswer, setAiAnswer] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([])
  const [cannedLanguage, setCannedLanguage] = useState<'en' | 'es'>('es')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    const el = messagesContainerRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
    messagesEndRef.current?.scrollIntoView({ block: 'end' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, selectedRoomId, scrollToBottom])

  useEffect(() => {
    let cancelled = false

    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (cancelled) return
      if (!user) {
        router.replace('/login')
        return
      }
      setUserId(user.id)

      const { data: prof, error: pe } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (cancelled) return
      if (pe) {
        setRoomsError(pe.message)
      } else if (prof) {
        setProfile(prof as Profile)
      }
      setReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [router, supabase])

  const loadRooms = useCallback(async () => {
    if (!userId) return
    setRoomsLoading(true)
    setRoomsError(null)
    const { data, error } = await supabase
      .from('chat_participants')
      .select('room_id, chat_rooms(*)')
      .eq('user_id', userId)

    if (error) {
      setRoomsError(error.message)
      setRooms([])
    } else {
      const raw = (data ?? []) as {
        room_id: number
        chat_rooms: ChatRoom | ChatRoom[] | null
      }[]
      const rows: ChatParticipantRow[] = raw.map((r) => {
        const cr = r.chat_rooms
        const room = Array.isArray(cr) ? cr[0] ?? null : cr
        return { room_id: r.room_id, chat_rooms: room }
      })
      setRooms(rows.filter((r) => r.chat_rooms != null))
    }
    setRoomsLoading(false)
  }, [supabase, userId])

  useEffect(() => {
    if (!ready || !userId) return
    loadRooms()
  }, [ready, userId, loadRooms])

  const loadCannedResponses = useCallback(async () => {
    const { data, error } = await supabase
      .from('canned_responses')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      setMessagesError(error.message)
      return
    }
    setCannedResponses((data ?? []) as CannedResponse[])
  }, [supabase])

  useEffect(() => {
    if (!ready) return
    loadCannedResponses()
  }, [ready, loadCannedResponses])

  const loadMessagesAndEvents = useCallback(
    async (roomId: number) => {
      setMessagesLoading(true)
      setMessagesError(null)
      const [{ data: messageData, error: messageError }, { data: eventData, error: eventError }] =
        await Promise.all([
          supabase
            .from('chat_messages')
            .select(
              'id, room_id, sender_id, content, direction, created_at, original_language, translated_content, translated_language, profiles(full_name)',
            )
            .eq('room_id', roomId)
            .order('created_at', { ascending: true })
            .limit(150),
          supabase
            .from('communication_events')
            .select('id, room_id, channel, direction, subject, body, created_at')
            .eq('room_id', roomId)
            .order('created_at', { ascending: false })
            .limit(25),
        ])

      if (messageError || eventError) {
        setMessagesError(messageError?.message ?? eventError?.message ?? 'Could not load conversation data')
        setMessages([])
        setEvents([])
      } else {
        const normalized = ((messageData ?? []) as Array<Parameters<typeof normalizeMessageRow>[0]>).map(
          normalizeMessageRow,
        )
        setMessages(normalized)
        setEvents((eventData ?? []) as EventRow[])
      }
      setMessagesLoading(false)
    },
    [supabase],
  )

  useEffect(() => {
    if (selectedRoomId == null) {
      setMessages([])
      setEvents([])
      return
    }
    loadMessagesAndEvents(selectedRoomId)
  }, [selectedRoomId, loadMessagesAndEvents])

  useEffect(() => {
    if (selectedRoomId == null || !userId) return

    const channel = supabase
      .channel(`room-${selectedRoomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${selectedRoomId}`,
        },
        async (payload) => {
            const row = payload.new as Omit<ChatMessageRow, 'profiles'>

          let fullName: string | null = null
          if (row.sender_id === userId && profile) {
            fullName = profile.full_name
          } else {
            const { data: p } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', row.sender_id)
              .maybeSingle()
            fullName = p?.full_name ?? null
          }

          const enriched: ChatMessageRow = {
            ...row,
            profiles: fullName != null ? { full_name: fullName } : null,
          }

          setMessages((prev) => {
            if (prev.some((m) => m.id === enriched.id)) return prev
            return [...prev, enriched]
          })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedRoomId, supabase, userId, profile])

  async function handleSend(e: FormEvent) {
    e.preventDefault()
    if (!userId || selectedRoomId == null) return
    const text = draft.trim()
    if (!text || sending) return

    setSending(true)
    const { data, error } = await supabase
      .from('chat_messages')
      .insert({
        room_id: selectedRoomId,
        sender_id: userId,
        content: text,
        direction: 'outbound',
      })
      .select(
        'id, room_id, sender_id, content, direction, created_at, original_language, translated_content, translated_language, profiles(full_name)',
      )
      .single()

    if (error) {
      setMessagesError(error.message)
    } else if (data) {
      const msg = normalizeMessageRow(data as Parameters<typeof normalizeMessageRow>[0])
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
      setDraft('')

      // SLA automation for first outbound response sent via UI.
      const { data: roomRow } = await supabase
        .from('chat_rooms')
        .select('first_response_at, sla_first_response_due_at')
        .eq('id', selectedRoomId)
        .single()
      if (roomRow && !roomRow.first_response_at && roomRow.sla_first_response_due_at) {
        const now = new Date()
        const due = new Date(roomRow.sla_first_response_due_at as string)
        const status = now <= due ? 'met' : 'breached'
        await supabase
          .from('chat_rooms')
          .update({
            first_response_at: now.toISOString(),
            sla_status: status,
          })
          .eq('id', selectedRoomId)
        await loadRooms()
      }
    }
    setSending(false)
  }

  async function handleCreateRoom(e: FormEvent) {
    e.preventDefault()
    if (!userId) return
    const name = newRoomName.trim()
    if (!name || creatingRoom) return

    setCreatingRoom(true)
    setCreateError(null)

    const { data: room, error: re } = await supabase
      .from('chat_rooms')
      .insert({
        name,
        channel: newRoomChannel,
        provider: newRoomProvider,
        external_contact: newRoomExternalContact.trim() || null,
        is_private: true,
      })
      .select('id')
      .single()

    if (re || !room) {
      setCreateError(re?.message ?? 'Could not create room')
      setCreatingRoom(false)
      return
    }

    const roomId = (room as { id: number }).id

    const { error: pe } = await supabase.from('chat_participants').insert({
      room_id: roomId,
      user_id: userId,
    })

    if (pe) {
      setCreateError(pe.message)
      setCreatingRoom(false)
      return
    }

    setModalOpen(false)
    setNewRoomName('')
    setNewRoomChannel('internal')
    setNewRoomProvider('native')
    setNewRoomExternalContact('')
    await loadRooms()
    setSelectedRoomId(roomId)
    setCreatingRoom(false)
  }

  async function handleTranslateMessage(messageId: number, content: string) {
    setTranslatingId(messageId)
    try {
      const res = await fetch('/api/inbox/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: content,
          source: 'auto',
          target: targetLanguage,
        }),
      })
      const data = (await res.json()) as { translated?: string }
      setTranslatedById((prev) => ({
        ...prev,
        [messageId]: data.translated ?? content,
      }))
    } finally {
      setTranslatingId(null)
    }
  }

  async function handleLogEvent(e: FormEvent) {
    e.preventDefault()
    if (!selectedRoomId || !eventBody.trim() || !userId) return
    setEventSaving(true)
    const { error } = await supabase.from('communication_events').insert({
      room_id: selectedRoomId,
      channel: eventChannel,
      direction: eventDirection,
      subject: eventSubject.trim() || null,
      body: eventBody.trim(),
      created_by: userId,
    })
    setEventSaving(false)
    if (error) {
      setMessagesError(error.message)
      return
    }
    setEventSubject('')
    setEventBody('')
    await loadMessagesAndEvents(selectedRoomId)
  }

  async function handleAskAi(e: FormEvent) {
    e.preventDefault()
    const question = aiQuestion.trim()
    if (!question) return

    setAiLoading(true)
    try {
      const selectedRoom = rooms.find((r) => r.chat_rooms?.id === selectedRoomId)?.chat_rooms
      const leadContext = selectedRoom
        ? `room=${selectedRoom.name}; channel=${selectedRoom.channel}; provider=${selectedRoom.provider}`
        : 'room not selected'

      const res = await fetch('/api/ai/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          language: aiLanguage,
          leadContext,
        }),
      })
      const data = (await res.json()) as { answer?: string }
      setAiAnswer(data.answer ?? '')
    } finally {
      setAiLoading(false)
    }
  }

  function applyCannedResponse(idRaw: string) {
    const id = Number(idRaw)
    if (!id) return
    const row = cannedResponses.find((r) => r.id === id)
    if (!row) return
    setDraft((prev) => (prev.trim() ? `${prev}\n\n${row.body}` : row.body))
  }

  if (!ready || !profile || !userId) {
    return (
      <div className="layout">
        <div className="main-content main-content--fill">
          <div className="page-body">
            <p className="chat-list-hint">{roomsError ?? 'Loading…'}</p>
          </div>
        </div>
      </div>
    )
  }

  const selectedRoom = rooms.find((r) => r.chat_rooms?.id === selectedRoomId)?.chat_rooms ?? null
  const visibleRooms =
    activeChannel === 'all'
      ? rooms
      : rooms.filter((r) => r.chat_rooms?.channel === activeChannel)

  return (
    <div className="layout">
      <Sidebar
        user={{
          id: profile.id,
          full_name: profile.full_name,
          role: profile.role,
        }}
        currentPath="/chat"
      />
      <div className="main-content main-content--fill">
        <div className="chat-page-row">
          <aside className="chat-sidebar">
            <div className="chat-sidebar-header">
              <h2 className="chat-sidebar-title">Omnichannel Inbox</h2>
              <button
                type="button"
                className="btn-gold btn-sm"
                aria-label="Create new room"
                onClick={() => {
                  setCreateError(null)
                  setModalOpen(true)
                }}
              >
                +
              </button>
            </div>
            <div className="channel-filter-row">
              <button
                type="button"
                className={`channel-pill${activeChannel === 'all' ? ' active' : ''}`}
                onClick={() => setActiveChannel('all')}
              >
                All
              </button>
              {CHANNELS.map((channel) => (
                <button
                  key={channel}
                  type="button"
                  className={`channel-pill${activeChannel === channel ? ' active' : ''}`}
                  onClick={() => setActiveChannel(channel)}
                >
                  {titleCase(channel)}
                </button>
              ))}
            </div>
            <div className="encrypted-badge encrypted-badge--block">Internal chat encrypted</div>
            <div className="chat-list" role="list">
              {roomsLoading && <p className="chat-list-hint">Loading rooms…</p>}
              {roomsError && !roomsLoading && (
                <p className="chat-list-error" role="alert">
                  {roomsError}
                </p>
              )}
              {!roomsLoading &&
                visibleRooms.map((row) => {
                  const room = row.chat_rooms!
                  const active = room.id === selectedRoomId
                  return (
                    <button
                      key={room.id}
                      type="button"
                      role="listitem"
                      className={`chat-room-item${active ? ' active' : ''}`}
                      onClick={() => setSelectedRoomId(room.id)}
                    >
                      <div className="chat-room-item-name">{room.name}</div>
                      <div className="chat-room-item-sub">
                        {titleCase(room.channel)} · {titleCase(room.provider)}
                      </div>
                      <div className="chat-room-item-sub">
                        SLA: {titleCase(room.sla_status ?? 'none')}
                      </div>
                      {room.external_contact ? (
                        <div className="chat-room-item-sub chat-room-item-contact">
                          {room.external_contact}
                        </div>
                      ) : null}
                    </button>
                  )
                })}
            </div>
          </aside>

          <section className="chat-main">
            {selectedRoomId == null || !selectedRoom ? (
              <div className="empty-state empty-state--chat">
                <IconChatMuted className="empty-state-icon" />
                <p>Select a conversation</p>
              </div>
            ) : (
              <>
                <header className="chat-header chat-header-layout">
                  <div className="chat-header-title-row">
                    <IconInboxGold />
                    <span>
                      {selectedRoom.name} · {titleCase(selectedRoom.channel)}
                    </span>
                  </div>
                  <div className="chat-header-actions">
                    <span className="chat-room-assignee">
                      Owner: {selectedRoom.assigned_to ? selectedRoom.assigned_to.slice(0, 8) : 'Unassigned'}
                    </span>
                    <span className={`chat-room-sla sla-${selectedRoom.sla_status ?? 'none'}`}>
                      SLA: {titleCase(selectedRoom.sla_status ?? 'none')}
                    </span>
                    <label className="chat-header-translate">
                      Translate to
                      <select
                        value={targetLanguage}
                        onChange={(e) => setTargetLanguage(e.target.value as 'en' | 'es')}
                      >
                        <option value="es">Spanish</option>
                        <option value="en">English</option>
                      </select>
                    </label>
                    <span className="encrypted-badge">Encrypted</span>
                  </div>
                </header>

                <div
                  ref={messagesContainerRef}
                  className="chat-messages"
                  aria-live="polite"
                  aria-label="Messages"
                >
                  {messagesLoading && <p className="chat-list-hint">Loading messages…</p>}
                  {messagesError && !messagesLoading && (
                    <p className="chat-list-error" role="alert">
                      {messagesError}
                    </p>
                  )}
                  {!messagesLoading &&
                    messages.map((m) => {
                      const sent = m.sender_id === userId
                      return (
                        <article
                          key={m.id}
                          className={`chat-msg${sent ? ' sent' : ' received'}`}
                        >
                          {!sent && (
                            <div className="chat-msg-sender">
                              {m.profiles?.full_name?.trim() || 'Unknown'}
                            </div>
                          )}
                          <div className="chat-msg-direction">{titleCase(m.direction)}</div>
                          <div className="chat-msg-body">{m.content}</div>
                          {translatedById[m.id] ? (
                            <div className="chat-msg-translation">{translatedById[m.id]}</div>
                          ) : null}
                          <time className="chat-msg-time" dateTime={m.created_at}>
                            {formatMessageTime(m.created_at)}
                          </time>
                          <button
                            type="button"
                            className="chat-translate-btn"
                            disabled={translatingId === m.id}
                            onClick={() => handleTranslateMessage(m.id, m.content)}
                          >
                            {translatingId === m.id ? 'Translating…' : `Translate to ${targetLanguage}`}
                          </button>
                        </article>
                      )
                    })}
                  <div ref={messagesEndRef} />
                </div>

                <form className="chat-input-row" onSubmit={handleSend}>
                  <select
                    className="chat-canned-select"
                    value=""
                    onChange={(ev) => applyCannedResponse(ev.target.value)}
                  >
                    <option value="">Insert canned…</option>
                    {cannedResponses
                      .filter(
                        (row) =>
                          row.language === cannedLanguage &&
                          (row.channel === 'all' || row.channel === selectedRoom.channel),
                      )
                      .map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.title}
                        </option>
                      ))}
                  </select>
                  <input
                    type="text"
                    name="message"
                    autoComplete="off"
                    placeholder="Type a message…"
                    value={draft}
                    onChange={(ev) => setDraft(ev.target.value)}
                    aria-label="Message"
                  />
                  <button type="submit" className="btn-gold btn-sm" disabled={sending}>
                    Send
                  </button>
                </form>

                <section className="chat-tools-grid">
                  <article className="card chat-tool-card">
                    <div className="card-body">
                      <h3 className="card-title chat-tool-title">Log Calls/Emails/WhatsApp/Telegram</h3>
                      <form className="chat-tool-form" onSubmit={handleLogEvent}>
                        <div className="two-col">
                          <div className="form-group">
                            <label className="form-label">Channel</label>
                            <select
                              value={eventChannel}
                              onChange={(e) => setEventChannel(e.target.value as ChannelType)}
                            >
                              <option value="call">Call</option>
                              <option value="email">Email</option>
                              <option value="whatsapp">WhatsApp</option>
                              <option value="telegram">Telegram</option>
                              <option value="internal">Internal</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Direction</label>
                            <select
                              value={eventDirection}
                              onChange={(e) => setEventDirection(e.target.value as 'inbound' | 'outbound')}
                            >
                              <option value="inbound">Inbound</option>
                              <option value="outbound">Outbound</option>
                            </select>
                          </div>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Subject</label>
                          <input value={eventSubject} onChange={(e) => setEventSubject(e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Notes</label>
                          <textarea
                            rows={3}
                            value={eventBody}
                            onChange={(e) => setEventBody(e.target.value)}
                            required
                          />
                        </div>
                        <button type="submit" className="btn-gold" disabled={eventSaving}>
                          {eventSaving ? 'Saving…' : 'Log activity'}
                        </button>
                      </form>
                      <div className="chat-event-list">
                        {events.map((ev) => (
                          <div key={ev.id} className="chat-event-item">
                            <div className="chat-event-header">
                              <span className="badge badge-gold">{titleCase(ev.channel)}</span>
                              <span className="badge">{titleCase(ev.direction)}</span>
                            </div>
                            {ev.subject ? <div className="chat-event-subject">{ev.subject}</div> : null}
                            <p className="chat-event-body">{ev.body}</p>
                            <time className="chat-msg-time">{formatMessageTime(ev.created_at)}</time>
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>

                  <article className="card chat-tool-card">
                    <div className="card-body">
                      <h3 className="card-title chat-tool-title">Vespera AI Helper</h3>
                      <form className="chat-tool-form" onSubmit={handleAskAi}>
                        <div className="form-group">
                          <label className="form-label">Response language</label>
                          <select
                            value={aiLanguage}
                            onChange={(e) => setAiLanguage(e.target.value as 'en' | 'es')}
                          >
                            <option value="es">Spanish</option>
                            <option value="en">English</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Canned language</label>
                          <select
                            value={cannedLanguage}
                            onChange={(e) => setCannedLanguage(e.target.value as 'en' | 'es')}
                          >
                            <option value="es">Spanish</option>
                            <option value="en">English</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Question</label>
                          <textarea
                            rows={3}
                            value={aiQuestion}
                            onChange={(e) => setAiQuestion(e.target.value)}
                            placeholder="Ask about positioning, pricing, service details, or next-step messaging..."
                          />
                        </div>
                        <button type="submit" className="btn-gold" disabled={aiLoading}>
                          {aiLoading ? 'Thinking…' : 'Ask AI'}
                        </button>
                      </form>
                      <div className="chat-ai-answer">
                        {aiAnswer ? <p>{aiAnswer}</p> : <p className="muted">No response yet.</p>}
                      </div>
                    </div>
                  </article>
                </section>
              </>
            )}
          </section>
        </div>
      </div>

      {modalOpen && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={(ev) => {
            if (ev.target === ev.currentTarget) setModalOpen(false)
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-room-title"
            onClick={(ev) => ev.stopPropagation()}
          >
            <h2 id="new-room-title" className="modal-title">
              New omnichannel room
            </h2>
            <div className="card-body">
              <div className="trust-banner trust-banner--compact">
                Use this for internal chat or external channels (email, WhatsApp, Telegram, call logs).
              </div>
              {createError && (
                <p className="chat-list-error" role="alert">
                  {createError}
                </p>
              )}
              <form onSubmit={handleCreateRoom}>
                <div className="form-group">
                  <label className="form-label" htmlFor="new-room-name">
                    Room name
                  </label>
                  <input
                    id="new-room-name"
                    name="new-room-name"
                    type="text"
                    value={newRoomName}
                    onChange={(ev) => setNewRoomName(ev.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="two-col">
                  <div className="form-group">
                    <label className="form-label">Channel</label>
                    <select
                      value={newRoomChannel}
                      onChange={(ev) => setNewRoomChannel(ev.target.value as ChannelType)}
                    >
                      {CHANNELS.map((channel) => (
                        <option key={channel} value={channel}>
                          {titleCase(channel)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Provider</label>
                    <select
                      value={newRoomProvider}
                      onChange={(ev) => setNewRoomProvider(ev.target.value as ProviderType)}
                    >
                      {PROVIDERS.map((provider) => (
                        <option key={provider} value={provider}>
                          {titleCase(provider)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">External contact (optional)</label>
                  <input
                    type="text"
                    value={newRoomExternalContact}
                    onChange={(ev) => setNewRoomExternalContact(ev.target.value)}
                    placeholder="email, phone, @telegram, etc."
                  />
                </div>
                <button type="submit" className="btn-gold" disabled={creatingRoom}>
                  {creatingRoom ? 'Creating…' : 'Create'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

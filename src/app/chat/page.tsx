'use client'

import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase-browser'
import type { ChatRoom, Profile } from '@/lib/types'
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
  created_at: string
  profiles: { full_name: string | null } | null
}

function IconChatGold({ className }: { className?: string }) {
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
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesError, setMessagesError] = useState<string | null>(null)

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const [modalOpen, setModalOpen] = useState(false)
  const [newRoomName, setNewRoomName] = useState('')
  const [creatingRoom, setCreatingRoom] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

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

  const loadMessages = useCallback(
    async (roomId: number) => {
      setMessagesLoading(true)
      setMessagesError(null)
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*, profiles(full_name)')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(100)

      if (error) {
        setMessagesError(error.message)
        setMessages([])
      } else {
        setMessages((data ?? []) as ChatMessageRow[])
      }
      setMessagesLoading(false)
    },
    [supabase],
  )

  useEffect(() => {
    if (selectedRoomId == null) {
      setMessages([])
      return
    }
    loadMessages(selectedRoomId)
  }, [selectedRoomId, loadMessages])

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
      })
      .select('*, profiles(full_name)')
      .single()

    if (error) {
      setMessagesError(error.message)
    } else if (data) {
      const msg = data as ChatMessageRow
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
      setDraft('')
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
      .insert({ name, is_private: true })
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
    await loadRooms()
    setSelectedRoomId(roomId)
    setCreatingRoom(false)
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
              <h2 className="chat-sidebar-title">Messages</h2>
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
            <div className="encrypted-badge encrypted-badge--block">End-to-end encrypted</div>
            <div className="chat-list" role="list">
              {roomsLoading && <p className="chat-list-hint">Loading rooms…</p>}
              {roomsError && !roomsLoading && (
                <p className="chat-list-error" role="alert">
                  {roomsError}
                </p>
              )}
              {!roomsLoading &&
                rooms.map((row) => {
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
                      <div className="chat-room-item-sub">Private channel</div>
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
                    <IconChatGold />
                    <span>{selectedRoom.name}</span>
                  </div>
                  <span className="encrypted-badge">Encrypted</span>
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
                          <div className="chat-msg-body">{m.content}</div>
                          <time className="chat-msg-time" dateTime={m.created_at}>
                            {formatMessageTime(m.created_at)}
                          </time>
                        </article>
                      )
                    })}
                  <div ref={messagesEndRef} />
                </div>

                <form className="chat-input-row" onSubmit={handleSend}>
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
              New encrypted room
            </h2>
            <div className="card-body">
              <div className="trust-banner trust-banner--compact">
                Messages in this room are protected with end-to-end encryption. Only participants can
                read them.
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

'use client'

import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase-browser'
import type { CannedResponse, ChannelConnection, Profile } from '@/lib/types'
import { useRouter } from 'next/navigation'
import { FormEvent, useEffect, useMemo, useState } from 'react'

const PROVIDERS = ['chatwoot', 'helpwise', 'whatsapp', 'telegram', 'email', 'voice'] as const

type Provider = (typeof PROVIDERS)[number]

export default function IntegrationsPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [ready, setReady] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [rows, setRows] = useState<ChannelConnection[]>([])
  const [canned, setCanned] = useState<CannedResponse[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [provider, setProvider] = useState<Provider>('chatwoot')
  const [label, setLabel] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [cTitle, setCTitle] = useState('')
  const [cLang, setCLang] = useState<'en' | 'es'>('es')
  const [cChannel, setCChannel] = useState<'all' | 'email' | 'whatsapp' | 'telegram' | 'internal' | 'call'>('all')
  const [cBody, setCBody] = useState('')

  async function loadConnections() {
    const { data, error: e } = await supabase
      .from('channel_connections')
      .select('*')
      .order('created_at', { ascending: false })

    if (e) {
      setError(e.message)
      setRows([])
      return
    }

    setRows((data ?? []) as ChannelConnection[])
  }

  async function loadCanned() {
    const { data, error: e } = await supabase
      .from('canned_responses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (e) {
      setError(e.message)
      setCanned([])
      return
    }
    setCanned((data ?? []) as CannedResponse[])
  }

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

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (cancelled) return
      setProfile((prof as Profile) ?? null)
      await Promise.all([loadConnections(), loadCanned()])
      setReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [router, supabase])

  async function createConnection(e: FormEvent) {
    e.preventDefault()
    if (!label.trim()) return
    setSaving(true)
    setError(null)

    const { error: insertError } = await supabase.from('channel_connections').insert({
      provider,
      label: label.trim(),
      webhook_url: webhookUrl.trim() || null,
      api_key: apiKey.trim() || null,
      created_by: profile?.id ?? null,
    })

    setSaving(false)
    if (insertError) {
      setError(insertError.message)
      return
    }

    setLabel('')
    setWebhookUrl('')
    setApiKey('')
    await loadConnections()
  }

  async function toggleConnection(row: ChannelConnection) {
    const { error: updateError } = await supabase
      .from('channel_connections')
      .update({
        is_active: !row.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    if (updateError) {
      setError(updateError.message)
      return
    }
    await loadConnections()
  }

  async function createCannedResponse(e: FormEvent) {
    e.preventDefault()
    if (!cTitle.trim() || !cBody.trim()) return
    setSaving(true)
    setError(null)
    const { error: insertError } = await supabase.from('canned_responses').insert({
      title: cTitle.trim(),
      language: cLang,
      channel: cChannel,
      body: cBody.trim(),
      created_by: profile?.id ?? null,
      is_active: true,
    })
    setSaving(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setCTitle('')
    setCBody('')
    await loadCanned()
  }

  async function toggleCanned(row: CannedResponse) {
    const { error: updateError } = await supabase
      .from('canned_responses')
      .update({
        is_active: !row.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id)
    if (updateError) {
      setError(updateError.message)
      return
    }
    await loadCanned()
  }

  if (!ready) {
    return (
      <div className="layout layout-loading">
        <div className="main-content main-content-loading">
          <p className="muted">Loading integrations…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="layout">
      <Sidebar
        user={profile ? { id: profile.id, full_name: profile.full_name, role: profile.role } : null}
        currentPath="/integrations"
      />
      <main className="main-content">
        <header className="page-header">
          <div className="page-header-text">
            <h1 className="page-title">Integrations & API</h1>
            <p className="page-subtitle">
              Connect Chatwoot, Helpwise, WhatsApp, Telegram, email, or voice workflows.
            </p>
          </div>
        </header>

        <div className="page-body">
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <section className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body">
              <h2 className="card-title" style={{ marginBottom: '0.75rem' }}>
                Add channel connection
              </h2>
              <form className="three-col" onSubmit={createConnection}>
                <div className="form-group">
                  <label className="form-label">Provider</label>
                  <select value={provider} onChange={(e) => setProvider(e.target.value as Provider)}>
                    {PROVIDERS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Label</label>
                  <input value={label} onChange={(e) => setLabel(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Webhook URL (optional)</label>
                  <input value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Provider API key (optional)</label>
                  <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <button className="btn-gold" type="submit" disabled={saving}>
                    {saving ? 'Saving…' : 'Save connection'}
                  </button>
                </div>
              </form>
            </div>
          </section>

          <section className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body">
              <h2 className="card-title" style={{ marginBottom: '0.75rem' }}>
                Connected providers
              </h2>
              {rows.length === 0 ? (
                <p className="muted">No integrations configured yet.</p>
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Provider</th>
                        <th>Label</th>
                        <th>Status</th>
                        <th>Webhook</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.provider}</td>
                          <td>{row.label}</td>
                          <td>{row.is_active ? 'Active' : 'Paused'}</td>
                          <td>{row.webhook_url || '—'}</td>
                          <td>
                            <button className="btn-ghost" type="button" onClick={() => toggleConnection(row)}>
                              {row.is_active ? 'Pause' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-body">
              <h2 className="card-title" style={{ marginBottom: '0.75rem' }}>
                API endpoints (Chatwoot/Helpwise adapter-ready)
              </h2>
              <p className="muted" style={{ marginBottom: '0.75rem' }}>
                Use `x-vespera-api-key: $INBOX_API_KEY` in request headers.
              </p>
              <pre className="integration-code-block">{`POST /api/inbox/messages
{
  "roomName": "Agency - ACME",
  "channel": "whatsapp",
  "provider": "chatwoot",
  "providerRoomId": "cw_9842",
  "externalContact": "+52 664 ...",
  "content": "Hola, me interesa saber precios",
  "direction": "inbound",
  "senderUserId": "<agent-profile-uuid>",
  "originalLanguage": "es"
}

POST /api/inbox/events
{
  "channel": "call",
  "direction": "outbound",
  "subject": "Discovery call",
  "body": "Discussed onboarding and pricing",
  "leadId": 14

}

POST /api/webhooks/chatwoot
Headers: x-chatwoot-token: $CHATWOOT_WEBHOOK_TOKEN

POST /api/webhooks/helpwise
Headers: x-helpwise-token: $HELPWISE_WEBHOOK_TOKEN

# Automation behavior
- inbound message -> auto-assigns lowest-load sales/support/admin user (if unassigned)
- inbound message -> starts first-response SLA (15 min)
- first outbound reply -> marks SLA as met or breached
}`}</pre>
            </div>
          </section>

          <section className="card" style={{ marginTop: '1rem' }}>
            <div className="card-body">
              <h2 className="card-title" style={{ marginBottom: '0.75rem' }}>
                Bilingual canned responses
              </h2>
              <form className="three-col" onSubmit={createCannedResponse}>
                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input value={cTitle} onChange={(e) => setCTitle(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Language</label>
                  <select value={cLang} onChange={(e) => setCLang(e.target.value as 'en' | 'es')}>
                    <option value="es">Spanish</option>
                    <option value="en">English</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Channel</label>
                  <select
                    value={cChannel}
                    onChange={(e) =>
                      setCChannel(
                        e.target.value as 'all' | 'email' | 'whatsapp' | 'telegram' | 'internal' | 'call',
                      )
                    }
                  >
                    <option value="all">All</option>
                    <option value="email">Email</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="telegram">Telegram</option>
                    <option value="internal">Internal</option>
                    <option value="call">Call</option>
                  </select>
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Response text</label>
                  <textarea rows={4} value={cBody} onChange={(e) => setCBody(e.target.value)} required />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <button className="btn-gold" type="submit" disabled={saving}>
                    {saving ? 'Saving…' : 'Save canned response'}
                  </button>
                </div>
              </form>

              <div className="table-scroll" style={{ marginTop: '0.85rem' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Lang</th>
                      <th>Channel</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {canned.map((row) => (
                      <tr key={row.id}>
                        <td>{row.title}</td>
                        <td>{row.language.toUpperCase()}</td>
                        <td>{row.channel}</td>
                        <td>{row.is_active ? 'Active' : 'Inactive'}</td>
                        <td>
                          <button className="btn-ghost" type="button" onClick={() => toggleCanned(row)}>
                            {row.is_active ? 'Disable' : 'Enable'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

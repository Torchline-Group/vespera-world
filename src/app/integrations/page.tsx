'use client'

export const dynamic = 'force-dynamic'

import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase-browser'
import type { CannedResponse, ChannelConnection, Profile, StorefrontMode } from '@/lib/types'
import { useRouter } from 'next/navigation'
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'

const PROVIDERS = ['chatwoot', 'helpwise', 'whatsapp', 'telegram', 'email', 'voice'] as const

type Provider = (typeof PROVIDERS)[number]
type CheckoutProvider = 'snipcart' | 'samcart'

type IntegrationStatus = {
  shopify: boolean
  polar: boolean
  vendura: boolean
  stripe: { secret: boolean; publishable: boolean; webhook: boolean }
  openai: boolean
  inbox: boolean
  snipcartPublic: boolean
}

export default function IntegrationsPage() {
  const supabase = useMemo(() => (typeof window === 'undefined' ? null : createClient()), [])
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
  const [storefrontMode, setStorefrontMode] = useState<StorefrontMode>('headless')
  const [csvInput, setCsvInput] = useState('')
  const [checkoutProvider, setCheckoutProvider] = useState<CheckoutProvider>('snipcart')
  const [snipcartPublicApiKey, setSnipcartPublicApiKey] = useState('')
  const [samcartCheckoutUrl, setSamcartCheckoutUrl] = useState('')
  const [integrationStatus, setIntegrationStatus] = useState<IntegrationStatus | null>(null)

  const loadConnections = useCallback(async () => {
    if (!supabase) return
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
  }, [supabase])

  const loadStorefrontMode = useCallback(async () => {
    const res = await fetch('/api/commerce/settings')
    const payload = (await res.json()) as { mode?: StorefrontMode }
    setStorefrontMode(payload.mode === 'liquid' ? 'liquid' : 'headless')
  }, [])

  const loadCanned = useCallback(async () => {
    if (!supabase) return
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
  }, [supabase])

  const loadCheckoutConfig = useCallback(async () => {
    const res = await fetch('/api/commerce/checkout')
    const payload = (await res.json()) as {
      provider?: CheckoutProvider
      snipcartPublicApiKey?: string
      samcartCheckoutUrl?: string
    }
    setCheckoutProvider(payload.provider === 'samcart' ? 'samcart' : 'snipcart')
    setSnipcartPublicApiKey(payload.snipcartPublicApiKey ?? '')
    setSamcartCheckoutUrl(payload.samcartCheckoutUrl ?? '')
  }, [])

  const loadIntegrationStatus = useCallback(async () => {
    const res = await fetch('/api/integration/status')
    const payload = (await res.json()) as IntegrationStatus & { error?: string }
    if (res.ok && !payload.error) {
      setIntegrationStatus({
        shopify: payload.shopify,
        polar: payload.polar,
        vendura: payload.vendura,
        stripe: payload.stripe,
        openai: payload.openai,
        inbox: payload.inbox,
        snipcartPublic: payload.snipcartPublic,
      })
    }
  }, [])

  useEffect(() => {
    if (!supabase) return
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
      await Promise.all([
        loadConnections(),
        loadCanned(),
        loadStorefrontMode(),
        loadCheckoutConfig(),
        loadIntegrationStatus(),
      ])
      setReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [router, supabase, loadConnections, loadCanned, loadStorefrontMode, loadCheckoutConfig, loadIntegrationStatus])

  async function createConnection(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
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
    if (!supabase) return
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
    if (!supabase) return
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
    if (!supabase) return
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

  async function setMode(mode: StorefrontMode) {
    setStorefrontMode(mode)
    await fetch('/api/commerce/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    })
  }

  async function runShopifySync() {
    setSaving(true)
    const res = await fetch('/api/commerce/sync/shopify', { method: 'POST' })
    const payload = (await res.json()) as { error?: string }
    if (!res.ok || payload.error) setError(payload.error ?? 'Shopify sync failed')
    setSaving(false)
  }

  async function importCsv() {
    if (!csvInput.trim()) return
    setSaving(true)
    const res = await fetch('/api/commerce/csv/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: csvInput }),
    })
    const payload = (await res.json()) as { error?: string }
    if (!res.ok || payload.error) setError(payload.error ?? 'CSV import failed')
    setSaving(false)
  }

  async function saveCheckoutConfig() {
    setSaving(true)
    setError(null)
    const res = await fetch('/api/commerce/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: checkoutProvider,
        snipcartPublicApiKey,
        samcartCheckoutUrl,
      }),
    })
    const payload = (await res.json()) as { error?: string }
    if (!res.ok || payload.error) {
      setError(payload.error ?? 'Could not save checkout config')
    }
    setSaving(false)
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
              <h2 className="card-title" style={{ marginBottom: '0.35rem' }}>
                Server environment (Vercel / `.env.local`)
              </h2>
              <p className="muted" style={{ marginBottom: '0.5rem' }}>
                Which integration env vars are set on the server (no values shown). Configure in Vercel or `.env.example`.
              </p>
              {integrationStatus ? (
                <div className="integration-status-grid">
                  <span className={`integration-pill ${integrationStatus.shopify ? 'integration-pill--on' : 'integration-pill--off'}`}>
                    Shopify {integrationStatus.shopify ? '●' : '○'}
                  </span>
                  <span className={`integration-pill ${integrationStatus.polar ? 'integration-pill--on' : 'integration-pill--off'}`}>
                    Polar {integrationStatus.polar ? '●' : '○'}
                  </span>
                  <span className={`integration-pill ${integrationStatus.vendura ? 'integration-pill--on' : 'integration-pill--off'}`}>
                    Vendura {integrationStatus.vendura ? '●' : '○'}
                  </span>
                  <span
                    className={`integration-pill ${integrationStatus.stripe.secret ? 'integration-pill--on' : 'integration-pill--off'}`}
                  >
                    Stripe secret {integrationStatus.stripe.secret ? '●' : '○'}
                  </span>
                  <span
                    className={`integration-pill ${integrationStatus.stripe.publishable ? 'integration-pill--on' : 'integration-pill--off'}`}
                  >
                    Stripe pk {integrationStatus.stripe.publishable ? '●' : '○'}
                  </span>
                  <span
                    className={`integration-pill ${integrationStatus.stripe.webhook ? 'integration-pill--on' : 'integration-pill--off'}`}
                  >
                    Stripe webhook {integrationStatus.stripe.webhook ? '●' : '○'}
                  </span>
                  <span className={`integration-pill ${integrationStatus.openai ? 'integration-pill--on' : 'integration-pill--off'}`}>
                    OpenAI {integrationStatus.openai ? '●' : '○'}
                  </span>
                  <span className={`integration-pill ${integrationStatus.inbox ? 'integration-pill--on' : 'integration-pill--off'}`}>
                    Inbox API {integrationStatus.inbox ? '●' : '○'}
                  </span>
                  <span
                    className={`integration-pill ${integrationStatus.snipcartPublic ? 'integration-pill--on' : 'integration-pill--off'}`}
                  >
                    Snipcart env {integrationStatus.snipcartPublic ? '●' : '○'}
                  </span>
                </div>
              ) : (
                <p className="muted">Could not load status.</p>
              )}
            </div>
          </section>

          <section className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body">
              <h2 className="card-title" style={{ marginBottom: '0.75rem' }}>
                Storefront Mode
              </h2>
              <div className="mode-switch-row" style={{ marginBottom: '1rem' }}>
                <button
                  type="button"
                  className={`btn-ghost ${storefrontMode === 'headless' ? 'active' : ''}`}
                  onClick={() => setMode('headless')}
                >
                  Headless Next.js
                </button>
                <button
                  type="button"
                  className={`btn-ghost ${storefrontMode === 'liquid' ? 'active' : ''}`}
                  onClick={() => setMode('liquid')}
                >
                  Shopify Liquid
                </button>
                <button type="button" className="btn-gold" onClick={runShopifySync} disabled={saving}>
                  {saving ? 'Syncing…' : 'Sync Shopify Catalog'}
                </button>
              </div>

              <h2 className="card-title" style={{ marginBottom: '0.75rem' }}>
                Shopify CSV Import
              </h2>
              <div className="form-group">
                <textarea
                  rows={6}
                  value={csvInput}
                  onChange={(e) => setCsvInput(e.target.value)}
                  placeholder="Paste Shopify-formatted CSV text here..."
                />
              </div>
              <button type="button" className="btn-ghost" onClick={importCsv} disabled={saving}>
                Import CSV
              </button>
            </div>
          </section>

          <section className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-body">
              <h2 className="card-title" style={{ marginBottom: '0.75rem' }}>
                Checkout Integration
              </h2>
              <p className="muted" style={{ marginBottom: '0.85rem' }}>
                SuiteDash is removed. Configure Snipcart (recommended) or SamCart for marketplace checkout.
              </p>
              <div className="three-col" style={{ marginBottom: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Provider</label>
                  <select
                    value={checkoutProvider}
                    onChange={(e) => setCheckoutProvider(e.target.value as CheckoutProvider)}
                  >
                    <option value="snipcart">Snipcart</option>
                    <option value="samcart">SamCart</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Snipcart Public API Key</label>
                  <input
                    value={snipcartPublicApiKey}
                    onChange={(e) => setSnipcartPublicApiKey(e.target.value)}
                    placeholder="pk_live_..."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">SamCart Checkout URL</label>
                  <input
                    value={samcartCheckoutUrl}
                    onChange={(e) => setSamcartCheckoutUrl(e.target.value)}
                    placeholder="https://yourbrand.samcart.com/products/..."
                  />
                </div>
              </div>
              <button type="button" className="btn-gold" onClick={saveCheckoutConfig} disabled={saving}>
                {saving ? 'Saving…' : 'Save Checkout Integration'}
              </button>
            </div>
          </section>

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

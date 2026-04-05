'use client'

export const dynamic = 'force-dynamic'

import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase-browser'
import type { Profile } from '@/lib/types'
import { useRouter } from 'next/navigation'
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'

type PortalSummary = {
  profile: (Profile & { created_at?: string }) | null
  forms: Array<{
    id: number
    title: string
    description?: string | null
    status: string
    fields_json?: string
    updated_at?: string
    submittedCount: number
    lastSubmittedAt: string | null
    statusComputed: 'submitted' | 'pending'
  }>
  submissions: Array<{
    id: number
    form_id: number
    submitted_by: string | null
    created_at: string
    payload_json: string
  }>
  signedDocs: Array<{
    id: number
    title: string
    signer_name: string
    signed_at: string
  }>
  comms: {
    chatRooms: Array<{
      id: number
      name: string | null
      channel: string | null
      last_inbound_at: string | null
      first_response_at: string | null
      sla_status: string | null
      assigned_to: string | null
    }>
    events: Array<{
      id: number
      room_id: number | null
      lead_id: number | null
      channel: string
      direction: string
      subject: string | null
      body: string | null
      created_at: string
    }>
  }
}

type PortalField = {
  key: string
  label?: string
  type?: 'text' | 'textarea' | 'email' | 'number' | 'checkbox' | 'select'
  required?: boolean
  options?: string[]
}

function parsePortalFields(fieldsJson: string): PortalField[] {
  try {
    const parsed = JSON.parse(fieldsJson) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((v) => typeof v === 'object' && v !== null && 'key' in v)
      .map((v) => {
        const f = v as PortalField
        return {
          key: String(f.key),
          label: f.label ? String(f.label) : String(f.key),
          type: f.type ?? 'text',
          required: Boolean(f.required),
          options: Array.isArray(f.options) ? f.options.map(String) : [],
        }
      })
  } catch {
    return []
  }
}

function formatPayloadPreview(payloadJson: string): string {
  try {
    const o = JSON.parse(payloadJson) as Record<string, unknown>
    const lines = Object.entries(o).map(([k, v]) => `${k}: ${String(v)}`)
    return lines.join('\n')
  } catch {
    return payloadJson.slice(0, 400)
  }
}

export default function PortalPage() {
  const supabase = useMemo(() => (typeof window === 'undefined' ? null : createClient()), [])
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const [summary, setSummary] = useState<PortalSummary | null>(null)

  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [ackTitle, setAckTitle] = useState('Service Acknowledgment')
  const [ackContent, setAckContent] = useState(
    'I acknowledge the scope, delivery terms, and privacy policy for Vespera World services.',
  )
  const [signerName, setSignerName] = useState('')
  const [activeFormId, setActiveFormId] = useState<number | null>(null)
  const [submissionDrafts, setSubmissionDrafts] = useState<Record<number, Record<string, string>>>({})
  const [submittingFormId, setSubmittingFormId] = useState<number | null>(null)
  const [signing, setSigning] = useState(false)

  const showToast = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(null), 4200)
  }, [])

  const loadSummary = useCallback(async () => {
    setError(null)
    const res = await fetch('/api/portal/summary')
    const payload = (await res.json()) as { error?: string } & Partial<PortalSummary>
    if (!res.ok || payload.error) {
      setError(payload.error ?? 'Could not load portal summary')
      return
    }
    setSummary(payload as PortalSummary)
  }, [])

  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    ;(async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/login')
        return
      }
      if (cancelled) return
      await loadSummary()
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [router, supabase, loadSummary])

  const formTitleById = useMemo(() => {
    const m = new Map<number, string>()
    for (const f of summary?.forms ?? []) m.set(f.id, f.title)
    return m
  }, [summary?.forms])

  async function createForm(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    const title = formTitle.trim()
    if (!title) return

    const res = await fetch('/api/portal/forms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description: formDesc.trim() || null,
        fields_json: JSON.stringify([
          { key: 'full_name', label: 'Full name', type: 'text', required: true },
          { key: 'email', label: 'Email', type: 'email', required: true },
          { key: 'notes', label: 'How can we help?', type: 'textarea', required: false },
        ]),
      }),
    })
    const payload = (await res.json()) as { error?: string }
    if (!res.ok || payload.error) {
      setError(payload.error ?? 'Could not create form')
      return
    }

    setFormTitle('')
    setFormDesc('')
    showToast('Form created. Open it below to submit a response.')
    await loadSummary()
  }

  async function signAck(e: FormEvent) {
    e.preventDefault()
    const name = signerName.trim()
    if (!name) return
    setSigning(true)
    setError(null)
    const res = await fetch('/api/portal/ack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: ackTitle,
        content: ackContent,
        signer_name: name,
      }),
    })
    const payload = (await res.json()) as { error?: string }
    setSigning(false)
    if (!res.ok || payload.error) {
      setError(payload.error ?? 'Could not sign acknowledgement')
      return
    }
    setSignerName('')
    showToast('Acknowledgment recorded.')
    await loadSummary()
  }

  function fieldMissing(field: PortalField, values: Record<string, string>): boolean {
    if (!field.required) return false
    if (field.type === 'checkbox') return values[field.key] !== 'true'
    return !String(values[field.key] ?? '').trim()
  }

  async function submitPortalForm(e: FormEvent, formId: number, fields: PortalField[]) {
    e.preventDefault()
    const values = submissionDrafts[formId] ?? {}

    const missing = fields.find((field) => fieldMissing(field, values))
    if (missing) {
      setError(`Please complete: ${missing.label ?? missing.key}`)
      return
    }

    if (fields.length === 0) {
      if (!String(values.message ?? '').trim()) {
        setError('Please enter a message.')
        return
      }
    }

    setSubmittingFormId(formId)
    setError(null)
    const payload =
      fields.length === 0 ? { message: values.message ?? '' } : Object.fromEntries(fields.map((f) => [f.key, values[f.key] ?? '']))

    const res = await fetch(`/api/portal/forms/${formId}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload }),
    })
    const json = (await res.json()) as { error?: string }
    if (!res.ok || json.error) {
      setError(json.error ?? 'Could not submit form')
      setSubmittingFormId(null)
      return
    }

    setSubmissionDrafts((prev) => ({ ...prev, [formId]: {} }))
    setSubmittingFormId(null)
    setActiveFormId(null)
    showToast('Response submitted.')
    await loadSummary()
  }

  if (!ready) {
    return (
      <div className="layout layout-loading">
        <div className="main-content main-content-loading">
          <p className="muted">Loading client workspace…</p>
        </div>
      </div>
    )
  }

  const p = summary?.profile
  const forms = summary?.forms ?? []
  const submissions = summary?.submissions ?? []
  const signedDocs = summary?.signedDocs ?? []
  const events = summary?.comms?.events ?? []
  const pendingCount = forms.filter((f) => f.statusComputed === 'pending').length
  const submittedCount = forms.filter((f) => f.statusComputed === 'submitted').length

  return (
    <div className="layout">
      <Sidebar
        user={
          p
            ? {
                id: p.id,
                full_name: p.full_name,
                role: p.role as Profile['role'] | string,
              }
            : null
        }
        currentPath="/portal"
      />
      <main className="main-content">
        <header className="page-header">
          <div className="page-header-text">
            <h1 className="page-title">Client Workspace</h1>
            <p className="page-subtitle">
              Track requests, submit forms, sign acknowledgments, and see a snapshot of recent activity — in one place.
            </p>
          </div>
        </header>

        <div className="page-body portal-grid">
          {toast ? (
            <div className="portal-toast" role="status">
              {toast}
            </div>
          ) : null}

          {error ? (
            <p className="form-error" style={{ gridColumn: '1 / -1' }} role="alert">
              {error}
            </p>
          ) : null}

          <section className="card">
            <div className="card-body">
              <h2 className="card-title">Account</h2>
              <p className="page-subtitle" style={{ marginTop: 0 }}>
                {p ? (
                  <>
                    <strong>{p.full_name}</strong>
                    <span className="muted"> · {p.role}</span>
                  </>
                ) : (
                  '—'
                )}
              </p>
              <div className="portal-stat-strip" aria-label="Workspace summary">
                <div className="portal-stat-pill">
                  <div className="portal-stat-value">{pendingCount}</div>
                  <div className="portal-stat-label">Pending</div>
                </div>
                <div className="portal-stat-pill">
                  <div className="portal-stat-value">{submittedCount}</div>
                  <div className="portal-stat-label">Submitted</div>
                </div>
                <div className="portal-stat-pill">
                  <div className="portal-stat-value">{signedDocs.length}</div>
                  <div className="portal-stat-label">Signed docs</div>
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-body">
              <h2 className="card-title">Request queue</h2>
              {forms.length === 0 ? (
                <p className="muted">No forms yet. Create one below to start tracking client requests.</p>
              ) : (
                <ul className="portal-list">
                  {forms.slice(0, 10).map((f) => (
                    <li key={f.id}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                        <strong>{f.title}</strong>
                        <span className={f.statusComputed === 'submitted' ? 'portal-badge portal-badge--ok' : 'portal-badge portal-badge--pending'}>
                          {f.statusComputed === 'submitted' ? 'Submitted' : 'Pending'}
                        </span>
                      </div>
                      <span className="muted" style={{ fontSize: '0.82rem' }}>
                        {f.lastSubmittedAt ? `Last activity ${new Date(f.lastSubmittedAt).toLocaleString()}` : 'No submissions yet'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-body">
              <h2 className="card-title">Forms</h2>
              <p className="muted" style={{ marginTop: 0, marginBottom: '1rem' }}>
                Create a form, then open it to fill and submit. New forms include name, email, and notes fields by default.
              </p>

              <div className="portal-form-create">
                <h3>New form</h3>
                <form onSubmit={createForm}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="portal-form-title">
                      Title
                    </label>
                    <input id="portal-form-title" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="portal-form-desc">
                      Description <span className="muted">(optional)</span>
                    </label>
                    <textarea id="portal-form-desc" rows={2} value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
                  </div>
                  <button className="btn-gold" type="submit">
                    Create form
                  </button>
                </form>
              </div>

              {forms.length === 0 ? (
                <p className="muted">No forms yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {forms.map((f) => {
                    const fields = parsePortalFields(f.fields_json ?? '[]')
                    const expanded = activeFormId === f.id
                    return (
                      <div key={f.id} className="portal-form-card">
                        <button
                          type="button"
                          className="portal-form-card__head"
                          onClick={() => setActiveFormId((prev) => (prev === f.id ? null : f.id))}
                          aria-expanded={expanded}
                        >
                          <div>
                            <p className="portal-form-card__title">{f.title}</p>
                            {f.description ? <p className="portal-form-card__desc">{f.description}</p> : null}
                          </div>
                          <span className={f.statusComputed === 'submitted' ? 'portal-badge portal-badge--ok' : 'portal-badge portal-badge--pending'}>
                            {f.statusComputed === 'submitted' ? 'Submitted' : 'Pending'}
                          </span>
                        </button>
                        {expanded ? (
                          <div className="portal-form-card__body">
                            <form
                              onSubmit={(e) =>
                                submitPortalForm(
                                  e,
                                  f.id,
                                  fields.length ? fields : [{ key: 'message', label: 'Message', type: 'textarea', required: true }],
                                )
                              }
                            >
                              {fields.length === 0 ? (
                                <div className="form-group">
                                  <label className="form-label">Message</label>
                                  <textarea
                                    rows={4}
                                    value={submissionDrafts[f.id]?.message ?? ''}
                                    onChange={(e) =>
                                      setSubmissionDrafts((prev) => ({
                                        ...prev,
                                        [f.id]: { ...(prev[f.id] ?? {}), message: e.target.value },
                                      }))
                                    }
                                    required
                                  />
                                </div>
                              ) : (
                                fields.map((field) => (
                                  <div className="form-group" key={`${f.id}-${field.key}`}>
                                    {field.type !== 'checkbox' ? (
                                      <label className="form-label">
                                        {field.label ?? field.key}
                                        {field.required ? <span className="muted"> *</span> : null}
                                      </label>
                                    ) : null}
                                    {field.type === 'textarea' ? (
                                      <textarea
                                        rows={3}
                                        value={submissionDrafts[f.id]?.[field.key] ?? ''}
                                        onChange={(e) =>
                                          setSubmissionDrafts((prev) => ({
                                            ...prev,
                                            [f.id]: { ...(prev[f.id] ?? {}), [field.key]: e.target.value },
                                          }))
                                        }
                                        required={field.required}
                                      />
                                    ) : field.type === 'checkbox' ? (
                                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                                        <input
                                          type="checkbox"
                                          checked={submissionDrafts[f.id]?.[field.key] === 'true'}
                                          onChange={(e) =>
                                            setSubmissionDrafts((prev) => ({
                                              ...prev,
                                              [f.id]: { ...(prev[f.id] ?? {}), [field.key]: e.target.checked ? 'true' : '' },
                                            }))
                                          }
                                        />
                                        <span style={{ fontSize: '0.9rem' }}>
                                          {field.label ?? field.key}
                                          {field.required ? <span className="muted"> *</span> : null}
                                        </span>
                                      </label>
                                    ) : field.type === 'select' && (field.options?.length ?? 0) > 0 ? (
                                      <select
                                        value={submissionDrafts[f.id]?.[field.key] ?? ''}
                                        onChange={(e) =>
                                          setSubmissionDrafts((prev) => ({
                                            ...prev,
                                            [f.id]: { ...(prev[f.id] ?? {}), [field.key]: e.target.value },
                                          }))
                                        }
                                        required={field.required}
                                      >
                                        <option value="">Select…</option>
                                        {(field.options ?? []).map((option) => (
                                          <option key={option} value={option}>
                                            {option}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <input
                                        type={
                                          field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : 'text'
                                        }
                                        value={submissionDrafts[f.id]?.[field.key] ?? ''}
                                        onChange={(e) =>
                                          setSubmissionDrafts((prev) => ({
                                            ...prev,
                                            [f.id]: { ...(prev[f.id] ?? {}), [field.key]: e.target.value },
                                          }))
                                        }
                                        required={field.required}
                                      />
                                    )}
                                  </div>
                                ))
                              )}
                              <button className="btn-gold" type="submit" disabled={submittingFormId === f.id}>
                                {submittingFormId === f.id ? 'Submitting…' : 'Submit response'}
                              </button>
                            </form>
                          </div>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="card" style={{ gridColumn: '1 / -1' }}>
            <div className="card-body">
              <h2 className="card-title">Your submissions</h2>
              {submissions.length === 0 ? (
                <p className="muted">No submissions yet. Complete a form above to see it here.</p>
              ) : (
                <div className="table-scroll">
                  <table className="portal-submissions-table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Form</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.slice(0, 25).map((s) => (
                        <tr key={s.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>{new Date(s.created_at).toLocaleString()}</td>
                          <td>{formTitleById.get(s.form_id) ?? `Form #${s.form_id}`}</td>
                          <td>
                            <pre className="portal-payload-preview">{formatPayloadPreview(s.payload_json)}</pre>
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
              <h2 className="card-title">Signed acknowledgments</h2>
              {signedDocs.length === 0 ? <p className="muted">No acknowledgments yet.</p> : null}
              <ul className="portal-timeline">
                {signedDocs.slice(0, 12).map((a) => (
                  <li key={a.id}>
                    <strong>{a.title}</strong>
                    <div className="muted" style={{ fontSize: '0.85rem', marginTop: '0.2rem' }}>
                      {a.signer_name} · {new Date(a.signed_at).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>

              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--vespera-border)' }}>
                <h3 className="card-title" style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>
                  Sign a new acknowledgment
                </h3>
                <form onSubmit={signAck}>
                  <div className="form-group">
                    <label className="form-label">Title</label>
                    <input value={ackTitle} onChange={(e) => setAckTitle(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Content</label>
                    <textarea rows={4} value={ackContent} onChange={(e) => setAckContent(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Signer name</label>
                    <input value={signerName} onChange={(e) => setSignerName(e.target.value)} required />
                  </div>
                  <button className="btn-gold" type="submit" disabled={signing}>
                    {signing ? 'Recording…' : 'Sign acknowledgment'}
                  </button>
                </form>
              </div>
            </div>
          </section>

          <section className="card">
            <div className="card-body">
              <h2 className="card-title">Communications</h2>
              {events.length === 0 ? (
                <p className="muted">No communication events yet.</p>
              ) : (
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>When</th>
                        <th>Channel</th>
                        <th>Direction</th>
                        <th>Subject</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.slice(0, 12).map((ev) => (
                        <tr key={ev.id}>
                          <td>{new Date(ev.created_at).toLocaleString()}</td>
                          <td>{ev.channel}</td>
                          <td>{ev.direction}</td>
                          <td>{ev.subject ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

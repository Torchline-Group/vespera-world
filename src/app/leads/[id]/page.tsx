'use client'

import { createClient } from '@/lib/supabase-browser'
import Sidebar from '@/components/Sidebar'
import type { Activity, Lead, OutreachStatus, Profile, Segment } from '@/lib/types'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'

const SEGMENTS: Segment[] = [
  'agency',
  'creator',
  'studio',
  'partner',
  'advertiser',
  'sugar_platform',
]

const PIPELINE_STATUSES: OutreachStatus[] = [
  'not_contacted',
  'contacted',
  'replied',
  'meeting_set',
  'negotiating',
  'closed_won',
  'closed_lost',
]

const ACTIVITY_TYPES = ['note', 'email', 'call', 'meeting', 'status_change'] as const

function statusLabel(s: OutreachStatus) {
  return s.replace(/_/g, ' ')
}

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

function probToUnit(p: number) {
  return p > 1 ? p / 100 : p
}

function formatPercentDisplay(p: number) {
  const u = probToUnit(p)
  return `${Math.round(u * 100)}%`
}

function weightedValue(deal: number, prob: number) {
  const u = probToUnit(prob)
  return deal * u
}

export default function LeadDetailPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const params = useParams()

  const idParam = params?.id
  const leadIdStr = Array.isArray(idParam) ? idParam[0] : idParam

  const [ready, setReady] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const [lead, setLead] = useState<Lead | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState<Lead | null>(null)

  const [activityType, setActivityType] = useState<(typeof ACTIVITY_TYPES)[number]>('note')
  const [activityDescription, setActivityDescription] = useState('')
  const [activitySaving, setActivitySaving] = useState(false)

  const refreshLeadAndActivities = useCallback(async () => {
    if (!leadIdStr) return

    setLoadError(null)

    const { data: leadRow, error: le } = await supabase
      .from('leads')
      .select('*')
      .eq('id', leadIdStr)
      .single()

    if (le) {
      setLoadError(le.message)
      setLead(null)
      setActivities([])
      return
    }

    const row = leadRow as Lead
    setLead(row)

    const { data: actRows, error: ae } = await supabase
      .from('activities')
      .select('*')
      .eq('lead_id', row.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (ae) {
      setLoadError(ae.message)
      setActivities([])
      return
    }

    setActivities((actRows ?? []) as Activity[])
  }, [leadIdStr, supabase])

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
      if (!pe && prof) {
        setProfile(prof as Profile)
      }
      setReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [router, supabase])

  useEffect(() => {
    if (!ready || !leadIdStr) return
    let cancelled = false
    const handle = window.setTimeout(() => {
      if (!cancelled) void refreshLeadAndActivities()
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [leadIdStr, ready, refreshLeadAndActivities])

  function startEdit() {
    if (!lead) return
    setDraft({ ...lead })
    setIsEditing(true)
  }

  function cancelEdit() {
    setIsEditing(false)
    if (lead) setDraft({ ...lead })
  }

  async function saveLead() {
    if (!draft || !lead) return
    setBusy(true)
    setLoadError(null)

    const formData = {
      company_name: draft.company_name,
      segment: draft.segment,
      sub_segment: draft.sub_segment || null,
      contact_name: draft.contact_name || null,
      contact_email: draft.contact_email || null,
      contact_social: draft.contact_social || null,
      website_url: draft.website_url || null,
      creator_count: draft.creator_count,
      est_monthly_revenue: draft.est_monthly_revenue,
      current_platforms: draft.current_platforms || null,
      current_tools: draft.current_tools || null,
      pain_points: draft.pain_points || null,
      notes: draft.notes || null,
      outreach_status: draft.outreach_status,
      fit_score: draft.fit_score,
      close_probability: draft.close_probability,
      est_deal_value: draft.est_deal_value,
      updated_at: new Date().toISOString(),
    }

    const { error: ue } = await supabase.from('leads').update(formData).eq('id', lead.id)

    setBusy(false)
    if (ue) {
      setLoadError(ue.message)
      return
    }

    setIsEditing(false)
    await refreshLeadAndActivities()
  }

  async function deleteLead() {
    if (!lead) return
    if (!window.confirm(`Delete prospect “${lead.company_name}”? This cannot be undone.`)) return

    setBusy(true)
    setLoadError(null)

    const { error: de } = await supabase.from('leads').delete().eq('id', lead.id)

    setBusy(false)
    if (de) {
      setLoadError(de.message)
      return
    }

    router.push('/leads')
  }

  async function addActivity(e: FormEvent) {
    e.preventDefault()
    if (!lead || !activityDescription.trim()) return

    setActivitySaving(true)
    setLoadError(null)

    const { error: ie } = await supabase.from('activities').insert({
      lead_id: lead.id,
      type: activityType,
      description: activityDescription.trim(),
      created_by: userId,
    })

    setActivitySaving(false)
    if (ie) {
      setLoadError(ie.message)
      return
    }

    setActivityDescription('')
    await refreshLeadAndActivities()
  }

  const display = isEditing && draft ? draft : lead
  const fitGold = display && display.fit_score >= 80

  if (!ready) {
    return (
      <div className="layout layout-loading">
        <p className="muted">Loading…</p>
      </div>
    )
  }

  if (!leadIdStr) {
    return (
      <div className="layout">
        <Sidebar user={profile} currentPath="/leads" />
        <main className="main-content">
          <p className="form-error">Invalid prospect id.</p>
          <Link href="/leads" className="link-back">
            Back to prospects
          </Link>
        </main>
      </div>
    )
  }

  if (loadError && !lead) {
    return (
      <div className="layout">
        <Sidebar user={profile} currentPath="/leads" />
        <main className="main-content">
          <p className="form-error" role="alert">
            {loadError}
          </p>
          <Link href="/leads" className="link-back">
            Back to prospects
          </Link>
        </main>
      </div>
    )
  }

  if (!lead || !display) {
    return (
      <div className="layout">
        <Sidebar user={profile} currentPath="/leads" />
        <main className="main-content">
          <p className="muted">Loading prospect…</p>
        </main>
      </div>
    )
  }

  const w = weightedValue(Number(display.est_deal_value), Number(display.close_probability))

  return (
    <div className="layout">
      <Sidebar user={profile} currentPath="/leads" />
      <main className="main-content">
        <header className="page-header page-header-detail">
          <div className="page-header-row">
            <Link href="/leads" className="btn-back">
              ← Back
            </Link>
            <div className="page-header-main">
              <h1 className="page-title">{display.company_name}</h1>
              <div className="page-header-badges">
                <span className="badge-gold">{display.segment.replace(/_/g, ' ')}</span>
                {display.sub_segment && <span className="text-subsegment">{display.sub_segment}</span>}
              </div>
            </div>
            <div className="page-header-actions">
              {!isEditing ? (
                <>
                  <button type="button" className="btn-outline" onClick={startEdit} disabled={busy}>
                    Edit
                  </button>
                  <button type="button" className="btn-danger" onClick={deleteLead} disabled={busy}>
                    Delete
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn-outline" onClick={cancelEdit} disabled={busy}>
                    Cancel
                  </button>
                  <button type="button" className="btn-gold" onClick={saveLead} disabled={busy}>
                    {busy ? 'Saving…' : 'Save'}
                  </button>
                </>
              )}
            </div>
          </div>
        </header>

        {loadError && (
          <p className="form-error" role="alert">
            {loadError}
          </p>
        )}

        <div className="page-body">
          <div className="page-body-main">
            <section className="card detail-card">
              <h2 className="card-title">Details</h2>
              <div className="detail-grid">
                <Field
                  label="Company"
                  isEditing={isEditing}
                  value={display.company_name}
                  onChange={(v) => draft && setDraft({ ...draft, company_name: v })}
                />
                <div className="detail-field">
                  <span className="detail-label">Segment</span>
                  {isEditing && draft ? (
                    <select
                      className="detail-input"
                      value={draft.segment}
                      onChange={(e) => setDraft({ ...draft, segment: e.target.value as Segment })}
                      aria-label="Segment"
                    >
                      {SEGMENTS.map((s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="detail-value">{display.segment.replace(/_/g, ' ')}</span>
                  )}
                </div>
                <Field
                  label="Contact name"
                  isEditing={isEditing}
                  value={display.contact_name ?? ''}
                  onChange={(v) => draft && setDraft({ ...draft, contact_name: v })}
                />
                <Field
                  label="Contact email"
                  isEditing={isEditing}
                  type="email"
                  value={display.contact_email ?? ''}
                  onChange={(v) => draft && setDraft({ ...draft, contact_email: v })}
                />
                <Field
                  label="Contact social"
                  isEditing={isEditing}
                  value={display.contact_social ?? ''}
                  onChange={(v) => draft && setDraft({ ...draft, contact_social: v })}
                />
                <div className="detail-field">
                  <span className="detail-label">Website</span>
                  {isEditing && draft ? (
                    <input
                      className="detail-input"
                      value={draft.website_url ?? ''}
                      onChange={(e) => setDraft({ ...draft, website_url: e.target.value })}
                    />
                  ) : display.website_url ? (
                    <a className="link-external" href={display.website_url} target="_blank" rel="noreferrer">
                      {display.website_url}
                    </a>
                  ) : (
                    <span className="detail-value">—</span>
                  )}
                </div>
                <Field
                  label="Creators"
                  isEditing={isEditing}
                  type="number"
                  value={String(display.creator_count)}
                  onChange={(v) => draft && setDraft({ ...draft, creator_count: Number(v) || 0 })}
                />
                <Field
                  label="Est. monthly revenue"
                  isEditing={isEditing}
                  type="number"
                  value={String(display.est_monthly_revenue)}
                  onChange={(v) => draft && setDraft({ ...draft, est_monthly_revenue: Number(v) || 0 })}
                />
                <Field
                  label="Current platforms"
                  isEditing={isEditing}
                  value={display.current_platforms ?? ''}
                  onChange={(v) => draft && setDraft({ ...draft, current_platforms: v })}
                />
                <Field
                  label="Current tools"
                  isEditing={isEditing}
                  value={display.current_tools ?? ''}
                  onChange={(v) => draft && setDraft({ ...draft, current_tools: v })}
                />
                <div className="detail-field detail-field-full">
                  <span className="detail-label">Pain points</span>
                  {isEditing && draft ? (
                    <textarea
                      className="detail-textarea"
                      rows={4}
                      value={draft.pain_points ?? ''}
                      onChange={(e) => setDraft({ ...draft, pain_points: e.target.value })}
                    />
                  ) : (
                    <span className="detail-value detail-multiline">{display.pain_points ?? '—'}</span>
                  )}
                </div>
                <div className="detail-field detail-field-full">
                  <span className="detail-label">Notes</span>
                  {isEditing && draft ? (
                    <textarea
                      className="detail-textarea"
                      rows={4}
                      value={draft.notes ?? ''}
                      onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                    />
                  ) : (
                    <span className="detail-value detail-multiline">{display.notes ?? '—'}</span>
                  )}
                </div>
              </div>
            </section>

            <section className="card timeline-card">
              <h2 className="card-title">Activity</h2>
              <form className="activity-form" onSubmit={addActivity}>
                <select
                  className="filter-select"
                  value={activityType}
                  onChange={(e) => setActivityType(e.target.value as (typeof ACTIVITY_TYPES)[number])}
                  aria-label="Activity type"
                >
                  {ACTIVITY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <input
                  className="filter-input"
                  placeholder="Description"
                  value={activityDescription}
                  onChange={(e) => setActivityDescription(e.target.value)}
                  aria-label="Activity description"
                />
                <button type="submit" className="btn-gold" disabled={activitySaving}>
                  Add
                </button>
              </form>
              <ul className="activity-list">
                {activities.map((a) => (
                  <li key={a.id} className="activity-item">
                    <span className="activity-dot" aria-hidden />
                    <div className="activity-body">
                      <p className="activity-description">{a.description}</p>
                      <div className="activity-meta">
                        <span className="badge badge-activity-type">{a.type.replace(/_/g, ' ')}</span>
                        <time className="activity-date" dateTime={a.created_at}>
                          {new Date(a.created_at).toLocaleString()}
                        </time>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {activities.length === 0 && <p className="empty-state">No activity yet.</p>}
            </section>
          </div>

          <div className="page-body-side">
            <section className="card scoring-card">
              <h2 className="card-title">Scoring</h2>
              <div className="scoring-block">
                <span className="scoring-label">Fit score</span>
                {isEditing && draft ? (
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="scoring-fit-input"
                    value={draft.fit_score}
                    onChange={(e) => setDraft({ ...draft, fit_score: Number(e.target.value) || 0 })}
                  />
                ) : (
                  <span className={`scoring-fit ${fitGold ? 'text-gold' : ''}`}>{display.fit_score}</span>
                )}
              </div>
              <div className="scoring-row">
                <span className="scoring-label">Close probability</span>
                {isEditing && draft ? (
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={1}
                    className="detail-input"
                    value={draft.close_probability}
                    onChange={(e) =>
                      setDraft({ ...draft, close_probability: Number(e.target.value) || 0 })
                    }
                  />
                ) : (
                  <span className="detail-value">{formatPercentDisplay(Number(display.close_probability))}</span>
                )}
              </div>
              <div className="scoring-row">
                <span className="scoring-label">Est. deal value</span>
                {isEditing && draft ? (
                  <input
                    type="number"
                    min={0}
                    className="detail-input"
                    value={draft.est_deal_value}
                    onChange={(e) =>
                      setDraft({ ...draft, est_deal_value: Number(e.target.value) || 0 })
                    }
                  />
                ) : (
                  <span className="detail-value text-gold">{formatMoney(Number(display.est_deal_value))}</span>
                )}
              </div>
              <div className="scoring-row scoring-weighted">
                <span className="scoring-label">Weighted value</span>
                <span className="detail-value text-gold">{formatMoney(w)}</span>
              </div>
            </section>

            <section className="card status-card">
              <h2 className="card-title">Status</h2>
              {isEditing && draft ? (
                <select
                  className="filter-select status-select"
                  value={draft.outreach_status}
                  onChange={(e) =>
                    setDraft({ ...draft, outreach_status: e.target.value as OutreachStatus })
                  }
                  aria-label="Outreach status"
                >
                  {PIPELINE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {statusLabel(s)}
                    </option>
                  ))}
                </select>
              ) : null}
              <ol className="status-pipeline">
                {PIPELINE_STATUSES.map((s) => {
                  const current = display.outreach_status === s
                  return (
                    <li
                      key={s}
                      className={`status-pipeline-step ${current ? 'status-pipeline-step-current' : ''}`}
                    >
                      <span className={`status-dot ${current ? 'status-dot-gold' : ''}`} aria-hidden />
                      <span className="status-pipeline-label">{statusLabel(s)}</span>
                    </li>
                  )
                })}
              </ol>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}

type FieldProps = {
  label: string
  isEditing: boolean
  value: string
  onChange: (v: string) => void
  type?: string
}

function Field({ label, isEditing, value, onChange, type = 'text' }: FieldProps) {
  return (
    <div className="detail-field">
      <span className="detail-label">{label}</span>
      {isEditing ? (
        <input
          className="detail-input"
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <span className="detail-value">{value || '—'}</span>
      )}
    </div>
  )
}

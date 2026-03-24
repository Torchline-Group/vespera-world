'use client'

import { createClient } from '@/lib/supabase-browser'
import Sidebar from '@/components/Sidebar'
import type { Lead, OutreachStatus, Profile, Segment } from '@/lib/types'
import { useRouter } from 'next/navigation'
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'

const PAGE_SIZE = 20

const SEGMENTS: Segment[] = [
  'agency',
  'creator',
  'studio',
  'partner',
  'advertiser',
  'sugar_platform',
]

const STATUSES: OutreachStatus[] = [
  'not_contacted',
  'contacted',
  'replied',
  'meeting_set',
  'negotiating',
  'closed_won',
  'closed_lost',
]

type ScoreFilter = 'any' | '80' | '60' | '40'

const defaultNewLead = {
  company_name: '',
  segment: 'agency' as Segment,
  contact_name: '',
  contact_email: '',
  website_url: '',
  sub_segment: '',
  creator_count: 0,
  fit_score: 0,
  est_deal_value: 0,
  notes: '',
}

function formatMoney(n: number) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

function formatPercent(prob: number) {
  const p = prob > 1 ? prob : prob * 100
  return `${Math.round(p)}%`
}

function statusLabel(s: OutreachStatus) {
  return s.replace(/_/g, ' ')
}

export default function LeadsPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [ready, setReady] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [segment, setSegment] = useState('')
  const [status, setStatus] = useState('')
  const [scoreFilter, setScoreFilter] = useState<ScoreFilter>('any')
  const [page, setPage] = useState(0)

  const [leads, setLeads] = useState<Lead[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalOpen, setModalOpen] = useState(false)
  const [newLead, setNewLead] = useState(defaultNewLead)
  const [savingLead, setSavingLead] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400)
    return () => clearTimeout(t)
  }, [searchInput])

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

      const { data: prof, error: pe } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (cancelled) return
      if (pe) {
        setError(pe.message)
      } else if (prof) {
        setProfile(prof as Profile)
      }
      setReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [router, supabase])

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    setError(null)

    let q = supabase
      .from('leads')
      .select('*', { count: 'exact' })
      .order('fit_score', { ascending: false })

    if (segment) {
      q = q.eq('segment', segment)
    }
    if (status) {
      q = q.eq('outreach_status', status as OutreachStatus)
    }
    if (search) {
      const safe = search.replace(/[%_\\]/g, '')
      if (safe) {
        q = q.ilike('company_name', `%${safe}%`)
      }
    }
    if (scoreFilter === '80') {
      q = q.gte('fit_score', 80)
    } else if (scoreFilter === '60') {
      q = q.gte('fit_score', 60)
    } else if (scoreFilter === '40') {
      q = q.gte('fit_score', 40)
    }

    const from = page * PAGE_SIZE
    const to = from + PAGE_SIZE - 1
    q = q.range(from, to)

    const { data, error: fe, count } = await q

    if (fe) {
      setError(fe.message)
      setLeads([])
      setTotalCount(0)
    } else {
      setLeads((data ?? []) as Lead[])
      setTotalCount(count ?? 0)
    }
    setLoading(false)
  }, [page, scoreFilter, search, segment, status, supabase])

  useEffect(() => {
    if (!ready) return
    fetchLeads()
  }, [fetchLeads, ready])

  useEffect(() => {
    setPage(0)
  }, [segment, status, scoreFilter, search])

  async function handleAddLead(e: FormEvent) {
    e.preventDefault()
    setSavingLead(true)
    setError(null)

    const { error: ie } = await supabase.from('leads').insert({
      company_name: newLead.company_name,
      segment: newLead.segment,
      contact_name: newLead.contact_name || null,
      contact_email: newLead.contact_email || null,
      website_url: newLead.website_url || null,
      sub_segment: newLead.sub_segment || null,
      creator_count: newLead.creator_count,
      fit_score: newLead.fit_score,
      est_deal_value: newLead.est_deal_value,
      notes: newLead.notes || null,
      outreach_status: 'not_contacted',
      est_monthly_revenue: 0,
      close_probability: 0,
    })

    setSavingLead(false)
    if (ie) {
      setError(ie.message)
      return
    }

    setModalOpen(false)
    setNewLead(defaultNewLead)
    await fetchLeads()
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  if (!ready) {
    return (
      <div className="layout layout-loading">
        <p className="muted">Loading…</p>
      </div>
    )
  }

  return (
    <div className="layout">
      <Sidebar user={profile} currentPath="/leads" />
      <main className="main-content">
        <header className="page-header">
          <div className="page-header-text">
            <h1 className="page-title">Prospects</h1>
            <p className="page-subtitle">
              {loading ? 'Loading…' : `${totalCount} prospect${totalCount === 1 ? '' : 's'}`}
            </p>
          </div>
          <button type="button" className="btn-gold" onClick={() => setModalOpen(true)}>
            + Add Prospect
          </button>
        </header>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="filters-row">
          <input
            type="search"
            className="filter-input"
            placeholder="Search company…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search companies"
          />
          <select
            className="filter-select"
            value={segment}
            onChange={(e) => setSegment(e.target.value)}
            aria-label="Segment"
          >
            <option value="">All segments</option>
            {SEGMENTS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <select
            className="filter-select"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Status"
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
          <select
            className="filter-select"
            value={scoreFilter}
            onChange={(e) => setScoreFilter(e.target.value as ScoreFilter)}
            aria-label="Fit score"
          >
            <option value="any">Any score</option>
            <option value="80">80+</option>
            <option value="60">60+</option>
            <option value="40">40+</option>
          </select>
        </div>

        <div className="card">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Segment</th>
                  <th>Sub-type</th>
                  <th>Creators</th>
                  <th>Fit</th>
                  <th>Close %</th>
                  <th>Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {!loading &&
                  leads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="table-row-clickable"
                      onClick={() => router.push(`/leads/${lead.id}`)}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter' || ev.key === ' ') {
                          ev.preventDefault()
                          router.push(`/leads/${lead.id}`)
                        }
                      }}
                      tabIndex={0}
                      role="link"
                      aria-label={`Open ${lead.company_name}`}
                    >
                      <td>
                        <span className="cell-company">{lead.company_name}</span>
                      </td>
                      <td>
                        <span className="badge-gold">{lead.segment.replace(/_/g, ' ')}</span>
                      </td>
                      <td>{lead.sub_segment ?? '—'}</td>
                      <td>{lead.creator_count}</td>
                      <td>
                        <span className={lead.fit_score >= 80 ? 'text-gold' : ''}>{lead.fit_score}</span>
                      </td>
                      <td>{formatPercent(Number(lead.close_probability))}</td>
                      <td>
                        <span className="text-gold">{formatMoney(Number(lead.est_deal_value))}</span>
                      </td>
                      <td>
                        <span className={`badge badge-status-${lead.outreach_status}`}>
                          {statusLabel(lead.outreach_status)}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {loading && <p className="table-loading">Loading prospects…</p>}
          {!loading && leads.length === 0 && <p className="empty-state">No prospects match your filters.</p>}
        </div>

        <div className="pagination">
          <button
            type="button"
            className="btn-outline"
            disabled={page <= 0 || loading}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Previous
          </button>
          <span className="pagination-meta">
            Page {page + 1} of {totalPages}
          </span>
          <button
            type="button"
            className="btn-outline"
            disabled={loading || page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>

        {modalOpen && (
          <div
            className="modal-overlay"
            role="presentation"
            onClick={(ev) => {
              if (ev.target === ev.currentTarget) setModalOpen(false)
            }}
          >
            <div className="modal" role="dialog" aria-modal="true" aria-labelledby="add-lead-title">
              <h2 id="add-lead-title" className="modal-title">
                Add prospect
              </h2>
              <form onSubmit={handleAddLead} className="modal-form">
                <div className="form-group">
                  <label className="form-label" htmlFor="nl-company">
                    Company name
                  </label>
                  <input
                    id="nl-company"
                    required
                    value={newLead.company_name}
                    onChange={(e) => setNewLead((s) => ({ ...s, company_name: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="nl-segment">
                    Segment
                  </label>
                  <select
                    id="nl-segment"
                    required
                    value={newLead.segment}
                    onChange={(e) => setNewLead((s) => ({ ...s, segment: e.target.value as Segment }))}
                  >
                    {SEGMENTS.map((s) => (
                      <option key={s} value={s}>
                        {s.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="nl-contact">
                    Contact name
                  </label>
                  <input
                    id="nl-contact"
                    value={newLead.contact_name}
                    onChange={(e) => setNewLead((s) => ({ ...s, contact_name: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="nl-email">
                    Contact email
                  </label>
                  <input
                    id="nl-email"
                    type="email"
                    value={newLead.contact_email}
                    onChange={(e) => setNewLead((s) => ({ ...s, contact_email: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="nl-web">
                    Website URL
                  </label>
                  <input
                    id="nl-web"
                    type="url"
                    value={newLead.website_url}
                    onChange={(e) => setNewLead((s) => ({ ...s, website_url: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="nl-sub">
                    Sub-segment
                  </label>
                  <input
                    id="nl-sub"
                    value={newLead.sub_segment}
                    onChange={(e) => setNewLead((s) => ({ ...s, sub_segment: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="nl-creators">
                    Creator count
                  </label>
                  <input
                    id="nl-creators"
                    type="number"
                    min={0}
                    value={newLead.creator_count}
                    onChange={(e) =>
                      setNewLead((s) => ({ ...s, creator_count: Number(e.target.value) || 0 }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="nl-fit">
                    Fit score
                  </label>
                  <input
                    id="nl-fit"
                    type="number"
                    min={0}
                    max={100}
                    value={newLead.fit_score}
                    onChange={(e) => setNewLead((s) => ({ ...s, fit_score: Number(e.target.value) || 0 }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="nl-value">
                    Est. deal value
                  </label>
                  <input
                    id="nl-value"
                    type="number"
                    min={0}
                    step="1"
                    value={newLead.est_deal_value}
                    onChange={(e) =>
                      setNewLead((s) => ({ ...s, est_deal_value: Number(e.target.value) || 0 }))
                    }
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="nl-notes">
                    Notes
                  </label>
                  <textarea
                    id="nl-notes"
                    rows={3}
                    value={newLead.notes}
                    onChange={(e) => setNewLead((s) => ({ ...s, notes: e.target.value }))}
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn-outline" onClick={() => setModalOpen(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-gold" disabled={savingLead}>
                    {savingLead ? 'Saving…' : 'Save prospect'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

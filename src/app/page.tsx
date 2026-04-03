'use client'

import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase-browser'
import { SEED_LEADS } from '@/lib/seed-data'
import type { Lead, OutreachStatus, Profile, Segment } from '@/lib/types'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

const SEGMENT_COLORS: Record<Segment, string> = {
  agency: '#c9a34f',
  creator: '#60a5fa',
  partner: '#4ade80',
  advertiser: '#fbbf24',
  studio: '#c084fc',
  sugar_platform: '#f87171',
}

function formatUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n)
}

function labelSegment(segment: string): string {
  return segment.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function labelStatus(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

type PipelineRow = Pick<Lead, 'est_deal_value' | 'close_probability' | 'segment' | 'outreach_status'>

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()
  const pathname = usePathname()

  const [ready, setReady] = useState(false)
  const [sidebarUser, setSidebarUser] = useState<{ id: string; full_name: string; role: string } | null>(null)

  const [totalLeads, setTotalLeads] = useState(0)
  const [hotLeads, setHotLeads] = useState(0)
  const [pipelineValue, setPipelineValue] = useState(0)
  const [closedWon, setClosedWon] = useState(0)
  const [bySegment, setBySegment] = useState<{ segment: string; count: number }[]>([])
  const [byStatus, setByStatus] = useState<{ status: string; count: number }[]>([])
  const [topLeads, setTopLeads] = useState<Lead[]>([])

  const loadDashboard = useCallback(async () => {
    const [
      { count: total, error: totalErr },
      { count: hot, error: hotErr },
      { data: pipelineRows, error: pipeErr },
      { data: top, error: topErr },
    ] = await Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }),
      supabase.from('leads').select('id', { count: 'exact', head: true }).gte('fit_score', 80),
      supabase.from('leads').select('est_deal_value, close_probability, segment, outreach_status'),
      supabase.from('leads').select('*').order('fit_score', { ascending: false }).limit(8),
    ])

    if (totalErr) console.error(totalErr)
    if (hotErr) console.error(hotErr)
    if (pipeErr) console.error(pipeErr)
    if (topErr) console.error(topErr)

    setTotalLeads(total ?? 0)
    setHotLeads(hot ?? 0)

    const rows = (pipelineRows ?? []) as PipelineRow[]
    let pipe = 0
    let won = 0
    const segMap = new Map<string, number>()
    const statMap = new Map<string, number>()

    for (const row of rows) {
      const ev = Number(row.est_deal_value) || 0
      const cp = Number(row.close_probability) || 0
      pipe += ev * cp
      if (row.outreach_status === 'closed_won') won += 1
      const seg = row.segment ?? 'unknown'
      segMap.set(seg, (segMap.get(seg) ?? 0) + 1)
      const st = row.outreach_status ?? 'unknown'
      statMap.set(st, (statMap.get(st) ?? 0) + 1)
    }

    setPipelineValue(pipe)
    setClosedWon(won)
    setBySegment(
      [...segMap.entries()]
        .map(([segment, count]) => ({ segment, count }))
        .sort((a, b) => b.count - a.count)
    )
    setByStatus(
      [...statMap.entries()]
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count)
    )
    setTopLeads((top ?? []) as Lead[])
  }, [supabase])

  useEffect(() => {
    let cancelled = false

    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/login')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError && profileError.code !== 'PGRST116') {
        console.error(profileError)
      }

      const p = profile as Profile | null
      if (!cancelled) {
        setSidebarUser({
          id: user.id,
          full_name: p?.full_name ?? (user.user_metadata?.full_name as string) ?? user.email?.split('@')[0] ?? 'User',
          role: p?.role ?? (user.user_metadata?.role as string) ?? 'sales',
        })
      }

      const { count: initialCount, error: countErr } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })

      if (countErr) {
        console.error(countErr)
      } else if ((initialCount ?? 0) === 0) {
        const { error: insertErr } = await supabase.from('leads').insert(SEED_LEADS)
        if (insertErr) console.error(insertErr)
      }

      if (!cancelled) {
        await loadDashboard()
        setReady(true)
      }
    }

    void init()
    return () => {
      cancelled = true
    }
  }, [supabase, router, loadDashboard])

  if (!ready || !sidebarUser) {
    return (
      <div className="layout layout-loading">
        <div className="main-content main-content-loading">
          <p className="muted">Loading command center…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="layout">
      <Sidebar user={sidebarUser} currentPath={pathname ?? '/'} />
      <main className="main-content">
        <header className="page-header">
          <div className="page-header-text">
            <h1 className="page-title">Command Center</h1>
            <p className="page-subtitle">Vespera pipeline, commerce, and portal overview</p>
          </div>
          <div className="mode-switch-row">
            <Link href="/leads" className="btn-gold">
              View Prospects
            </Link>
            <Link href="/commerce" className="btn-ghost">
              Commerce
            </Link>
            <Link href="/portal" className="btn-ghost">
              Portal
            </Link>
          </div>
        </header>

        <div className="page-body">
          <div className="trust-banner trust-banner--inline-shield" role="note">
            <span className="trust-banner-icon" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
                />
              </svg>
            </span>
            <p className="trust-banner-dashboard-copy">
              All prospect data is encrypted at rest. Vespera never shares customer information with third parties without
              explicit consent.
            </p>
          </div>

          <section className="stats-grid" aria-label="Pipeline statistics">
            <article className="stat-card">
              <p className="stat-label">Total Prospects</p>
              <p className="stat-value">{totalLeads}</p>
            </article>
            <article className="stat-card stat-card-gold">
              <p className="stat-label">Hot Leads</p>
              <p className="stat-value">{hotLeads}</p>
            </article>
            <article className="stat-card stat-card-gold">
              <p className="stat-label">Pipeline Value</p>
              <p className="stat-value">{formatUsd(pipelineValue)}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Closed Won</p>
              <p className="stat-value">{closedWon}</p>
            </article>
          </section>

          <div className="dashboard-two-col">
            <section className="card">
              <h2 className="card-title">By Segment</h2>
              <ul className="breakdown-list">
                {bySegment.map(({ segment, count }) => (
                  <li key={segment} className="breakdown-row">
                    <span
                      className="breakdown-dot"
                      style={{
                        backgroundColor: SEGMENT_COLORS[segment as Segment] ?? '#94a3b8',
                      }}
                    />
                    <span className="breakdown-label">{labelSegment(segment)}</span>
                    <span className="breakdown-count">{count}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card">
              <h2 className="card-title">By Status</h2>
              <ul className="breakdown-list">
                {byStatus.map(({ status, count }) => (
                  <li key={status} className="breakdown-row">
                    <span className="breakdown-dot breakdown-dot-status" />
                    <span className="breakdown-label">{labelStatus(status)}</span>
                    <span className="breakdown-count">{count}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="card card-table-wrap">
            <h2 className="card-title">Top Prospects by Fit Score</h2>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Company</th>
                    <th scope="col">Segment</th>
                    <th scope="col">Fit Score</th>
                    <th scope="col">Close %</th>
                    <th scope="col">Deal Value</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {topLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className="data-table-row-clickable"
                      onClick={() => router.push(`/leads/${lead.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          router.push(`/leads/${lead.id}`)
                        }
                      }}
                      tabIndex={0}
                      role="link"
                      aria-label={`Open ${lead.company_name}`}
                    >
                      <td>{lead.company_name}</td>
                      <td>
                        <span className="badge-gold">{labelSegment(lead.segment)}</span>
                      </td>
                      <td>
                        <div className="score-cell">
                          <div className="score-bar" aria-hidden>
                            <div className="score-fill" style={{ width: `${Math.min(100, lead.fit_score)}%` }} />
                          </div>
                          <span className="score-bar-value">{lead.fit_score}</span>
                        </div>
                      </td>
                      <td>{Math.round((lead.close_probability ?? 0) * 100)}%</td>
                      <td>
                        <span className="text-gold">{formatUsd(lead.est_deal_value ?? 0)}</span>
                      </td>
                      <td>
                        <span className="badge">{labelStatus(lead.outreach_status as OutreachStatus)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}

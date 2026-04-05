'use client'

export const dynamic = 'force-dynamic'

import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase-browser'
import { Lead, Profile } from '@/lib/types'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'

export default function DsersPage() {
  const supabase = useMemo(() => (typeof window === 'undefined' ? null : createClient()), [])
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [leads, setLeads] = useState<Lead[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(
    async (currentUserId: string) => {
      if (!supabase) return
      const { data, error: e } = await supabase
        .from('leads')
        .select('*')
        .in('outreach_status', ['not_contacted', 'contacted', 'replied', 'meeting_set'])
        .order('fit_score', { ascending: false })
        .limit(60)
      if (e) {
        setError(e.message)
        setLeads([])
        return
      }
      setLeads((data ?? []) as Lead[])
      const { error: activityError } = await supabase.from('activities').insert({
        lead_id: (data?.[0] as Lead | undefined)?.id ?? null,
        type: 'note',
        description: "DS'ers workspace opened",
        created_by: currentUserId,
      })
      if (activityError) {
        console.warn("Could not log DS'ers workspace activity", activityError.message)
      }
    },
    [supabase],
  )

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
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (cancelled) return
      setProfile((p as Profile) ?? null)
      await loadData(user.id)
      setReady(true)
    })()
    return () => {
      cancelled = true
    }
  }, [router, supabase, loadData])

  async function assignToMe(leadId: number) {
    if (!profile || !supabase) return
    const { error: e } = await supabase
      .from('leads')
      .update({ assigned_to: profile.id, updated_at: new Date().toISOString() })
      .eq('id', leadId)
    if (e) {
      setError(e.message)
      return
    }
    setLeads((prev) => prev.map((lead) => (lead.id === leadId ? { ...lead, assigned_to: profile.id } : lead)))
  }

  async function markContacted(leadId: number) {
    if (!supabase) return
    const { error: e } = await supabase
      .from('leads')
      .update({ outreach_status: 'contacted', updated_at: new Date().toISOString() })
      .eq('id', leadId)
    if (e) {
      setError(e.message)
      return
    }
    setLeads((prev) => prev.map((lead) => (lead.id === leadId ? { ...lead, outreach_status: 'contacted' } : lead)))
  }

  if (!ready) return <div className="layout layout-loading"><div className="main-content main-content-loading"><p>Loading DS&apos;ers workspace…</p></div></div>

  return (
    <div className="layout">
      <Sidebar
        user={profile ? { id: profile.id, full_name: profile.full_name, role: profile.role } : null}
        currentPath="/dsers"
      />
      <main className="main-content">
        <header className="page-header">
          <div className="page-header-text">
            <h1 className="page-title">DS&apos;ers Workspace</h1>
            <p className="page-subtitle">Fast assignment, follow-up cadence, and portal handoff-ready prospects.</p>
          </div>
        </header>
        <div className="page-body">
          {error ? <p className="form-error">{error}</p> : null}
          <section className="card">
            <div className="card-body">
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr><th>Company</th><th>Segment</th><th>Fit</th><th>Status</th><th>Assigned</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => (
                      <tr key={lead.id}>
                        <td>{lead.company_name}</td>
                        <td>{lead.segment}</td>
                        <td>{lead.fit_score}</td>
                        <td>{lead.outreach_status}</td>
                        <td>{lead.assigned_to ? 'Assigned' : 'Unassigned'}</td>
                        <td className="table-action-row">
                          <button className="btn-ghost" onClick={() => assignToMe(lead.id)}>Assign to me</button>
                          <button className="btn-gold" onClick={() => markContacted(lead.id)}>Mark contacted</button>
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

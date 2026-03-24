'use client'

import { createClient } from '@/lib/supabase-browser'
import type { UserRole } from '@/lib/types'
import { useRouter } from 'next/navigation'
import { useCallback, useMemo } from 'react'

export interface SidebarUserProps {
  id: string
  full_name: string
  role: UserRole | string
}

export interface SidebarProps {
  /** When null (e.g. profile still loading), footer shows a minimal placeholder. */
  user: SidebarUserProps | null
  currentPath: string
}

function initialsFromName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard' },
  { href: '/leads', label: 'Prospects' },
  { href: '/chat', label: 'Inbox' },
  { href: '/integrations', label: 'Integrations' },
  { href: '/trust', label: 'Trust & Safety' },
] as const

function IconDashboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75A2.25 2.25 0 0115.75 13.5H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25zM13.5 6A2.25 2.25 0 0115.75 3.75H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25A2.25 2.25 0 0113.5 8.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25v-2.25z"
      />
    </svg>
  )
}

function IconPeople() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.478-2.136M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
      />
    </svg>
  )
}

function IconChat() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337L5.05 21l1.395-3.72C5.512 15.042 4 13.574 4 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
      />
    </svg>
  )
}

function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
      />
    </svg>
  )
}

function IconPlug() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 7.5V4.875m7.5 2.625V4.875M6.75 9.75h10.5M12 9.75v8.25m0 0h3a3 3 0 003-3V12.75H6V15a3 3 0 003 3h3z"
      />
    </svg>
  )
}

const ICONS = [IconDashboard, IconPeople, IconChat, IconPlug, IconShield] as const

export default function Sidebar({ user, currentPath }: SidebarProps) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const displayName = user?.full_name ?? 'Account'
  const displayRole = user?.role ?? '—'

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }, [supabase])

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          Ves<span>pera</span>
        </div>
        <p className="sidebar-subtitle">CRM</p>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        <div className="nav-section">Navigation</div>
        <ul className="nav-list">
          {NAV_ITEMS.map((item, i) => {
            const Icon = ICONS[i]
            const active = currentPath === item.href || (item.href !== '/' && currentPath.startsWith(item.href))
            return (
              <li key={item.href}>
                <button
                  type="button"
                  className={`nav-item${active ? ' active' : ''}`}
                  onClick={() => router.push(item.href)}
                >
                  <span className="nav-item-icon">
                    <Icon />
                  </span>
                  <span className="nav-item-label">{item.label}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="avatar" aria-hidden>
            {user ? initialsFromName(user.full_name) : '…'}
          </div>
          <div className="sidebar-user-text">
            <div className="sidebar-user-name">{displayName}</div>
            <div className="sidebar-user-role">{displayRole}</div>
          </div>
        </div>
        <button type="button" className="sidebar-sign-out" onClick={handleSignOut}>
          Sign out
        </button>
      </div>
    </aside>
  )
}

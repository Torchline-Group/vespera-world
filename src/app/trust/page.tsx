'use client'

import Sidebar from '@/components/Sidebar'
import { createClient } from '@/lib/supabase-browser'
import type { Profile } from '@/lib/types'
import { useRouter } from 'next/navigation'
import { type ReactNode, useEffect, useMemo, useState } from 'react'

function IconShieldLarge({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--vespera-gold)"
      strokeWidth={1.35}
      width={40}
      height={40}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
      />
    </svg>
  )
}

function Principle({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="trust-principle">
      <div className="trust-principle-title">{title}</div>
      <p className="trust-principle-desc">{children}</p>
    </div>
  )
}

export default function TrustPage() {
  const supabase = useMemo(() => createClient(), [])
  const router = useRouter()

  const [ready, setReady] = useState(false)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

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
        setLoadError(pe.message)
      } else if (prof) {
        setProfile(prof as Profile)
      }
      setReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [router, supabase])

  if (!ready || !profile) {
    return (
      <div className="layout">
        <div className="main-content">
          <div className="page-body">
            <p className="chat-list-hint">{loadError ?? 'Loading…'}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="layout">
      <Sidebar
        user={{
          id: profile.id,
          full_name: profile.full_name,
          role: profile.role,
        }}
        currentPath="/trust"
      />
      <div className="main-content">
        <header className="page-header">
          <h1 className="page-title">Trust &amp; Safety</h1>
          <p className="page-subtitle">How Vespera protects creators, agencies, and fans</p>
        </header>
        <div className="page-body page-body-narrow">
          <div className="trust-banner trust-banner--hero">
            <IconShieldLarge className="trust-banner-hero-icon" />
            <p className="trust-banner-hero-text">
              Vespera is built for the people. We believe creators deserve platforms that respect their
              privacy, their work, and their communities — without selling them out to advertisers or
              data brokers.
            </p>
          </div>

          <section className="card trust-section">
            <div className="card-header">
              <h2 className="card-title">Our Privacy Commitment</h2>
            </div>
            <div className="card-body">
              <Principle title="We never sell your data">
                Your information is not our product. We do not monetize personal data, browsing behavior,
                or message content to third parties.
              </Principle>
              <Principle title="We don&apos;t share unless there&apos;s a threat">
                We disclose information only when required by law or when necessary to address credible
                safety threats — for example, child safety, imminent harm, or fraud — and only to the
                extent legally and ethically justified.
              </Principle>
              <Principle title="Bank-level encryption everywhere">
                Data in transit uses TLS 1.3. Sensitive data at rest is protected with AES-256. In-app chat
                uses end-to-end encryption so conversations stay between participants.
              </Principle>
              <Principle title="Zero-knowledge architecture">
                We collect the minimum data needed to run the platform. Passwords are hashed with bcrypt.
                Payment tokens are vaulted — we never store full card numbers on our servers.
              </Principle>
              <Principle title="You own your audience">
                Export subscriber and contact data when you need it. We don&apos;t trap you with lock-in;
                your relationships belong to you.
              </Principle>
            </div>
          </section>

          <section className="card trust-section">
            <div className="card-header">
              <h2 className="card-title">For Creators</h2>
            </div>
            <div className="card-body">
              <Principle title="Fair compensation &amp; transparent fees">
                Payouts and platform fees are structured to be understandable upfront — no hidden cuts
                buried in fine print.
              </Principle>
              <Principle title="Anti-exploitation tools">
                We support DMCA workflows and content fingerprinting to help you protect your intellectual
                property from misuse.
              </Principle>
              <Principle title="Consent is non-negotiable">
                Every interaction on Vespera is built on explicit consent. Coercion, harassment, and
                non-consensual content have no place here.
              </Principle>
            </div>
          </section>

          <section className="card trust-section">
            <div className="card-header">
              <h2 className="card-title">For Fans</h2>
            </div>
            <div className="card-body">
              <Principle title="Authenticity guarantee">
                Our $129/mo VIP tier includes verified real-creator chat — so you know you are speaking
                with the creator you support, not an impersonator.
              </Principle>
              <Principle title="No deception or bait-and-switch">
                What you subscribe to is what you get. We prohibit misleading listings, fake previews, and
                predatory upsells.
              </Principle>
              <Principle title="Discreet billing">
                Charges appear with neutral descriptors where possible so your privacy is respected on
                statements.
              </Principle>
            </div>
          </section>

          <section className="card trust-section">
            <div className="card-header">
              <h2 className="card-title">For Agencies</h2>
            </div>
            <div className="card-body">
              <Principle title="Isolated data environments">
                Agency and roster data can be segmented so teams only see what they are authorized to
                access.
              </Principle>
              <Principle title="White-label integrity">
                When you represent Vespera-powered experiences to clients, our infrastructure backs your
                brand without leaking data across tenants.
              </Principle>
              <Principle title="Transparent commission splits">
                Revenue sharing between creators, agencies, and the platform is documented and auditable —
                fewer disputes, clearer partnerships.
              </Principle>
            </div>
          </section>

          <section className="card trust-section">
            <div className="card-header">
              <h2 className="card-title">What Vespera Is Not</h2>
            </div>
            <div className="card-body">
              <p className="trust-notice">
                Vespera is a creator-to-customer content and virtual marketplace. We do not offer,
                facilitate, or condone{' '}
                <span className="trust-emphasis">
                  prostitution or any illegal activity
                </span>
                . Our platform is for digital content, virtual experiences, and e-commerce only.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

'use client'

export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase-browser'
import { FormEvent, useMemo, useState } from 'react'

export default function LoginPage() {
  const supabase = useMemo(() => createClient(), [])
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [skipLoading, setSkipLoading] = useState(false)

  // Option A (recommended): Supabase → Authentication → Providers → Anonymous (on). No env vars required.
  // Hide Skip only when NEXT_PUBLIC_SHOW_AUTH_SKIP=false (e.g. hardened production).
  const showSkip = process.env.NEXT_PUBLIC_SHOW_AUTH_SKIP !== 'false'

  async function handleSkip() {
    setError(null)
    setInfo(null)
    setSkipLoading(true)
    try {
      const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously()
      if (!anonError && anonData.session) {
        window.location.href = '/'
        return
      }

      const res = await fetch('/api/auth/demo-skip', { method: 'POST' })
      if (res.ok) {
        window.location.href = '/'
        return
      }

      let message =
        'Could not start a guest session. In Supabase Dashboard → Authentication → Providers, enable Anonymous sign-ins, then try Skip again.'
      try {
        const body = (await res.json()) as { error?: string }
        if (body.error && res.status === 403) {
          message = `${message} (Optional fallback: set DEMO_SKIP_AUTH=true and DEMO_LOGIN_EMAIL / DEMO_LOGIN_PASSWORD on the server.)`
        } else if (body.error && res.status !== 403) {
          message = `${anonError?.message ?? 'Anonymous sign-in failed.'} ${body.error}`
        }
      } catch {
        if (anonError?.message) {
          message = `${anonError.message} Enable Anonymous sign-in in Supabase, or configure server demo credentials.`
        }
      }
      setError(message)
    } finally {
      setSkipLoading(false)
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)

    try {
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) {
          setError(signInError.message)
          return
        }
        window.location.href = '/'
        return
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            role: 'sales',
          },
        },
      })
      if (signUpError) {
        setError(signUpError.message)
        return
      }
      if (data.session) {
        window.location.href = '/'
        return
      }
      setInfo('Check your email to confirm your account before signing in.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-logo">
          Ves<span>pera</span>
        </h1>
        <p className="login-subtitle">Creator Revenue Management</p>

        <div className="trust-banner">Bank-level encryption · Zero-knowledge architecture</div>

        {showSkip ? (
          <div className="login-skip-row">
            <button
              type="button"
              className="btn-skip"
              onClick={() => void handleSkip()}
              disabled={skipLoading || loading}
            >
              {skipLoading ? 'Starting…' : 'Skip'}
            </button>
            <p className="login-skip-hint">
              Continue as a guest — no email or password (requires Anonymous sign-in in Supabase).
            </p>
          </div>
        ) : null}

        <form onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div className="form-group">
              <label className="form-label" htmlFor="full-name">
                Full name
              </label>
              <input
                id="full-name"
                name="full-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={mode === 'signup'}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error && (
            <div className="form-group">
              <p role="alert">{error}</p>
            </div>
          )}
          {info && (
            <div className="form-group">
              <p role="status">{info}</p>
            </div>
          )}

          <button className="btn-gold" type="submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="login-subtitle">
          {mode === 'login' ? (
            <>
              Need an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup')
                  setError(null)
                  setInfo(null)
                }}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login')
                  setError(null)
                  setInfo(null)
                }}
              >
                Sign in
              </button>
            </>
          )}
        </p>

        <p className="login-footer">Your data never leaves your infrastructure.</p>
      </div>
    </div>
  )
}

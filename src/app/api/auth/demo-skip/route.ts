import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

function demoSkipAllowed() {
  return (
    process.env.NODE_ENV === 'development' ||
    process.env.DEMO_SKIP_AUTH === 'true' ||
    process.env.DEMO_SKIP_AUTH === '1'
  )
}

export async function POST() {
  if (!demoSkipAllowed()) {
    return NextResponse.json({ error: 'Demo skip is not enabled for this environment.' }, { status: 403 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  if (!url || !anonKey) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 500 })
  }

  const email = process.env.DEMO_LOGIN_EMAIL?.trim()
  const password = process.env.DEMO_LOGIN_PASSWORD
  if (!email || !password) {
    return NextResponse.json(
      { error: 'Demo login is not configured (set DEMO_LOGIN_EMAIL and DEMO_LOGIN_PASSWORD).' },
      { status: 400 }
    )
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
      },
    },
  })

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}

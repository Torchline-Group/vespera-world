import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()

  // During build-time prerender, client components can execute on the server.
  // Use a harmless placeholder client there so missing env vars don't fail the build.
  if (!url || !anonKey) {
    if (typeof window === 'undefined') {
      return createBrowserClient('http://127.0.0.1:54321', 'public-anon-placeholder')
    }
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.')
  }

  return createBrowserClient(url, anonKey)
}

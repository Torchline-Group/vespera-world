import { createAdminClient } from '@/lib/supabase-admin'
import { StorefrontMode } from '@/lib/types'
import { NextRequest, NextResponse } from 'next/server'

const KEY = 'storefront_mode'

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', KEY)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ mode: (data?.value as StorefrontMode | undefined) ?? 'headless' })
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { mode?: StorefrontMode } | null
  const mode = body?.mode
  if (mode !== 'headless' && mode !== 'liquid') {
    return NextResponse.json({ error: 'mode must be headless or liquid' }, { status: 400 })
  }
  const supabase = createAdminClient()
  const { error } = await supabase.from('app_settings').upsert({ key: KEY, value: mode }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, mode })
}

import { parseShopifyCsv } from '@/lib/shopify-csv'
import { createAdminClient } from '@/lib/supabase-admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { csv?: string } | null
  const csv = body?.csv?.trim()
  if (!csv) return NextResponse.json({ error: 'csv is required' }, { status: 400 })

  let supabase
  try {
    supabase = createAdminClient()
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Supabase admin client unavailable' },
      { status: 500 },
    )
  }

  const parsed = parseShopifyCsv(csv)
  if (parsed.rows.length === 0) return NextResponse.json({ ok: true, imported: 0 })

  const { error } = await supabase.from('products').upsert(parsed.rows, { onConflict: 'handle' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, imported: parsed.rows.length })
}

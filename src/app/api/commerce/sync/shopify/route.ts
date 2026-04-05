import { MOCK_PRODUCTS } from '@/lib/mock-catalog'
import { fetchShopifyProducts, hasShopifyCredentials } from '@/lib/shopify'
import { createAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'

export async function POST() {
  let supabase
  try {
    supabase = createAdminClient()
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Supabase admin client unavailable' },
      { status: 500 },
    )
  }

  try {
    const rows = hasShopifyCredentials() ? await fetchShopifyProducts(100) : MOCK_PRODUCTS
    if (rows.length === 0) {
      return NextResponse.json({ ok: true, imported: 0, source: 'empty' })
    }

    const { error } = await supabase
      .from('products')
      .upsert(rows, { onConflict: 'handle', ignoreDuplicates: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      ok: true,
      imported: rows.length,
      source: hasShopifyCredentials() ? 'shopify' : 'mock',
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Sync failed' }, { status: 500 })
  }
}

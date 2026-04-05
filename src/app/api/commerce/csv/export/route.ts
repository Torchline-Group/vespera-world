import { toShopifyCsv } from '@/lib/shopify-csv'
import { createAdminClient } from '@/lib/supabase-admin'
import { NextResponse } from 'next/server'

export async function GET() {
  let supabase
  try {
    supabase = createAdminClient()
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Supabase admin client unavailable' },
      { status: 500 },
    )
  }

  const { data, error } = await supabase
    .from('products')
    .select(
      'handle,title,body_html,vendor,product_type,tags,status,price,compare_at_price,sku,inventory_qty,featured_image_url',
    )
    .order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const csv = toShopifyCsv(data ?? [])
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="vespera-shopify-export.csv"',
    },
  })
}

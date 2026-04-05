import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

type CheckoutProvider = 'snipcart' | 'samcart'

const PROVIDER_KEY = 'checkout_provider'
const SNIPCART_KEY = 'snipcart_public_api_key'
const SAMCART_KEY = 'samcart_checkout_url'

function normalizeProvider(value: unknown): CheckoutProvider {
  return value === 'samcart' ? 'samcart' : 'snipcart'
}

export async function GET() {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('app_settings')
      .select('key,value')
      .in('key', [PROVIDER_KEY, SNIPCART_KEY, SAMCART_KEY])

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const map = new Map((data ?? []).map((row) => [row.key, row.value]))
    return NextResponse.json({
      provider: normalizeProvider(map.get(PROVIDER_KEY)),
      snipcartPublicApiKey: map.get(SNIPCART_KEY) ?? '',
      samcartCheckoutUrl: map.get(SAMCART_KEY) ?? '',
    })
  } catch {
    // Keep marketplace usable even when admin credentials are not configured.
    return NextResponse.json({
      provider: 'snipcart',
      snipcartPublicApiKey: '',
      samcartCheckoutUrl: '',
    })
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as
    | {
        provider?: CheckoutProvider
        snipcartPublicApiKey?: string
        samcartCheckoutUrl?: string
      }
    | null

  const provider = normalizeProvider(body?.provider)
  const snipcartPublicApiKey = body?.snipcartPublicApiKey?.trim() ?? ''
  const samcartCheckoutUrl = body?.samcartCheckoutUrl?.trim() ?? ''

  const { error } = await supabase.from('app_settings').upsert(
    [
      { key: PROVIDER_KEY, value: provider },
      { key: SNIPCART_KEY, value: snipcartPublicApiKey },
      { key: SAMCART_KEY, value: samcartCheckoutUrl },
    ],
    { onConflict: 'key' },
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, provider, snipcartPublicApiKey, samcartCheckoutUrl })
}

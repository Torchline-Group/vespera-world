import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('portal_forms')
    .select('*')
    .eq('created_by', user.id)
    .order('updated_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ forms: data ?? [] })
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { title?: string; description?: string; fields_json?: string; created_by?: string }
    | null

  const title = body?.title?.trim()
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })
  const fields = body?.fields_json?.trim() || '[]'

  const supabase = await createClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('portal_forms')
    .insert({
      title,
      description: body?.description?.trim() || null,
      fields_json: fields,
      status: 'published',
      created_by: user.id,
    })
    .select('*')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, form: data })
}

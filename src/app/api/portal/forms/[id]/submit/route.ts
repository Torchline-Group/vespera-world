import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const formId = Number(id)
  if (!Number.isFinite(formId) || formId <= 0) {
    return NextResponse.json({ error: 'Invalid form id' }, { status: 400 })
  }

  const body = (await req.json().catch(() => null)) as { payload?: Record<string, unknown> } | null
  const payload = body?.payload
  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'payload is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: form, error: formErr } = await supabase
    .from('portal_forms')
    .select('id,created_by,status')
    .eq('id', formId)
    .single()

  if (formErr || !form) {
    return NextResponse.json({ error: formErr?.message ?? 'Form not found' }, { status: 404 })
  }
  if (form.created_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (form.status === 'archived') {
    return NextResponse.json({ error: 'Form is archived' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('portal_form_submissions')
    .insert({
      form_id: formId,
      submitted_by: user.id,
      payload_json: JSON.stringify(payload),
    })
    .select('id,created_at')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? 'Could not submit form' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, submission: data })
}

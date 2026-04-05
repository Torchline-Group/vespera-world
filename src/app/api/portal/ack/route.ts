import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as
    | { title?: string; content?: string; signer_name?: string; signer_email?: string; created_by?: string }
    | null

  const title = body?.title?.trim()
  const content = body?.content?.trim()
  const signerName = body?.signer_name?.trim()

  if (!title || !content || !signerName) {
    return NextResponse.json(
      { error: 'title, content, and signer_name are required' },
      { status: 400 },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('portal_ack_signatures')
    .insert({
      title,
      content,
      signer_name: signerName,
      signer_email: body?.signer_email?.trim() || null,
      signed_at: new Date().toISOString(),
      signer_ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      signer_user_agent: req.headers.get('user-agent') || null,
      created_by: user.id,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, signature: data })
}

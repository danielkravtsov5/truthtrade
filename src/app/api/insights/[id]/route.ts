import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('insights')
    .select(`
      id, body, created_at, updated_at,
      user:users!insights_user_id_fkey(id, username, display_name, avatar_url),
      like_count:insight_likes(count),
      comment_count:insight_comments(count)
    `)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  if (user) {
    const { data: like } = await supabase
      .from('insight_likes')
      .select('insight_id')
      .eq('user_id', user.id)
      .eq('insight_id', id)
      .maybeSingle()

    ;(data as Record<string, unknown>).user_has_liked = !!like
  }

  return NextResponse.json(data)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { body } = await req.json()
  const trimmed = body?.trim()

  if (!trimmed || trimmed.length > 1000) {
    return NextResponse.json({ error: 'Body must be 1-1000 characters' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('insights')
    .update({ body: trimmed })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('insights')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ deleted: true })
}

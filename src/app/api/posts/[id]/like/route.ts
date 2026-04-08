import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('likes')
    .insert({ user_id: user.id, post_id: id })

  if (error && error.code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Create notification for post owner (non-blocking)
  const { data: post } = await supabase
    .from('posts')
    .select('user_id')
    .eq('id', id)
    .single()

  if (post && post.user_id !== user.id) {
    await supabase
      .from('notifications')
      .insert({
        user_id: post.user_id,
        actor_id: user.id,
        type: 'like',
        post_id: id,
      })
      .select()
      .maybeSingle() // unique index handles duplicates
  }

  return NextResponse.json({ liked: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase
    .from('likes')
    .delete()
    .eq('user_id', user.id)
    .eq('post_id', id)

  return NextResponse.json({ liked: false })
}

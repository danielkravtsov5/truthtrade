import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('insight_likes')
    .insert({ user_id: user.id, insight_id: id })

  if (error && error.code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Create notification for insight owner (non-blocking)
  const { data: insight } = await supabase
    .from('insights')
    .select('user_id')
    .eq('id', id)
    .single()

  if (insight && insight.user_id !== user.id) {
    await supabase
      .from('notifications')
      .insert({
        user_id: insight.user_id,
        actor_id: user.id,
        type: 'insight_like',
        insight_id: id,
      })
      .select()
      .maybeSingle()
  }

  return NextResponse.json({ liked: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase
    .from('insight_likes')
    .delete()
    .eq('user_id', user.id)
    .eq('insight_id', id)

  return NextResponse.json({ liked: false })
}

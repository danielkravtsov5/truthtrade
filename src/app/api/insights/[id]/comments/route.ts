import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('insight_comments')
    .select('id, body, created_at, user:users!insight_comments_user_id_fkey(id, username, display_name, avatar_url)')
    .eq('insight_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { body } = await req.json()
  if (!body?.trim()) return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 })

  const { data, error } = await supabase
    .from('insight_comments')
    .insert({ user_id: user.id, insight_id: id, body: body.trim() })
    .select('id, body, created_at, user:users!insight_comments_user_id_fkey(id, username, display_name, avatar_url)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
        type: 'insight_comment',
        insight_id: id,
      })
  }

  return NextResponse.json(data)
}

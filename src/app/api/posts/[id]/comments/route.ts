import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('comments')
    .select('id, body, created_at, user:users!comments_user_id_fkey(id, username, display_name, avatar_url)')
    .eq('post_id', id)
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
    .from('comments')
    .insert({ user_id: user.id, post_id: id, body: body.trim() })
    .select('id, body, created_at, user:users!comments_user_id_fkey(id, username, display_name, avatar_url)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

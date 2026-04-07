import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { analysis } = await req.json()

  const { data, error } = await supabase
    .from('posts')
    .update({ analysis })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('posts')
    .select(`
      id, analysis, created_at, updated_at,
      user:users(id, username, display_name, avatar_url),
      trade:trades(id, ticker, side, quantity, entry_price, exit_price, pnl, pnl_pct, opened_at, closed_at, broker),
      like_count:likes(count),
      comment_count:comments(count),
      comments(id, body, created_at, user:users(id, username, display_name, avatar_url))
    `)
    .eq('id', id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  return NextResponse.json(data)
}

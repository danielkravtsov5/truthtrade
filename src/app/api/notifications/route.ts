import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const cursor = searchParams.get('cursor')
  const unreadOnly = searchParams.get('unread_only') === 'true'
  const limit = 20

  // Get unread count
  const { count: unread_count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('read', false)

  let query = supabase
    .from('notifications')
    .select(`
      id, type, post_id, read, created_at,
      actor:users!notifications_actor_id_fkey(id, username, display_name, avatar_url),
      post:posts!notifications_post_id_fkey(id, trade:trades(ticker, side, pnl))
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (unreadOnly) {
    query = query.eq('read', false)
  }

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data: notifications, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const nextCursor = notifications && notifications.length === limit
    ? notifications[notifications.length - 1].created_at
    : null

  return NextResponse.json({ notifications, nextCursor, unread_count: unread_count ?? 0 })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()

  if (body.all) {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)
  } else if (Array.isArray(body.ids) && body.ids.length > 0) {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .in('id', body.ids)
  }

  return NextResponse.json({ ok: true })
}

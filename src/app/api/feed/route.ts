import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { searchParams } = req.nextUrl
  const type = searchParams.get('type') ?? 'explore' // 'following' | 'explore'
  const cursor = searchParams.get('cursor')           // ISO date for pagination
  const limit = 20

  let query = supabase
    .from('posts')
    .select(`
      id, analysis, created_at, updated_at,
      user:users(id, username, display_name, avatar_url),
      trade:trades(id, ticker, side, quantity, entry_price, exit_price, pnl, pnl_pct, opened_at, closed_at, broker),
      like_count:likes(count),
      comment_count:comments(count)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  if (type === 'following' && user) {
    // Get IDs of users the current user follows
    const { data: follows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)

    const followingIds = follows?.map(f => f.following_id) ?? []
    if (followingIds.length === 0) {
      return NextResponse.json({ posts: [], nextCursor: null })
    }
    query = query.in('user_id', followingIds)
  }

  const { data: posts, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Check which posts the current user has liked
  if (user && posts && posts.length > 0) {
    const postIds = posts.map(p => p.id)
    const { data: likes } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', user.id)
      .in('post_id', postIds)

    const likedSet = new Set(likes?.map(l => l.post_id))
    posts.forEach((p: Record<string, unknown>) => {
      p.user_has_liked = likedSet.has(p.id as string)
    })
  }

  const nextCursor = posts && posts.length === limit
    ? posts[posts.length - 1].created_at
    : null

  return NextResponse.json({ posts, nextCursor })
}

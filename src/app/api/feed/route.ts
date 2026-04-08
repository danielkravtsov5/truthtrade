import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { classifyTicker } from '@/lib/asset-class'

export async function GET(req: NextRequest) {
  try {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { searchParams } = req.nextUrl
  const type = searchParams.get('type') ?? 'explore' // 'following' | 'explore'
  const cursor = searchParams.get('cursor')           // ISO date for pagination
  const filterUserId = searchParams.get('userId')     // filter by specific user
  const limit = 20

  // Trade-level filters
  const ticker = searchParams.get('ticker')
  const side = searchParams.get('side')
  const outcome = searchParams.get('outcome')
  const pnlMin = searchParams.get('pnlMin')
  const pnlMax = searchParams.get('pnlMax')
  const period = searchParams.get('period')
  const assetClass = searchParams.get('assetClass')

  // If trade-level filters are active, pre-filter trade IDs
  const hasTradeFilters = ticker || side || outcome || pnlMin || pnlMax || period || assetClass
  let tradeIdFilter: string[] | null = null

  if (hasTradeFilters) {
    let tq = supabase.from('trades').select('id, ticker, pnl')

    if (ticker) tq = tq.eq('ticker', ticker)
    if (side) tq = tq.eq('side', side)
    if (outcome === 'win') tq = tq.gt('pnl', 0)
    if (outcome === 'loss') tq = tq.lt('pnl', 0)
    if (pnlMin) tq = tq.gte('pnl', parseFloat(pnlMin))
    if (pnlMax) tq = tq.lte('pnl', parseFloat(pnlMax))

    if (period) {
      const now = new Date()
      let cutoff: string
      if (period === 'today') {
        const start = new Date(now)
        start.setHours(0, 0, 0, 0)
        cutoff = start.toISOString()
      } else if (period === 'week') {
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      } else {
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      }
      tq = tq.gte('closed_at', cutoff)
    }

    const { data: filteredTrades } = await tq
    let ids = (filteredTrades ?? []).map(t => t.id as string)

    // Asset class filter is done in JS since it's based on ticker classification
    if (assetClass && filteredTrades) {
      const matchingIds = filteredTrades
        .filter(t => classifyTicker(t.ticker as string) === assetClass)
        .map(t => t.id as string)
      ids = matchingIds
    }

    if (ids.length === 0) {
      return NextResponse.json({ posts: [], nextCursor: null })
    }
    tradeIdFilter = ids
  }

  let query = supabase
    .from('posts')
    .select(`
      id, analysis, created_at, updated_at,
      user:users!posts_user_id_fkey(id, username, display_name, avatar_url),
      trade:trades(id, ticker, side, quantity, entry_price, exit_price, pnl, pnl_pct, opened_at, closed_at, broker),
      media:post_media(id, type, url, body, sort_order),
      like_count:likes(count),
      comment_count:comments(count)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (tradeIdFilter) {
    query = query.in('trade_id', tradeIdFilter)
  }

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  // Filter by specific user (for profile pages)
  if (filterUserId) {
    query = query.eq('user_id', filterUserId)
  } else if (type === 'following' && user) {
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
    console.error('Feed query error:', error)
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
  } catch (err) {
    console.error('Feed unhandled error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

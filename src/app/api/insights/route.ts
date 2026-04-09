import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { searchParams } = req.nextUrl
    const cursor = searchParams.get('cursor')
    const filterUserId = searchParams.get('userId')
    const limit = 20

    let query = supabase
      .from('insights')
      .select(`
        id, body, created_at, updated_at,
        user:users!insights_user_id_fkey(id, username, display_name, avatar_url),
        like_count:insight_likes(count),
        comment_count:insight_comments(count)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (cursor) {
      query = query.lt('created_at', cursor)
    }

    if (filterUserId) {
      query = query.eq('user_id', filterUserId)
    } else if (user) {
      // Get followed user IDs + own insights
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)

      const followingIds = follows?.map(f => f.following_id) ?? []
      const feedIds = [...followingIds, user.id]

      if (feedIds.length > 0) {
        // Fetch followed + own insights
        query = query.in('user_id', feedIds)
      }
    }

    const { data: insights, error } = await query

    if (error) {
      console.error('Insights feed error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Check which insights the current user has liked
    if (user && insights && insights.length > 0) {
      const insightIds = insights.map(i => i.id)
      const { data: likes } = await supabase
        .from('insight_likes')
        .select('insight_id')
        .eq('user_id', user.id)
        .in('insight_id', insightIds)

      const likedSet = new Set(likes?.map(l => l.insight_id))
      insights.forEach((i: Record<string, unknown>) => {
        i.user_has_liked = likedSet.has(i.id as string)
      })
    }

    // Interleave algorithmic suggestions every 5th slot
    if (user && !filterUserId && insights && insights.length >= 4) {
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)

      const followingIds = follows?.map(f => f.following_id) ?? []
      const excludeIds = [...followingIds, user.id]

      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      const existingIds = insights.map(i => i.id)

      let suggestQuery = supabase
        .from('insights')
        .select(`
          id, body, created_at, updated_at,
          user:users!insights_user_id_fkey(id, username, display_name, avatar_url),
          like_count:insight_likes(count),
          comment_count:insight_comments(count)
        `)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(3)

      if (excludeIds.length > 0) {
        suggestQuery = suggestQuery.not('user_id', 'in', `(${excludeIds.join(',')})`)
      }
      if (existingIds.length > 0) {
        suggestQuery = suggestQuery.not('id', 'in', `(${existingIds.join(',')})`)
      }

      const { data: suggestions } = await suggestQuery

      if (suggestions && suggestions.length > 0) {
        // Check likes for suggestions
        const suggestIds = suggestions.map(s => s.id)
        const { data: suggestLikes } = await supabase
          .from('insight_likes')
          .select('insight_id')
          .eq('user_id', user.id)
          .in('insight_id', suggestIds)

        const suggestLikedSet = new Set(suggestLikes?.map(l => l.insight_id))
        suggestions.forEach((s: Record<string, unknown>) => {
          s.user_has_liked = suggestLikedSet.has(s.id as string)
        })

        // Insert suggestions at every 5th position
        let si = 0
        for (let pos = 4; pos < insights.length + suggestions.length && si < suggestions.length; pos += 5) {
          insights.splice(pos, 0, suggestions[si])
          si++
        }
      }
    }

    const nextCursor = insights && insights.length === limit
      ? insights[insights.length - 1].created_at
      : null

    return NextResponse.json({ insights, nextCursor })
  } catch (err) {
    console.error('Insights unhandled error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
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
    .insert({ user_id: user.id, body: trimmed })
    .select(`
      id, body, created_at, updated_at,
      user:users!insights_user_id_fkey(id, username, display_name, avatar_url),
      like_count:insight_likes(count),
      comment_count:insight_comments(count)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}

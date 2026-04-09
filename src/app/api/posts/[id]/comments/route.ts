import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('comments')
    .select('id, body, created_at, parent_comment_id, user:users!comments_user_id_fkey(id, username, display_name, avatar_url)')
    .eq('post_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Build threaded structure: nest replies under their parents
  const byId = new Map<string, Record<string, unknown>>()
  const roots: Record<string, unknown>[] = []

  for (const c of data ?? []) {
    const comment = { ...c, replies: [] as Record<string, unknown>[] }
    byId.set(comment.id, comment)
  }

  for (const c of byId.values()) {
    const parentId = c.parent_comment_id as string | null
    if (parentId && byId.has(parentId)) {
      (byId.get(parentId)!.replies as Record<string, unknown>[]).push(c)
    } else {
      roots.push(c)
    }
  }

  return NextResponse.json(roots)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { body, parent_comment_id } = await req.json()
  if (!body?.trim()) return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 })

  const insert: Record<string, unknown> = {
    user_id: user.id,
    post_id: id,
    body: body.trim(),
  }
  if (parent_comment_id) insert.parent_comment_id = parent_comment_id

  const { data, error } = await supabase
    .from('comments')
    .insert(insert)
    .select('id, body, created_at, parent_comment_id, user:users!comments_user_id_fkey(id, username, display_name, avatar_url)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
        type: 'comment',
        post_id: id,
      })
  }

  // If replying, also notify the parent comment author
  if (parent_comment_id) {
    const { data: parentComment } = await supabase
      .from('comments')
      .select('user_id')
      .eq('id', parent_comment_id)
      .single()

    if (parentComment && parentComment.user_id !== user.id && parentComment.user_id !== post?.user_id) {
      await supabase
        .from('notifications')
        .insert({
          user_id: parentComment.user_id,
          actor_id: user.id,
          type: 'comment',
          post_id: id,
        })
    }
  }

  return NextResponse.json({ ...data, replies: [] })
}

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { following_id } = await req.json()

  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: user.id, following_id })

  if (error && error.code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Create notification for the followed user
  if (following_id !== user.id) {
    await supabase
      .from('notifications')
      .insert({
        user_id: following_id,
        actor_id: user.id,
        type: 'follow',
      })
      .select()
      .maybeSingle() // unique index handles duplicates
  }

  return NextResponse.json({ following: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { following_id } = await req.json()

  await supabase
    .from('follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('following_id', following_id)

  return NextResponse.json({ following: false })
}

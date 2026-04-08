import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json([])
  }

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase
    .from('users')
    .select('id, username, display_name, avatar_url')
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .limit(10)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

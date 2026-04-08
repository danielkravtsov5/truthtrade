import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { verifyCredentials } from '@/lib/tradovate'

export const preferredRegion = 'sin1'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { username, password, demo = false } = await req.json()

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 })
  }

  const result = await verifyCredentials(username, password, demo)
  if (!result.valid) {
    return NextResponse.json({ error: 'Invalid Tradovate credentials. Check your username and password.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('broker_connections')
    .upsert({
      user_id: user.id,
      broker: 'tradovate',
      access_token: result.accessToken,
      token_expires_at: result.expiresAt,
      tradovate_account_id: result.accountId,
      paper_trading: demo,
    }, { onConflict: 'user_id,broker' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function DELETE() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase
    .from('broker_connections')
    .delete()
    .eq('user_id', user.id)
    .eq('broker', 'tradovate')

  return NextResponse.json({ success: true })
}

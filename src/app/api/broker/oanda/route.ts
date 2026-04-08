import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { verifyToken } from '@/lib/oanda'

export const preferredRegion = 'sin1'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token, practice = false } = await req.json()
  if (!token) {
    return NextResponse.json({ error: 'API token is required' }, { status: 400 })
  }

  const result = await verifyToken(token, practice)
  if (!result.valid) {
    return NextResponse.json({ error: 'Invalid OANDA API token.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('broker_connections')
    .upsert({
      user_id: user.id,
      broker: 'oanda',
      access_token: token,
      oanda_account_id: result.accountId,
      paper_trading: practice,
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
    .eq('broker', 'oanda')

  return NextResponse.json({ success: true })
}

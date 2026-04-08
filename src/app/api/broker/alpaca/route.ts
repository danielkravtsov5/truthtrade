import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { verifyApiKey } from '@/lib/alpaca'

export const preferredRegion = 'lhr1'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { api_key, api_secret, paper = false } = await req.json()
  if (!api_key || !api_secret) {
    return NextResponse.json({ error: 'API key and secret are required' }, { status: 400 })
  }

  const valid = await verifyApiKey(api_key, api_secret, paper)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid Alpaca API keys.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('broker_connections')
    .upsert({
      user_id: user.id,
      broker: 'alpaca',
      api_key,
      api_secret,
      paper_trading: paper,
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
    .eq('broker', 'alpaca')

  return NextResponse.json({ success: true })
}

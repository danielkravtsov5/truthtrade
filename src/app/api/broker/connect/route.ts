import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { verifyApiKey } from '@/lib/binance'

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('broker_connections')
    .select('id, broker, api_key, created_at, last_synced_at')
    .eq('user_id', user.id)

  // Mask API keys
  const connections = (data ?? []).map(c => ({
    ...c,
    api_key: c.api_key ? c.api_key.slice(0, 6) + '...' + c.api_key.slice(-4) : null,
  }))

  return NextResponse.json(connections)
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { api_key, api_secret } = await req.json()

  if (!api_key || !api_secret) {
    return NextResponse.json({ error: 'api_key and api_secret are required' }, { status: 400 })
  }

  // Verify the keys work before saving
  const result = await verifyApiKey(api_key, api_secret)
  if (!result.valid) {
    return NextResponse.json({ error: result.error ?? 'Invalid Binance API keys' }, { status: 400 })
  }

  const { error } = await supabase
    .from('broker_connections')
    .upsert({
      user_id: user.id,
      broker: 'binance',
      api_key,
      api_secret,
    }, { onConflict: 'user_id,broker' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  await supabase
    .from('broker_connections')
    .delete()
    .eq('user_id', user.id)
    .eq('broker', 'binance')

  return NextResponse.json({ success: true })
}

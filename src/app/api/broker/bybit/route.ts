import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { verifyApiKey } from '@/lib/bybit'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { api_key, api_secret } = await req.json()
  if (!api_key || !api_secret) {
    return NextResponse.json({ error: 'API key and secret are required' }, { status: 400 })
  }

  const valid = await verifyApiKey(api_key, api_secret)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid Bybit API keys. Make sure you have read permissions enabled.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('broker_connections')
    .upsert({
      user_id: user.id,
      broker: 'bybit',
      api_key,
      api_secret,
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
    .eq('broker', 'bybit')

  return NextResponse.json({ success: true })
}

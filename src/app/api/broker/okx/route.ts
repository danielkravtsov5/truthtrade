import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { verifyApiKey } from '@/lib/okx'

export const preferredRegion = 'sin1'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { api_key, api_secret, passphrase } = await req.json()
  if (!api_key || !api_secret || !passphrase) {
    return NextResponse.json({ error: 'API key, secret, and passphrase are required' }, { status: 400 })
  }

  const valid = await verifyApiKey(api_key, api_secret, passphrase)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid OKX API credentials. Check your key, secret, and passphrase.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('broker_connections')
    .upsert({
      user_id: user.id,
      broker: 'okx',
      api_key,
      api_secret,
      api_passphrase: passphrase,
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
    .eq('broker', 'okx')

  return NextResponse.json({ success: true })
}

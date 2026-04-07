import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { verifyApiKey } from '@/lib/coinbase'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { key_name, private_key } = await req.json()
  if (!key_name || !private_key) {
    return NextResponse.json({ error: 'CDP Key Name and Private Key are required' }, { status: 400 })
  }

  const valid = await verifyApiKey(key_name, private_key)
  if (!valid) {
    return NextResponse.json({ error: 'Invalid Coinbase API credentials. Make sure you downloaded the correct key from CDP.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('broker_connections')
    .upsert({
      user_id: user.id,
      broker: 'coinbase',
      coinbase_key_name: key_name,
      coinbase_private_key: private_key,
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
    .eq('broker', 'coinbase')

  return NextResponse.json({ success: true })
}

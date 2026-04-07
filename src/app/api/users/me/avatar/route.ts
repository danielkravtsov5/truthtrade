import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const type = formData.get('type') as string | null // 'avatar' or 'cover'

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  if (!type || !['avatar', 'cover'].includes(type)) {
    return NextResponse.json({ error: 'type must be avatar or cover' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${user.id}/${type}.${ext}`

  // Upsert: remove old file first (ignore errors if not found)
  await supabase.storage.from('avatars').remove([path])

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, file, { contentType: file.type, upsert: true })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)

  // Add cache-bust param so browsers pick up new image
  const url = `${publicUrl}?t=${Date.now()}`

  const column = type === 'avatar' ? 'avatar_url' : 'cover_url'
  const { error: dbError } = await supabase
    .from('users')
    .update({ [column]: url })
    .eq('id', user.id)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  return NextResponse.json({ url })
}

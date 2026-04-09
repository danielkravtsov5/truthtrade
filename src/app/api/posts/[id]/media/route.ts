import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params
  const supabase = await createServerSupabaseClient()

  const { data } = await supabase
    .from('post_media')
    .select('*')
    .eq('post_id', postId)
    .order('sort_order')

  return NextResponse.json(data ?? [])
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const { data: post } = await supabase
    .from('posts')
    .select('user_id')
    .eq('id', postId)
    .single()

  if (!post || post.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const contentType = req.headers.get('content-type') ?? ''

  // Text slide
  if (contentType.includes('application/json')) {
    const { body, sort_order = 0 } = await req.json()
    const { data: media, error } = await supabase
      .from('post_media')
      .insert({ post_id: postId, type: 'text', body, sort_order })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(media)
  }

  // File upload (image/video)
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const sortOrder = Number(formData.get('sort_order') ?? 0)

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const isVideo = file.type.startsWith('video/')
  const mediaType = isVideo ? 'video' : 'image'
  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `${user.id}/${postId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('post-media')
    .upload(path, file, { contentType: file.type })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from('post-media').getPublicUrl(path)

  const { data: media, error } = await supabase
    .from('post_media')
    .insert({ post_id: postId, type: mediaType, url: publicUrl, sort_order: sortOrder })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(media)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { media_id, body, sort_order } = await req.json()
  if (!media_id) return NextResponse.json({ error: 'media_id required' }, { status: 400 })

  // Verify ownership via post
  const { data: post } = await supabase
    .from('posts')
    .select('user_id')
    .eq('id', postId)
    .single()

  if (!post || post.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const updates: Record<string, unknown> = {}
  if (body !== undefined) updates.body = body
  if (sort_order !== undefined) updates.sort_order = sort_order

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data: media, error } = await supabase
    .from('post_media')
    .update(updates)
    .eq('id', media_id)
    .eq('post_id', postId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(media)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const mediaId = req.nextUrl.searchParams.get('media_id')
  if (!mediaId) return NextResponse.json({ error: 'media_id required' }, { status: 400 })

  // Verify ownership via post
  const { data: post } = await supabase
    .from('posts')
    .select('user_id')
    .eq('id', postId)
    .single()

  if (!post || post.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Get media record to find storage path
  const { data: media } = await supabase
    .from('post_media')
    .select('url')
    .eq('id', mediaId)
    .single()

  if (media?.url) {
    // Extract path from public URL
    const urlParts = media.url.split('/post-media/')
    if (urlParts[1]) {
      await supabase.storage.from('post-media').remove([urlParts[1]])
    }
  }

  await supabase.from('post_media').delete().eq('id', mediaId)
  return NextResponse.json({ ok: true })
}

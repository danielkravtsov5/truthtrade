'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import TradeCard from '@/components/TradeCard'
import { Post, Comment, PostMedia } from '@/types'
import { createClient } from '@/lib/supabase'
import { Send, ImagePlus, FileText, X } from 'lucide-react'
import { formatDistanceToNow } from '@/lib/utils'

export default function TradeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentBody, setCommentBody] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [isOwn, setIsOwn] = useState(false)
  const [editingAnalysis, setEditingAnalysis] = useState(false)
  const [savingAnalysis, setSavingAnalysis] = useState(false)
  const [media, setMedia] = useState<PostMedia[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/posts/${id}`).then(r => r.json()).then(data => {
      setPost(data)
      setAnalysis(data.analysis ?? '')
      setComments(data.comments ?? [])
      setMedia(data.media ?? [])
    })

    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && post?.user_id === user.id) setIsOwn(true)
    })
  }, [id, post?.user_id])

  async function submitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentBody.trim()) return
    const res = await fetch(`/api/posts/${id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: commentBody }),
    })
    if (res.ok) {
      const comment = await res.json()
      setComments(prev => [...prev, comment])
      setCommentBody('')
    }
  }

  async function saveAnalysis() {
    setSavingAnalysis(true)
    const res = await fetch(`/api/posts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysis }),
    })
    if (res.ok) {
      const updated = await res.json()
      setPost(prev => prev ? { ...prev, analysis: updated.analysis } : prev)
      setEditingAnalysis(false)
    }
    setSavingAnalysis(false)
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('sort_order', String(media.length))

    const res = await fetch(`/api/posts/${id}/media`, { method: 'POST', body: formData })
    if (res.ok) {
      const newMedia = await res.json()
      setMedia(prev => [...prev, newMedia])
      setPost(prev => prev ? { ...prev, media: [...(prev.media ?? []), newMedia] } : prev)
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleAddTextSlide() {
    const body = prompt('Enter text for the slide:')
    if (!body?.trim()) return
    setUploading(true)

    const res = await fetch(`/api/posts/${id}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, sort_order: media.length }),
    })
    if (res.ok) {
      const newMedia = await res.json()
      setMedia(prev => [...prev, newMedia])
      setPost(prev => prev ? { ...prev, media: [...(prev.media ?? []), newMedia] } : prev)
    }
    setUploading(false)
  }

  async function handleDeleteMedia(mediaId: string) {
    const res = await fetch(`/api/posts/${id}/media?media_id=${mediaId}`, { method: 'DELETE' })
    if (res.ok) {
      setMedia(prev => prev.filter(m => m.id !== mediaId))
      setPost(prev => prev ? { ...prev, media: (prev.media ?? []).filter(m => m.id !== mediaId) } : prev)
    }
  }

  if (!post) {
    return (
      <div className="flex min-h-screen">
        <Navbar />
        <main className="flex-1 md:ml-64 pb-20 md:pb-0">
          <div className="max-w-xl mx-auto px-4 py-8 animate-pulse space-y-4">
            <div className="h-6 bg-gray-200 rounded w-32" />
            <div className="h-48 bg-gray-100 rounded-2xl" />
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <Navbar />
      <main className="flex-1 md:ml-64 pb-20 md:pb-0">
        <div className="max-w-xl mx-auto px-4 py-4">
          <h1 className="font-bold text-lg text-gray-900 mb-4">Trade</h1>

          <TradeCard post={post} />

          {/* Media manager (own post) */}
          {isOwn && (
            <div className="mt-4 bg-white border border-gray-200 rounded-2xl p-4">
              <h2 className="font-semibold text-gray-900 text-sm mb-3">Media</h2>

              {/* Existing media */}
              {media.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {media.sort((a, b) => a.sort_order - b.sort_order).map(item => (
                    <div key={item.id} className="relative group">
                      {item.type === 'image' && item.url && (
                        <img src={item.url} alt="" className="w-full aspect-square object-cover rounded-lg" />
                      )}
                      {item.type === 'video' && (
                        <div className="w-full aspect-square bg-gray-900 rounded-lg flex items-center justify-center text-white text-xs">Video</div>
                      )}
                      {item.type === 'text' && (
                        <div className="w-full aspect-square bg-gray-50 rounded-lg flex items-center justify-center p-2 text-xs text-gray-600 overflow-hidden">
                          {item.body?.slice(0, 60)}...
                        </div>
                      )}
                      <button
                        onClick={() => handleDeleteMedia(item.id)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload buttons */}
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  <ImagePlus size={16} />
                  {uploading ? 'Uploading...' : 'Add Image/Video'}
                </button>
                <button
                  onClick={handleAddTextSlide}
                  disabled={uploading}
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  <FileText size={16} />
                  Add Text
                </button>
              </div>
            </div>
          )}

          {/* Analysis editor (own post) */}
          {isOwn && (
            <div className="mt-4 bg-white border border-gray-200 rounded-2xl p-4">
              <div className="flex justify-between items-center mb-2">
                <h2 className="font-semibold text-gray-900 text-sm">Your analysis</h2>
                {!editingAnalysis && (
                  <button onClick={() => setEditingAnalysis(true)} className="text-indigo-600 text-sm hover:underline">
                    {post.analysis ? 'Edit' : 'Add analysis'}
                  </button>
                )}
              </div>
              {editingAnalysis ? (
                <div>
                  <textarea
                    value={analysis}
                    onChange={e => setAnalysis(e.target.value)}
                    rows={5}
                    placeholder="Why did you take this trade? What did you see?"
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  />
                  <div className="flex gap-2 mt-2">
                    <button onClick={saveAnalysis} disabled={savingAnalysis} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                      {savingAnalysis ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => { setEditingAnalysis(false); setAnalysis(post.analysis ?? '') }} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                !post.analysis && <p className="text-gray-400 text-sm">No analysis yet. Share your thinking.</p>
              )}
            </div>
          )}

          {/* Comments */}
          <div className="mt-4 bg-white border border-gray-200 rounded-2xl p-4">
            <h2 className="font-semibold text-gray-900 text-sm mb-4">
              Comments {comments.length > 0 && <span className="text-gray-400">({comments.length})</span>}
            </h2>

            {comments.length === 0 && (
              <p className="text-gray-400 text-sm mb-4">No comments yet.</p>
            )}

            <div className="space-y-4 mb-4">
              {comments.map(comment => (
                <div key={comment.id} className="flex gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                    {(comment.user?.display_name ?? comment.user?.username ?? '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <span className="font-semibold text-sm text-gray-900">@{comment.user?.username}</span>
                    <span className="text-gray-400 text-xs ml-2">{formatDistanceToNow(comment.created_at)}</span>
                    <p className="text-sm text-gray-700 mt-0.5">{comment.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={submitComment} className="flex gap-2">
              <input
                type="text"
                value={commentBody}
                onChange={e => setCommentBody(e.target.value)}
                placeholder="Add a comment..."
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button type="submit" className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors">
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}

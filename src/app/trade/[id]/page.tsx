'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import TradeCard from '@/components/TradeCard'
import { Post, Comment, PostMedia } from '@/types'
import { createClient } from '@/lib/supabase'
import { Send, ImagePlus, X, GripVertical, Pencil, Type, FileText } from 'lucide-react'
import { formatDistanceToNow } from '@/lib/utils'

export default function TradeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [post, setPost] = useState<Post | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentBody, setCommentBody] = useState('')
  const [analysis, setAnalysis] = useState('')
  const [savedAnalysis, setSavedAnalysis] = useState('')
  const [isOwn, setIsOwn] = useState(false)
  const [savingAnalysis, setSavingAnalysis] = useState(false)
  const [media, setMedia] = useState<PostMedia[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Text slide editor state
  const [textSlideEditor, setTextSlideEditor] = useState<{
    mode: 'add' | 'edit'
    mediaId?: string
    body: string
  } | null>(null)
  const [savingSlide, setSavingSlide] = useState(false)

  // File preview state
  const [pendingFile, setPendingFile] = useState<{
    file: File
    previewUrl: string
    type: 'image' | 'video'
  } | null>(null)

  // Drag reorder state
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  useEffect(() => {
    const supabase = createClient()

    Promise.all([
      fetch(`/api/posts/${id}`).then(r => r.json()),
      supabase.auth.getUser(),
    ]).then(([data, { data: { user } }]) => {
      setPost(data)
      setAnalysis(data.analysis ?? '')
      setSavedAnalysis(data.analysis ?? '')
      setComments(data.comments ?? [])
      setMedia(data.media ?? [])
      if (user && data.user_id === user.id) setIsOwn(true)
    })
  }, [id])

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
      router.push('/explore')
    }
    setSavingAnalysis(false)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const previewUrl = URL.createObjectURL(file)
    const type = file.type.startsWith('video/') ? 'video' as const : 'image' as const
    setPendingFile({ file, previewUrl, type })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function confirmFileUpload() {
    if (!pendingFile) return
    setUploading(true)
    const formData = new FormData()
    formData.append('file', pendingFile.file)
    formData.append('sort_order', String(media.length))

    const res = await fetch(`/api/posts/${id}/media`, { method: 'POST', body: formData })
    if (res.ok) {
      const newMedia = await res.json()
      setMedia(prev => [...prev, newMedia])
      setPost(prev => prev ? { ...prev, media: [...(prev.media ?? []), newMedia] } : prev)
    }
    URL.revokeObjectURL(pendingFile.previewUrl)
    setPendingFile(null)
    setUploading(false)
  }

  function cancelFileUpload() {
    if (pendingFile) URL.revokeObjectURL(pendingFile.previewUrl)
    setPendingFile(null)
  }

  async function saveTextSlide() {
    if (!textSlideEditor || !textSlideEditor.body.trim()) return
    setSavingSlide(true)

    if (textSlideEditor.mode === 'add') {
      const res = await fetch(`/api/posts/${id}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: textSlideEditor.body, sort_order: media.length }),
      })
      if (res.ok) {
        const newMedia = await res.json()
        setMedia(prev => [...prev, newMedia])
        setPost(prev => prev ? { ...prev, media: [...(prev.media ?? []), newMedia] } : prev)
      }
    } else if (textSlideEditor.mediaId) {
      const res = await fetch(`/api/posts/${id}/media`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ media_id: textSlideEditor.mediaId, body: textSlideEditor.body }),
      })
      if (res.ok) {
        const updated = await res.json()
        setMedia(prev => prev.map(m => m.id === updated.id ? updated : m))
        setPost(prev => prev ? { ...prev, media: (prev.media ?? []).map(m => m.id === updated.id ? updated : m) } : prev)
      }
    }
    setTextSlideEditor(null)
    setSavingSlide(false)
  }

  function handleDragStart(e: React.DragEvent, index: number) {
    setDragIndex(index)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    setDragOverIndex(index)
  }

  function handleDragEnd() {
    if (dragIndex === null || dragOverIndex === null || dragIndex === dragOverIndex) {
      setDragIndex(null)
      setDragOverIndex(null)
      return
    }

    const sorted = [...media].sort((a, b) => a.sort_order - b.sort_order)
    const [moved] = sorted.splice(dragIndex, 1)
    sorted.splice(dragOverIndex, 0, moved)

    const updated = sorted.map((item, i) => ({ ...item, sort_order: i }))
    const prevMedia = media
    setMedia(updated)
    setPost(prev => prev ? { ...prev, media: updated } : prev)

    Promise.all(
      updated
        .filter(item => item.sort_order !== prevMedia.find(m => m.id === item.id)?.sort_order)
        .map(item =>
          fetch(`/api/posts/${id}/media`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ media_id: item.id, sort_order: item.sort_order }),
          })
        )
    ).catch(() => {
      setMedia(prevMedia)
      setPost(prev => prev ? { ...prev, media: prevMedia } : prev)
    })

    setDragIndex(null)
    setDragOverIndex(null)
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
      <div className="max-w-xl mx-auto px-4 py-8 animate-pulse space-y-4">
        <div className="h-6 bg-gray-200 rounded w-32" />
        <div className="h-48 bg-gray-100 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-4">
          <h1 className="font-bold text-lg text-gray-900 mb-4">Trade</h1>

          <TradeCard post={post} />

          {/* Your Explanation (own post) */}
          {isOwn && (
            <div className="mt-4 bg-white border border-gray-200 rounded-2xl p-4">
              <h2 className="font-semibold text-gray-900 text-sm mb-1">Your Explanation</h2>
              <p className="text-gray-400 text-xs mb-4">Add your reasoning, screenshots, or notes. The trade data above is verified and can&apos;t be changed.</p>

              {/* Empty state */}
              {!analysis && !savedAnalysis && media.length === 0 && !textSlideEditor && !pendingFile && (
                <div className="text-center py-6 mb-3">
                  <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FileText size={20} className="text-indigo-400" />
                  </div>
                  <p className="text-gray-900 font-medium text-sm">Tell others about this trade</p>
                  <p className="text-gray-400 text-xs mt-1">Add analysis, screenshots, or text slides to explain your thinking</p>
                </div>
              )}

              {/* Analysis textarea (always visible) */}
              <div className="mb-3">
                <textarea
                  value={analysis}
                  onChange={e => setAnalysis(e.target.value)}
                  rows={4}
                  placeholder="Why did you take this trade? What did you see?"
                  className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Media grid with drag-to-reorder */}
              {media.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[...media].sort((a, b) => a.sort_order - b.sort_order).map((item, index) => (
                    <div
                      key={item.id}
                      className={`relative group cursor-grab active:cursor-grabbing ${dragOverIndex === index ? 'ring-2 ring-indigo-400 rounded-lg' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                    >
                      {/* Drag handle */}
                      <div className="absolute top-1 left-1 opacity-0 group-hover:opacity-70 text-white z-10 drop-shadow">
                        <GripVertical size={14} />
                      </div>

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

                      {/* Edit button for text slides */}
                      {item.type === 'text' && (
                        <button
                          onClick={() => setTextSlideEditor({ mode: 'edit', mediaId: item.id, body: item.body ?? '' })}
                          className="absolute bottom-1 left-1 bg-white/90 text-gray-700 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        >
                          <Pencil size={12} />
                        </button>
                      )}

                      {/* Delete button */}
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

              {/* File preview before upload */}
              {pendingFile && (
                <div className="border border-indigo-200 rounded-xl p-3 bg-indigo-50/30 mb-3">
                  {pendingFile.type === 'image' ? (
                    <img src={pendingFile.previewUrl} alt="Preview" className="max-h-48 rounded-lg object-contain mx-auto" />
                  ) : (
                    <video src={pendingFile.previewUrl} className="max-h-48 rounded-lg mx-auto" controls />
                  )}
                  <p className="text-xs text-gray-500 mt-2 text-center">{pendingFile.file.name} ({(pendingFile.file.size / 1024 / 1024).toFixed(1)} MB)</p>
                  <div className="flex justify-end gap-2 mt-2">
                    <button onClick={cancelFileUpload} className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                      Cancel
                    </button>
                    <button onClick={confirmFileUpload} disabled={uploading} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                      {uploading ? 'Uploading...' : 'Upload'}
                    </button>
                  </div>
                </div>
              )}

              {/* Inline text slide editor */}
              {textSlideEditor && (
                <div className="border border-indigo-200 rounded-xl p-3 bg-indigo-50/30 mb-3">
                  <textarea
                    value={textSlideEditor.body}
                    onChange={e => setTextSlideEditor(prev => prev ? { ...prev, body: e.target.value } : prev)}
                    rows={4}
                    placeholder="Write your text slide content..."
                    className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2 mt-2">
                    <button onClick={() => setTextSlideEditor(null)} className="px-3 py-1.5 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                      Cancel
                    </button>
                    <button onClick={saveTextSlide} disabled={savingSlide || !textSlideEditor.body.trim()} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60">
                      {savingSlide ? 'Saving...' : textSlideEditor.mode === 'add' ? 'Add Slide' : 'Save Changes'}
                    </button>
                  </div>
                </div>
              )}

              {/* Add content buttons */}
              {(() => {
                const imgCount = media.filter(m => m.type === 'image').length
                const vidCount = media.filter(m => m.type === 'video').length
                const canAddImage = imgCount < 5
                const canAddVideo = vidCount < 1
                const canAddFile = canAddImage || canAddVideo
                return (
              <div className="flex flex-col gap-2 pt-3 border-t border-gray-100">
                {(imgCount > 0 || vidCount > 0) && (
                  <p className="text-xs text-gray-400">{imgCount}/5 images, {vidCount}/1 video</p>
                )}
                <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={canAddImage && canAddVideo ? 'image/*,video/*' : canAddVideo ? 'video/*' : 'image/*'}
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || !!pendingFile || !canAddFile}
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  <ImagePlus size={16} />
                  {canAddFile ? 'Add Image/Video' : 'Limit reached'}
                </button>
                <button
                  onClick={() => setTextSlideEditor({ mode: 'add', body: '' })}
                  disabled={!!textSlideEditor}
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-xl text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  <Type size={16} />
                  Add Text Slide
                </button>
                </div>
              </div>
                )
              })()}

              {/* Publish button — enabled when there's any content */}
              {(analysis.trim() || media.length > 0) && (
                <button
                  onClick={saveAnalysis}
                  disabled={savingAnalysis}
                  className="w-full mt-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors"
                >
                  {savingAnalysis ? 'Publishing...' : 'Publish Analysis'}
                </button>
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
  )
}

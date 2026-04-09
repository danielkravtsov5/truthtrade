'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import InsightCard from '@/components/InsightCard'
import { createClient } from '@/lib/supabase'
import { formatDistanceToNow } from '@/lib/utils'
import type { Insight, InsightComment } from '@/types'

export default function InsightDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [insight, setInsight] = useState<Insight | null>(null)
  const [comments, setComments] = useState<InsightComment[]>([])
  const [commentBody, setCommentBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState<string>()
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState('')

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [])

  const fetchInsight = useCallback(async () => {
    const res = await fetch(`/api/insights/${id}`)
    if (res.ok) {
      const data = await res.json()
      setInsight(data)
      setEditBody(data.body)
    }
  }, [id])

  const fetchComments = useCallback(async () => {
    const res = await fetch(`/api/insights/${id}/comments`)
    if (res.ok) setComments(await res.json())
  }, [id])

  useEffect(() => {
    Promise.all([fetchInsight(), fetchComments()]).finally(() => setLoading(false))
  }, [fetchInsight, fetchComments])

  async function submitComment() {
    if (!commentBody.trim() || submitting) return
    setSubmitting(true)
    const res = await fetch(`/api/insights/${id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: commentBody.trim() }),
    })
    if (res.ok) {
      const comment = await res.json()
      setComments(prev => [...prev, comment])
      setCommentBody('')
    }
    setSubmitting(false)
  }

  async function saveEdit() {
    if (!editBody.trim()) return
    const res = await fetch(`/api/insights/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: editBody.trim() }),
    })
    if (res.ok) {
      setInsight(prev => prev ? { ...prev, body: editBody.trim() } : prev)
      setEditing(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-4 animate-pulse">
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-3 bg-gray-200 rounded w-32" />
              <div className="h-3 bg-gray-200 rounded w-full" />
              <div className="h-3 bg-gray-200 rounded w-3/4" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!insight) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <p className="text-center text-gray-400 py-12">Insight not found</p>
      </div>
    )
  }

  const isOwner = currentUserId === insight.user_id

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link href="/insights" className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm mb-4">
        <ArrowLeft size={16} />
        Back
      </Link>

      {/* Insight */}
      {editing ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4">
          <textarea
            value={editBody}
            onChange={e => setEditBody(e.target.value)}
            rows={4}
            className="w-full resize-none text-[15px] text-gray-800 focus:outline-none leading-relaxed"
          />
          <div className="flex items-center justify-end gap-2 mt-2">
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
              Cancel
            </button>
            <button onClick={saveEdit} className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-4">
          <InsightCard insight={insight} currentUserId={currentUserId} />
          {isOwner && (
            <button onClick={() => setEditing(true)} className="text-indigo-500 text-sm hover:underline mt-2">
              Edit insight
            </button>
          )}
        </div>
      )}

      {/* Comments */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Comments ({comments.length})</h2>

        {comments.length === 0 ? (
          <p className="text-gray-400 text-sm py-4 text-center">No comments yet</p>
        ) : (
          <div className="space-y-4 mb-4">
            {comments.map(c => (
              <div key={c.id} className="flex gap-3">
                <Link href={`/profile/${c.user?.username}`}>
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs shrink-0 overflow-hidden">
                    {c.user?.avatar_url ? (
                      <img src={c.user.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (c.user?.display_name ?? c.user?.username ?? '?')[0].toUpperCase()
                    )}
                  </div>
                </Link>
                <div>
                  <div className="flex items-center gap-1.5">
                    <Link href={`/profile/${c.user?.username}`} className="text-sm font-semibold text-gray-900 hover:underline">
                      {c.user?.display_name ?? c.user?.username}
                    </Link>
                    <span className="text-xs text-gray-400">{formatDistanceToNow(c.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-700 mt-0.5">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Comment form */}
        {currentUserId && (
          <div className="flex gap-2 border-t border-gray-100 pt-4">
            <input
              value={commentBody}
              onChange={e => setCommentBody(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && submitComment()}
              placeholder="Add a comment..."
              className="flex-1 text-sm text-gray-800 placeholder-gray-400 bg-gray-50 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-300"
            />
            <button
              onClick={submitComment}
              disabled={!commentBody.trim() || submitting}
              className="px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              Post
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

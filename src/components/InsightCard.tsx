'use client'

import { useState, useCallback } from 'react'
import { Heart, MessageCircle, Share2, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from '@/lib/utils'
import type { Insight } from '@/types'

interface InsightCardProps {
  insight: Insight
  currentUserId?: string
  onDelete?: (id: string) => void
}

export default function InsightCard({ insight, currentUserId, onDelete }: InsightCardProps) {
  const [liked, setLiked] = useState(insight.user_has_liked ?? false)
  const [likeCount, setLikeCount] = useState(insight.like_count ?? 0)
  const [deleting, setDeleting] = useState(false)

  const user = insight.user!
  const isOwner = currentUserId === insight.user_id
  const isAdmin = currentUserId === process.env.NEXT_PUBLIC_ADMIN_USER_ID

  async function toggleLike() {
    const method = liked ? 'DELETE' : 'POST'
    const res = await fetch(`/api/insights/${insight.id}/like`, { method })
    if (res.ok) {
      setLiked(!liked)
      setLikeCount(c => liked ? c - 1 : c + 1)
    }
  }

  const handleDelete = useCallback(async () => {
    if (!confirm('Delete this insight?')) return
    setDeleting(true)
    const res = await fetch(`/api/insights/${insight.id}`, { method: 'DELETE' })
    if (res.ok) {
      onDelete?.(insight.id)
    } else {
      alert('Failed to delete')
      setDeleting(false)
    }
  }, [insight.id, onDelete])

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 hover:bg-gray-50 transition-colors">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href={`/profile/${user.username}`}>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm shrink-0 overflow-hidden">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              (user.display_name ?? user.username)[0].toUpperCase()
            )}
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 flex-wrap">
            <Link href={`/profile/${user.username}`} className="font-semibold text-gray-900 hover:underline text-sm">
              {user.display_name ?? user.username}
            </Link>
            <span className="text-gray-400 text-sm">@{user.username}</span>
            <span className="text-gray-400 text-sm">·</span>
            <span className="text-gray-400 text-sm">{formatDistanceToNow(insight.created_at)}</span>
          </div>

          {/* Body */}
          <Link href={`/insight/${insight.id}`}>
            <p className="text-gray-800 text-[15px] mt-1.5 leading-relaxed whitespace-pre-wrap">{insight.body}</p>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-6 text-gray-400 text-sm mt-3">
            <button
              onClick={toggleLike}
              className={`flex items-center gap-1.5 hover:text-red-500 transition-colors ${liked ? 'text-red-500' : ''}`}
            >
              <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
              {likeCount > 0 && <span>{likeCount}</span>}
            </button>
            <Link href={`/insight/${insight.id}`} className="flex items-center gap-1.5 hover:text-blue-500 transition-colors">
              <MessageCircle size={18} />
              {(insight.comment_count ?? 0) > 0 && <span>{insight.comment_count}</span>}
            </Link>
            <button
              onClick={async () => {
                const url = `${window.location.origin}/insight/${insight.id}`
                if (navigator.share) {
                  await navigator.share({ text: insight.body.slice(0, 100), url }).catch(() => {})
                } else {
                  await navigator.clipboard.writeText(url)
                  alert('Link copied!')
                }
              }}
              className="flex items-center gap-1.5 hover:text-indigo-500 transition-colors ml-auto"
            >
              <Share2 size={18} />
            </button>
            {(isOwner || isAdmin) && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-gray-300 hover:text-red-500 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

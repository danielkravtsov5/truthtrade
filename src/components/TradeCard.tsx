'use client'

import { Post } from '@/types'
import { formatDistanceToNow } from '@/lib/utils'
import { Heart, MessageCircle, Repeat2, Share2, CheckCircle, Trash2, Pencil } from 'lucide-react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useState, useCallback } from 'react'
import PostCarousel from './PostCarousel'

const TradeChart = dynamic(() => import('./TradeChart'), { ssr: false })

interface TradeCardProps {
  post: Post
  compact?: boolean  // for profile grid
  currentUserId?: string
  onDelete?: (postId: string) => void
}

export default function TradeCard({ post, compact = false, currentUserId, onDelete }: TradeCardProps) {
  const [liked, setLiked] = useState(post.user_has_liked ?? false)
  const [likeCount, setLikeCount] = useState(post.like_count ?? 0)
  const [deleting, setDeleting] = useState(false)

  const isAdmin = currentUserId === process.env.NEXT_PUBLIC_ADMIN_USER_ID
  const isOwner = currentUserId === post.user_id

  const handleDelete = useCallback(async () => {
    if (!confirm('Delete this post?')) return
    setDeleting(true)
    const res = await fetch(`/api/posts/${post.id}`, { method: 'DELETE' })
    if (res.ok) {
      onDelete?.(post.id)
    } else {
      alert('Failed to delete post')
      setDeleting(false)
    }
  }, [post.id, onDelete])

  const trade = post.trade!
  const user = post.user!
  const isProfit = trade.pnl >= 0

  async function toggleLike() {
    const method = liked ? 'DELETE' : 'POST'
    const res = await fetch(`/api/posts/${post.id}/like`, { method })
    if (res.ok) {
      setLiked(!liked)
      setLikeCount(c => liked ? c - 1 : c + 1)
    }
  }

  if (compact) {
    return (
      <Link href={`/trade/${post.id}`}>
        <div className={`aspect-square rounded-lg flex flex-col items-center justify-center text-white font-bold text-sm cursor-pointer hover:opacity-90 transition-opacity ${isProfit ? 'bg-emerald-500' : 'bg-red-500'}`}>
          <span className="text-xs opacity-80">{trade.ticker}</span>
          <span className="text-lg">{isProfit ? '+' : ''}{trade.pnl_pct.toFixed(2)}%</span>
          <span className="text-xs opacity-80">${isProfit ? '+' : ''}{trade.pnl.toFixed(2)}</span>
        </div>
      </Link>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 hover:bg-gray-50 transition-colors">
      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <Link href={`/profile/${user.username}`}>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm">
            {(user.display_name ?? user.username)[0].toUpperCase()}
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/profile/${user.username}`} className="font-semibold text-gray-900 hover:underline text-sm">
            {user.display_name ?? user.username}
          </Link>
          <span className="text-gray-400 text-sm ml-1">@{user.username}</span>
          <span className="text-gray-400 text-sm ml-2">·</span>
          <span className="text-gray-400 text-sm ml-2">{formatDistanceToNow(post.created_at)}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-emerald-500 text-xs font-medium">
            <CheckCircle size={12} />
            verified
          </div>
          {isAdmin && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-gray-300 hover:text-red-500 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Trade Card */}
      <Link href={`/trade/${post.id}`}>
        <div className={`rounded-xl p-4 mb-3 border-2 ${isProfit ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-900 text-lg">{trade.ticker}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${trade.side === 'long' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                {trade.side}
              </span>
              <span className="text-gray-500 text-xs">{trade.quantity} units</span>
            </div>
            <div className={`text-right font-bold ${isProfit ? 'text-emerald-600' : 'text-red-600'}`}>
              <div className="text-lg">{isProfit ? '+' : ''}${trade.pnl.toFixed(2)}</div>
              <div className="text-sm">{isProfit ? '+' : ''}{trade.pnl_pct.toFixed(2)}%</div>
            </div>
          </div>
          <div className="flex items-center gap-1 text-gray-500 text-xs">
            <span>Entry ${trade.entry_price.toFixed(4)}</span>
            <span>→</span>
            <span>Exit ${trade.exit_price.toFixed(4)}</span>
          </div>
        </div>
      </Link>

      {/* Price chart with entry/exit markers */}
      <div className="mb-3">
        <TradeChart trade={trade} />
      </div>

      {/* Carousel media */}
      {post.media && post.media.length > 0 && (
        <div className="mb-3">
          <PostCarousel media={post.media} />
        </div>
      )}

      {/* Analysis */}
      {post.analysis && (
        <div className="mb-3">
          <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{post.analysis}</p>
          {isOwner && (
            <Link href={`/trade/${post.id}?edit=1`} className="inline-flex items-center gap-1 text-indigo-500 text-xs hover:underline mt-1">
              <Pencil size={12} />
              Edit analysis
            </Link>
          )}
        </div>
      )}
      {!post.analysis && isOwner && (
        <Link href={`/trade/${post.id}`} className="text-indigo-500 text-sm hover:underline block mb-3">
          Add your analysis...
        </Link>
      )}
      {/* Owner has media but no text — still show edit link */}
      {!post.analysis && isOwner && post.media && post.media.length > 0 && (
        <Link href={`/trade/${post.id}?edit=1`} className="inline-flex items-center gap-1 text-indigo-500 text-xs hover:underline mb-3">
          <Pencil size={12} />
          Edit analysis
        </Link>
      )}

      {/* Actions */}
      <div className="flex items-center gap-6 text-gray-400 text-sm">
        <button
          onClick={toggleLike}
          className={`flex items-center gap-1.5 hover:text-red-500 transition-colors ${liked ? 'text-red-500' : ''}`}
        >
          <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
          {likeCount > 0 && <span>{likeCount}</span>}
        </button>
        <Link href={`/trade/${post.id}`} className="flex items-center gap-1.5 hover:text-blue-500 transition-colors">
          <MessageCircle size={18} />
          {(post.comment_count ?? 0) > 0 && <span>{post.comment_count}</span>}
        </Link>
        <button className="flex items-center gap-1.5 hover:text-green-500 transition-colors">
          <Repeat2 size={18} />
        </button>
        <button
          onClick={async () => {
            const url = `${window.location.origin}/trade/${post.id}`
            const text = `${trade.ticker} ${trade.side} ${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)} (${trade.pnl >= 0 ? '+' : ''}${trade.pnl_pct.toFixed(2)}%) — verified on TruthTrade`
            if (navigator.share) {
              await navigator.share({ text, url }).catch(() => {})
            } else {
              await navigator.clipboard.writeText(url)
              alert('Link copied!')
            }
          }}
          className="flex items-center gap-1.5 hover:text-indigo-500 transition-colors ml-auto"
        >
          <Share2 size={18} />
        </button>
      </div>
    </div>
  )
}

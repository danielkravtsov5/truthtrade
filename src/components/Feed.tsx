'use client'

import { useEffect, useState, useCallback } from 'react'
import { Post } from '@/types'
import TradeCard from './TradeCard'
import { createClient } from '@/lib/supabase'

interface FeedProps {
  type: 'following' | 'explore'
  userId?: string
  filters?: Record<string, string>
}

export default function Feed({ type, userId, filters }: FeedProps) {
  const [posts, setPosts] = useState<Post[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string>()

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [])

  const filterKey = filters ? JSON.stringify(filters) : ''

  const fetchPosts = useCallback(async (cursor?: string) => {
    const params = new URLSearchParams({ type })
    if (cursor) params.set('cursor', cursor)
    if (userId) params.set('userId', userId)
    // Append active filters
    if (filters) {
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.set(k, v)
      })
    }
    const res = await fetch(`/api/feed?${params}`)
    return res.json()
  }, [type, userId, filterKey])

  useEffect(() => {
    setLoading(true)
    fetchPosts().then(({ posts: p, nextCursor: c }) => {
      setPosts(p ?? [])
      setNextCursor(c)
      setLoading(false)
    })
  }, [fetchPosts])

  // Realtime: subscribe to new posts
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, async () => {
        const { posts: fresh } = await fetchPosts()
        if (fresh) setPosts(fresh)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchPosts])

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    const { posts: more, nextCursor: c } = await fetchPosts(nextCursor)
    setPosts(prev => [...prev, ...(more ?? [])])
    setNextCursor(c)
    setLoadingMore(false)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4 animate-pulse">
            <div className="flex gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-32" />
                <div className="h-3 bg-gray-200 rounded w-20" />
              </div>
            </div>
            <div className="h-24 bg-gray-100 rounded-xl" />
          </div>
        ))}
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-lg font-medium mb-2">No trades yet</p>
        <p className="text-sm">
          {type === 'following'
            ? 'Follow traders to see their verified trades here.'
            : 'Be the first to connect your Binance account.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {posts.map(post => (
        <TradeCard
          key={post.id}
          post={post}
          currentUserId={currentUserId}
          onDelete={(id) => setPosts(prev => prev.filter(p => p.id !== id))}
        />
      ))}
      {nextCursor && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full py-3 text-indigo-600 font-medium hover:bg-indigo-50 rounded-xl transition-colors disabled:opacity-50"
        >
          {loadingMore ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  )
}

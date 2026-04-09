'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Insight } from '@/types'
import InsightCard from './InsightCard'
import InsightComposer from './InsightComposer'
import { createClient } from '@/lib/supabase'

interface InsightFeedProps {
  userId?: string
}

export default function InsightFeed({ userId }: InsightFeedProps) {
  const [insights, setInsights] = useState<Insight[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string>()

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (data.user) setCurrentUserId(data.user.id)
    })
  }, [])

  const fetchInsights = useCallback(async (cursor?: string) => {
    const params = new URLSearchParams()
    if (cursor) params.set('cursor', cursor)
    if (userId) params.set('userId', userId)
    const res = await fetch(`/api/insights?${params}`)
    return res.json()
  }, [userId])

  useEffect(() => {
    setLoading(true)
    fetchInsights().then(({ insights: items, nextCursor: c }) => {
      setInsights(items ?? [])
      setNextCursor(c)
      setLoading(false)
    })
  }, [fetchInsights])

  // Realtime: subscribe to new insights
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('insights')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'insights' }, async () => {
        const { insights: fresh } = await fetchInsights()
        if (fresh) setInsights(fresh)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchInsights])

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    const { insights: more, nextCursor: c } = await fetchInsights(nextCursor)
    setInsights(prev => [...prev, ...(more ?? [])])
    setNextCursor(c)
    setLoadingMore(false)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4 animate-pulse">
            <div className="flex gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-32" />
                <div className="h-3 bg-gray-200 rounded w-full" />
                <div className="h-3 bg-gray-200 rounded w-3/4" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Composer — only on own feed, not when viewing someone's profile */}
      {!userId && currentUserId && (
        <InsightComposer
          onPublish={(insight) => setInsights(prev => [insight, ...prev])}
        />
      )}

      {insights.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg font-medium mb-2">No insights yet</p>
          <p className="text-sm">
            {userId
              ? 'This trader hasn\'t shared any insights yet.'
              : 'Follow traders or share your first insight.'}
          </p>
        </div>
      ) : (
        <>
          {insights.map(insight => (
            <InsightCard
              key={insight.id}
              insight={insight}
              currentUserId={currentUserId}
              onDelete={(id) => setInsights(prev => prev.filter(i => i.id !== id))}
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
        </>
      )}
    </div>
  )
}

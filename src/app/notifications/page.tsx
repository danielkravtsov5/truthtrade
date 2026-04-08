'use client'

import { useEffect, useState, useCallback } from 'react'
import { Bell, Heart, MessageCircle, UserPlus, TrendingUp, Check } from 'lucide-react'
import Link from 'next/link'
import type { Notification } from '@/types'

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

function NotificationIcon({ type }: { type: Notification['type'] }) {
  switch (type) {
    case 'like':
      return <Heart size={16} className="text-red-500" />
    case 'comment':
      return <MessageCircle size={16} className="text-blue-500" />
    case 'follow':
      return <UserPlus size={16} className="text-indigo-500" />
    case 'new_trade':
      return <TrendingUp size={16} className="text-emerald-500" />
  }
}

function notificationText(n: Notification): string {
  const name = n.actor?.display_name ?? n.actor?.username ?? 'Someone'
  switch (n.type) {
    case 'like':
      return `${name} liked your trade`
    case 'comment':
      return `${name} commented on your trade`
    case 'follow':
      return `${name} started following you`
    case 'new_trade': {
      const ticker = n.post?.trade?.ticker ?? ''
      const pnl = n.post?.trade?.pnl
      const pnlStr = pnl !== undefined ? (pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`) : ''
      return `${name} closed a trade${ticker ? `: ${ticker}` : ''}${pnlStr ? ` (${pnlStr})` : ''}`
    }
  }
}

function notificationHref(n: Notification): string {
  if (n.type === 'follow') return `/profile/${n.actor?.username}`
  if (n.post_id) return `/trade/${n.post_id}`
  return '#'
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchNotifications = useCallback(async (cursor?: string) => {
    const url = `/api/notifications${cursor ? `?cursor=${cursor}` : ''}`
    const res = await fetch(url)
    if (!res.ok) return
    const data = await res.json()
    if (cursor) {
      setNotifications(prev => [...prev, ...data.notifications])
    } else {
      setNotifications(data.notifications)
    }
    setNextCursor(data.nextCursor)
  }, [])

  useEffect(() => {
    fetchNotifications().finally(() => setLoading(false))
  }, [fetchNotifications])

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    await fetchNotifications(nextCursor)
    setLoadingMore(false)
  }

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const hasUnread = notifications.some(n => !n.read)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Bell size={22} />
          Notifications
        </h1>
        {hasUnread && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
          >
            <Check size={16} />
            Mark all read
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <p className="text-center text-gray-400 py-12">No notifications yet</p>
      ) : (
        <div className="space-y-1">
          {notifications.map(n => (
            <Link
              key={n.id}
              href={notificationHref(n)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                n.read ? 'hover:bg-gray-50' : 'bg-blue-50 hover:bg-blue-100'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden shrink-0">
                {n.actor?.avatar_url ? (
                  <img src={n.actor.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  (n.actor?.display_name ?? n.actor?.username ?? '?')[0].toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 truncate">{notificationText(n)}</p>
                <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)}</p>
              </div>
              <div className="shrink-0">
                <NotificationIcon type={n.type} />
              </div>
            </Link>
          ))}

          {nextCursor && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full py-3 text-sm text-gray-500 hover:text-gray-700 font-medium"
            >
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

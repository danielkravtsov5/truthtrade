'use client'

import { useEffect, useState, useId } from 'react'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase'

export default function NotificationBell({ userId }: { userId: string }) {
  const [unreadCount, setUnreadCount] = useState(0)
  const channelId = useId()

  useEffect(() => {
    fetch('/api/notifications?unread_only=true')
      .then(res => res.json())
      .then(data => setUnreadCount(data.unread_count ?? 0))
      .catch(() => {})

    const supabase = createClient()
    const channel = supabase
      .channel(`notif-bell-${channelId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          setUnreadCount(prev => prev + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, channelId])

  return (
    <span className="relative">
      <Bell size={20} />
      {unreadCount > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </span>
  )
}

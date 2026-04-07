'use client'

import { User, ProfileStats } from '@/types'
import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'

interface ProfileHeaderProps {
  user: User
  stats: ProfileStats
  isOwn: boolean
  isFollowing: boolean
}

export default function ProfileHeader({ user, stats, isOwn, isFollowing }: ProfileHeaderProps) {
  const [following, setFollowing] = useState(isFollowing)
  const [followerCount, setFollowerCount] = useState(stats.followers_count)

  async function toggleFollow() {
    const method = following ? 'DELETE' : 'POST'
    const res = await fetch('/api/follow', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ following_id: user.id }),
    })
    if (res.ok) {
      setFollowing(!following)
      setFollowerCount(c => following ? c - 1 : c + 1)
    }
  }

  const winRate = stats.total_trades > 0
    ? Math.round((stats.winning_trades / stats.total_trades) * 100)
    : 0

  return (
    <div className="bg-white border-b border-gray-200 pb-4">
      {/* Cover gradient */}
      <div className="h-24 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

      <div className="px-4">
        {/* Avatar */}
        <div className="flex justify-between items-end -mt-8 mb-3">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-2xl border-4 border-white">
            {(user.display_name ?? user.username)[0].toUpperCase()}
          </div>
          {!isOwn && (
            <button
              onClick={toggleFollow}
              className={`px-5 py-2 rounded-full font-semibold text-sm transition-colors ${
                following
                  ? 'border border-gray-300 text-gray-700 hover:border-red-300 hover:text-red-500'
                  : 'bg-gray-900 text-white hover:bg-gray-700'
              }`}
            >
              {following ? 'Following' : 'Follow'}
            </button>
          )}
        </div>

        {/* Name */}
        <h1 className="font-bold text-gray-900 text-xl">{user.display_name ?? user.username}</h1>
        <p className="text-gray-500 text-sm">@{user.username}</p>
        {user.bio && <p className="text-gray-700 text-sm mt-2">{user.bio}</p>}

        {/* Follow counts */}
        <div className="flex gap-4 mt-3 text-sm">
          <span><strong className="text-gray-900">{stats.following_count}</strong> <span className="text-gray-500">Following</span></span>
          <span><strong className="text-gray-900">{followerCount}</strong> <span className="text-gray-500">Followers</span></span>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-2 mt-4 p-3 bg-gray-50 rounded-xl text-center">
          <div>
            <div className="font-bold text-gray-900">{stats.total_trades}</div>
            <div className="text-gray-500 text-xs">Trades</div>
          </div>
          <div>
            <div className={`font-bold ${winRate >= 50 ? 'text-emerald-600' : 'text-red-600'}`}>{winRate}%</div>
            <div className="text-gray-500 text-xs">Win Rate</div>
          </div>
          <div>
            <div className={`font-bold text-sm ${stats.avg_pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {stats.avg_pnl >= 0 ? '+' : ''}{formatCurrency(stats.avg_pnl)}
            </div>
            <div className="text-gray-500 text-xs">Avg P&L</div>
          </div>
          <div>
            <div className={`font-bold text-sm ${stats.total_pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {stats.total_pnl >= 0 ? '+' : ''}{formatCurrency(stats.total_pnl)}
            </div>
            <div className="text-gray-500 text-xs">Total P&L</div>
          </div>
        </div>
      </div>
    </div>
  )
}

'use client'

import { User, ProfileStats } from '@/types'
import { useState } from 'react'
import { formatCurrency, formatJoinDate, formatProfitFactor } from '@/lib/utils'

interface ProfileHeaderProps {
  user: User
  stats: ProfileStats
  isOwn: boolean
  isFollowing: boolean
}

export default function ProfileHeader({ user, stats, isOwn, isFollowing }: ProfileHeaderProps) {
  const [following, setFollowing] = useState(isFollowing)
  const [followerCount, setFollowerCount] = useState(stats.followers_count)
  const [pnlVisible, setPnlVisible] = useState(user.pnl_visible)

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

  async function togglePnlVisibility() {
    const newVal = !pnlVisible
    setPnlVisible(newVal)
    await fetch('/api/users/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pnl_visible: newVal }),
    })
  }

  const winRate = stats.total_trades > 0
    ? Math.round((stats.winning_trades / stats.total_trades) * 100)
    : 0

  return (
    <div className="bg-white border-b border-gray-200 pb-4">
      {/* Cover gradient */}
      <div className="h-24 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

      <div className="px-4">
        {/* Avatar + follow button */}
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

        {/* Name & username */}
        <h1 className="font-bold text-gray-900 text-xl">{user.display_name ?? user.username}</h1>
        <p className="text-gray-500 text-sm">@{user.username}</p>

        {/* Bio */}
        {user.bio && <p className="text-gray-700 text-sm mt-2">{user.bio}</p>}

        {/* Location & Join date */}
        <div className="flex flex-wrap gap-3 mt-2 text-sm text-gray-500">
          {user.location && (
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0Z" />
              </svg>
              {user.location}
            </span>
          )}
          <span className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
            </svg>
            {formatJoinDate(user.created_at)}
          </span>
        </div>

        {/* Top panel: Posts | Followers | Following */}
        <div className="flex gap-5 mt-3 text-sm">
          <span><strong className="text-gray-900">{stats.posts_count}</strong> <span className="text-gray-500">Posts</span></span>
          <span><strong className="text-gray-900">{followerCount}</strong> <span className="text-gray-500">Followers</span></span>
          <span><strong className="text-gray-900">{stats.following_count}</strong> <span className="text-gray-500">Following</span></span>
        </div>

        {/* Bottom panel: Trading stats */}
        <div className="grid grid-cols-5 gap-1 mt-4 p-3 bg-gray-50 rounded-xl text-center">
          <div>
            <div className={`font-bold ${winRate >= 50 ? 'text-emerald-600' : 'text-red-600'}`}>{winRate}%</div>
            <div className="text-gray-500 text-xs">Win Rate</div>
          </div>
          <div>
            <div className="font-bold text-gray-900">{formatProfitFactor(stats.profit_factor)}</div>
            <div className="text-gray-500 text-xs">PF</div>
          </div>
          <div>
            <div className="font-bold text-gray-900">{stats.total_trades}</div>
            <div className="text-gray-500 text-xs">Trades</div>
          </div>
          <div>
            {pnlVisible ? (
              <div className={`font-bold text-sm ${stats.total_pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {stats.total_pnl >= 0 ? '+' : ''}{formatCurrency(stats.total_pnl)}
              </div>
            ) : (
              <div className="font-bold text-gray-400 text-sm">Hidden</div>
            )}
            <div className="text-gray-500 text-xs flex items-center justify-center gap-1">
              P&L
              {isOwn && (
                <button onClick={togglePnlVisibility} className="text-gray-400 hover:text-gray-600" title={pnlVisible ? 'Hide P&L' : 'Show P&L'}>
                  {pnlVisible ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          </div>
          <div>
            {stats.broker_name ? (
              <div className="font-bold text-gray-900 text-sm capitalize">{stats.broker_name}</div>
            ) : (
              <div className="font-bold text-gray-400 text-sm">--</div>
            )}
            <div className="text-gray-500 text-xs">Broker</div>
          </div>
        </div>
      </div>
    </div>
  )
}

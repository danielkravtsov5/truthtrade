'use client'

import { User, ProfileStats } from '@/types'
import { useRef, useState } from 'react'
import { formatCurrency, formatJoinDate, formatProfitFactor } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface ProfileHeaderProps {
  user: User
  stats: ProfileStats
  isOwn: boolean
  isFollowing: boolean
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative group/tip inline-flex ml-0.5 cursor-help">
      <svg className="w-3 h-3 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 0-2 0 1 1 0 0 0 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
      </svg>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 text-xs text-white bg-gray-800 rounded-md whitespace-nowrap opacity-0 pointer-events-none group-hover/tip:opacity-100 transition-opacity z-10">
        {text}
      </span>
    </span>
  )
}

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
    </svg>
  )
}

export default function ProfileHeader({ user, stats, isOwn, isFollowing }: ProfileHeaderProps) {
  const [following, setFollowing] = useState(isFollowing)
  const [followerCount, setFollowerCount] = useState(stats.followers_count)
  const [pnlVisible, setPnlVisible] = useState(user.pnl_visible)
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url)
  const [coverUrl, setCoverUrl] = useState(user.cover_url)
  const [uploading, setUploading] = useState<'avatar' | 'cover' | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const coverInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

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

  async function handleImageUpload(file: File, type: 'avatar' | 'cover') {
    setUploading(type)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('type', type)

      const res = await fetch('/api/users/me/avatar', { method: 'POST', body: formData })
      if (res.ok) {
        const { url } = await res.json()
        if (type === 'avatar') setAvatarUrl(url)
        else setCoverUrl(url)
        router.refresh()
      }
    } finally {
      setUploading(null)
    }
  }

  function onFileSelect(e: React.ChangeEvent<HTMLInputElement>, type: 'avatar' | 'cover') {
    const file = e.target.files?.[0]
    if (file) handleImageUpload(file, type)
    e.target.value = ''
  }

  const winRate = stats.total_trades > 0
    ? Math.round((stats.winning_trades / stats.total_trades) * 100)
    : 0

  return (
    <div className="bg-white border-b border-gray-200 pb-4">
      {/* Cover image */}
      <div className="relative h-24 group">
        {coverUrl ? (
          <img src={coverUrl} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
        )}
        {isOwn && (
          <>
            <button
              onClick={() => coverInputRef.current?.click()}
              disabled={uploading === 'cover'}
              className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors cursor-pointer"
            >
              <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-full p-2">
                {uploading === 'cover' ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <CameraIcon className="w-5 h-5 text-white" />
                )}
              </div>
            </button>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => onFileSelect(e, 'cover')}
            />
          </>
        )}
      </div>

      <div className="px-4">
        {/* Avatar + follow button */}
        <div className="flex justify-between items-end -mt-8 mb-3">
          <div className="relative group/avatar">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={user.display_name ?? user.username}
                className="w-20 h-20 rounded-full object-cover border-4 border-white"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-2xl border-4 border-white">
                {(user.display_name ?? user.username)[0].toUpperCase()}
              </div>
            )}
            {isOwn && (
              <>
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploading === 'avatar'}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 group-hover/avatar:bg-black/30 transition-colors cursor-pointer"
                >
                  <div className="opacity-0 group-hover/avatar:opacity-100 transition-opacity bg-black/50 rounded-full p-1.5">
                    {uploading === 'avatar' ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <CameraIcon className="w-4 h-4 text-white" />
                    )}
                  </div>
                </button>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => onFileSelect(e, 'avatar')}
                />
              </>
            )}
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
            <div className="text-gray-500 text-xs flex items-center justify-center">Win Rate <InfoTooltip text="Percentage of trades closed in profit" /></div>
          </div>
          <div>
            <div className="font-bold text-gray-900">{formatProfitFactor(stats.profit_factor)}</div>
            <div className="text-gray-500 text-xs flex items-center justify-center">PF <InfoTooltip text="Profit Factor — gross profit divided by gross loss" /></div>
          </div>
          <div>
            <div className="font-bold text-gray-900">{stats.total_trades}</div>
            <div className="text-gray-500 text-xs flex items-center justify-center">Trades <InfoTooltip text="Total number of closed trades" /></div>
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
              P&L <InfoTooltip text="Total profit and loss across all trades" />
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
            <div className="text-gray-500 text-xs flex items-center justify-center">Broker <InfoTooltip text="Connected broker account for verified trades" /></div>
          </div>
        </div>
      </div>
    </div>
  )
}

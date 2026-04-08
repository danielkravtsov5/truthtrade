'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Search, X } from 'lucide-react'
import Link from 'next/link'
import { ALL_SYMBOLS } from '@/lib/asset-class'

interface UserResult {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
}

export default function ExploreSearch() {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [users, setUsers] = useState<UserResult[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const searchUsers = useCallback(async (q: string) => {
    if (q.length < 2) { setUsers([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`)
      if (res.ok) {
        const data = await res.json()
        setUsers(data)
      }
    } catch { /* ignore */ }
    setSearching(false)
  }, [])

  function handleChange(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchUsers(value), 300)
  }

  const q = query.toUpperCase().trim()
  const symbolResults = q.length > 0
    ? ALL_SYMBOLS.filter(s => s.symbol.includes(q)).slice(0, 10)
    : []

  const showDropdown = focused && query.length > 0 && (symbolResults.length > 0 || users.length > 0 || searching)

  return (
    <div ref={wrapperRef} className="relative mb-4">
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder="Search symbols or traders..."
          className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        />
        {query && (
          <button onClick={() => { setQuery(''); setUsers([]) }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-80 overflow-y-auto">
          {/* Symbol results */}
          {symbolResults.length > 0 && (
            <div>
              <p className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase">Symbols</p>
              {symbolResults.map(({ symbol, category }) => (
                <Link
                  key={symbol}
                  href={`/explore?symbol=${symbol}`}
                  onClick={() => setFocused(false)}
                  className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm font-medium text-gray-900">{symbol}</span>
                  <span className="text-xs text-gray-400">{category}</span>
                </Link>
              ))}
            </div>
          )}

          {/* User results */}
          {users.length > 0 && (
            <div>
              <p className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase">Traders</p>
              {users.map(user => (
                <Link
                  key={user.id}
                  href={`/profile/${user.username}`}
                  onClick={() => setFocused(false)}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs overflow-hidden">
                    {user.avatar_url
                      ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                      : (user.display_name ?? user.username)[0].toUpperCase()
                    }
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{user.display_name ?? user.username}</p>
                    <p className="text-xs text-gray-400">@{user.username}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {searching && (
            <p className="px-3 py-2 text-xs text-gray-400">Searching traders...</p>
          )}

          {query.length >= 2 && !searching && users.length === 0 && symbolResults.length === 0 && (
            <p className="px-3 py-3 text-sm text-gray-400 text-center">No results found</p>
          )}
        </div>
      )}
    </div>
  )
}

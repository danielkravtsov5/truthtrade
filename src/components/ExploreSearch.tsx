'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Search, X, ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react'
import Link from 'next/link'
import { ALL_SYMBOLS, type SymbolEntry } from '@/lib/asset-class'

interface UserResult {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
}

const CATEGORY_ORDER = ['Crypto', 'Stocks', 'Forex'] as const

function groupByCategory(symbols: SymbolEntry[]): Record<string, SymbolEntry[]> {
  const groups: Record<string, SymbolEntry[]> = {}
  for (const s of symbols) {
    if (!groups[s.category]) groups[s.category] = []
    groups[s.category].push(s)
  }
  return groups
}

export default function ExploreSearch() {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [users, setUsers] = useState<UserResult[]>([])
  const [searching, setSearching] = useState(false)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
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

  // Reset expanded folders when query changes
  useEffect(() => {
    if (query.trim().length > 0) {
      // Auto-expand all folders that have matches
      const q = query.toUpperCase().trim()
      const matched = new Set<string>()
      for (const s of ALL_SYMBOLS) {
        if (s.symbol.includes(q)) matched.add(s.category)
      }
      setExpandedFolders(matched)
    } else {
      setExpandedFolders(new Set())
    }
  }, [query])

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

  function toggleFolder(category: string) {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  const q = query.toUpperCase().trim()

  // In search mode: filter symbols. In browse mode: show all.
  const filteredSymbols = useMemo(() => {
    if (q.length > 0) {
      return ALL_SYMBOLS.filter(s => s.symbol.includes(q))
    }
    return ALL_SYMBOLS
  }, [q])

  const grouped = useMemo(() => groupByCategory(filteredSymbols), [filteredSymbols])

  const showDropdown = focused && (
    query.length === 0 || filteredSymbols.length > 0 || users.length > 0 || searching
  )

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
          {/* Symbol folders */}
          {CATEGORY_ORDER.filter(cat => grouped[cat]?.length > 0).map(category => {
            const symbols = grouped[category]
            const isExpanded = expandedFolders.has(category)
            return (
              <div key={category}>
                <button
                  onClick={() => toggleFolder(category)}
                  className="flex items-center gap-2 w-full px-3 py-2 hover:bg-gray-50 transition-colors"
                >
                  {isExpanded
                    ? <ChevronDown size={14} className="text-gray-400 shrink-0" />
                    : <ChevronRight size={14} className="text-gray-400 shrink-0" />
                  }
                  {isExpanded
                    ? <FolderOpen size={14} className="text-indigo-500 shrink-0" />
                    : <Folder size={14} className="text-indigo-500 shrink-0" />
                  }
                  <span className="text-sm font-semibold text-gray-700">{category}</span>
                  <span className="text-xs text-gray-400 ml-auto">{symbols.length}</span>
                </button>
                {isExpanded && (
                  <div>
                    {symbols.map(({ symbol }) => (
                      <Link
                        key={symbol}
                        href={`/explore?symbol=${symbol}`}
                        onClick={() => setFocused(false)}
                        className="flex items-center px-3 py-1.5 pl-10 hover:bg-gray-50 transition-colors"
                      >
                        <span className="text-sm text-gray-900">{symbol}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

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

          {query.length >= 2 && !searching && users.length === 0 && filteredSymbols.length === 0 && (
            <p className="px-3 py-3 text-sm text-gray-400 text-center">No results found</p>
          )}
        </div>
      )}
    </div>
  )
}

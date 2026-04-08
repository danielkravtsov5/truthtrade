'use client'

import { useEffect, useState, useCallback } from 'react'
import { Trophy } from 'lucide-react'
import Link from 'next/link'
import type { LeaderboardEntry } from '@/types'

const PERIODS = [
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
]

const METRICS = [
  { value: 'win_rate', label: 'Win Rate' },
  { value: 'total_pnl', label: 'Total P&L' },
  { value: 'profit_factor', label: 'Profit Factor' },
  { value: 'total_trades', label: 'Trades' },
  { value: 'avg_pnl', label: 'Avg P&L' },
]

function formatMetricValue(metric: string, entry: LeaderboardEntry): string {
  switch (metric) {
    case 'win_rate': return `${entry.win_rate}%`
    case 'total_pnl': return `$${entry.total_pnl.toLocaleString()}`
    case 'profit_factor': return entry.profit_factor >= 999 ? '∞' : `${entry.profit_factor}`
    case 'total_trades': return `${entry.total_trades}`
    case 'avg_pnl': return `$${entry.avg_pnl.toLocaleString()}`
    default: return ''
  }
}

export default function LeaderboardPage() {
  const [period, setPeriod] = useState('week')
  const [metric, setMetric] = useState('win_rate')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [currentUserRank, setCurrentUserRank] = useState<number | undefined>()
  const [loading, setLoading] = useState(true)

  const fetchLeaderboard = useCallback(async (p: number) => {
    setLoading(true)
    const res = await fetch(`/api/leaderboard?metric=${metric}&period=${period}&page=${p}`)
    if (!res.ok) { setLoading(false); return }
    const data = await res.json()
    if (p === 1) {
      setEntries(data.entries)
    } else {
      setEntries(prev => [...prev, ...data.entries])
    }
    setTotal(data.total)
    setCurrentUserRank(data.current_user_rank)
    setPage(p)
    setLoading(false)
  }, [metric, period])

  useEffect(() => {
    fetchLeaderboard(1)
  }, [fetchLeaderboard])

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-6">
        <Trophy size={22} />
        Leaderboard
      </h1>

      {/* Period tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-xl p-1">
        {PERIODS.map(p => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${
              period === p.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Metric selector */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {METRICS.map(m => (
          <button
            key={m.value}
            onClick={() => setMetric(m.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
              metric === m.value
                ? 'bg-indigo-100 text-indigo-700'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {loading && entries.length === 0 ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-center text-gray-400 py-12">No traders qualify for this period yet</p>
      ) : (
        <>
          <div className="space-y-2">
            {entries.map(entry => (
              <Link
                key={entry.user.id}
                href={`/profile/${entry.user.username}`}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  currentUserRank && entry.rank === currentUserRank
                    ? 'bg-indigo-50 hover:bg-indigo-100'
                    : 'bg-white border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {/* Rank */}
                <div className={`w-8 text-center font-bold text-sm ${
                  entry.rank <= 3 ? 'text-amber-500' : 'text-gray-400'
                }`}>
                  {entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`}
                </div>

                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden shrink-0">
                  {entry.user.avatar_url ? (
                    <img src={entry.user.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    (entry.user.display_name ?? entry.user.username ?? '?')[0].toUpperCase()
                  )}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    {entry.user.display_name ?? entry.user.username}
                  </p>
                  <p className="text-xs text-gray-400">
                    {entry.total_trades} trades · {entry.win_rate}% win
                  </p>
                </div>

                {/* Primary metric */}
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${
                    metric === 'total_pnl' || metric === 'avg_pnl'
                      ? (entry[metric as 'total_pnl' | 'avg_pnl'] >= 0 ? 'text-emerald-600' : 'text-red-500')
                      : 'text-gray-900'
                  }`}>
                    {formatMetricValue(metric, entry)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {METRICS.find(m => m.value === metric)?.label}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {entries.length < total && (
            <button
              onClick={() => fetchLeaderboard(page + 1)}
              disabled={loading}
              className="w-full mt-4 py-3 text-sm text-gray-500 hover:text-gray-700 font-medium"
            >
              {loading ? 'Loading...' : 'Load more'}
            </button>
          )}

          {currentUserRank && !entries.find(e => e.rank === currentUserRank) && (
            <div className="fixed bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 bg-indigo-600 text-white px-4 py-2 rounded-full text-sm font-medium shadow-lg">
              Your rank: #{currentUserRank}
            </div>
          )}
        </>
      )}
    </div>
  )
}

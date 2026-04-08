'use client'

import { useEffect, useState, useCallback } from 'react'
import { BarChart3, TrendingUp, TrendingDown, Target, Flame, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import Link from 'next/link'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import CalendarHeatmap from '@/components/CalendarHeatmap'
import type { DashboardData } from '@/types'

const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'all', label: 'All Time' },
]

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-xs text-gray-400 font-medium mb-1">{label}</p>
      <p className={`text-lg font-bold ${color ?? 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function DashboardPage() {
  const [period, setPeriod] = useState('all')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/dashboard?period=${period}`)
    if (res.ok) {
      setData(await res.json())
    }
    setLoading(false)
  }, [period])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const s = data?.stats

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-6">
        <BarChart3 size={22} />
        Dashboard
      </h1>

      {/* Period tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1">
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

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
        </div>
      ) : !s || s.total_trades === 0 ? (
        <p className="text-center text-gray-400 py-12">No trades in this period</p>
      ) : (
        <div className="space-y-6">
          {/* Stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <StatCard
              label="Total P&L"
              value={`$${s.total_pnl.toLocaleString()}`}
              color={s.total_pnl >= 0 ? 'text-emerald-600' : 'text-red-500'}
            />
            <StatCard
              label="Win Rate"
              value={`${s.win_rate}%`}
              sub={`${s.wins}W / ${s.losses}L`}
              color={s.win_rate >= 50 ? 'text-emerald-600' : 'text-red-500'}
            />
            <StatCard
              label="Profit Factor"
              value={s.profit_factor >= 999 ? '∞' : `${s.profit_factor}`}
              color={s.profit_factor >= 1 ? 'text-emerald-600' : 'text-red-500'}
            />
            <StatCard label="Total Trades" value={`${s.total_trades}`} />
            <StatCard
              label="Avg P&L"
              value={`$${s.avg_pnl.toLocaleString()}`}
              color={s.avg_pnl >= 0 ? 'text-emerald-600' : 'text-red-500'}
            />
            <StatCard
              label="Streak"
              value={`${s.current_streak} ${s.streak_type ?? ''}`}
              color={s.streak_type === 'win' ? 'text-emerald-600' : s.streak_type === 'loss' ? 'text-red-500' : undefined}
            />
          </div>

          {/* Equity curve */}
          {data.equity_curve.length > 1 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Equity Curve</h2>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={data.equity_curve}>
                  <defs>
                    <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: string) => new Date(v).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `$${v}`} />
                  <Tooltip
                    formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Cumulative P&L']}
                    labelFormatter={(label) => new Date(String(label)).toLocaleDateString()}
                  />
                  <Area type="monotone" dataKey="cumulative_pnl" stroke="#6366f1" fill="url(#eqGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Ticker breakdown */}
          {data.by_ticker.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">P&L by Ticker</h2>
              {data.by_ticker.length > 1 && (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.by_ticker.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="ticker" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v: number) => `$${v}`} />
                    <Tooltip formatter={(value) => [`$${Number(value).toFixed(2)}`, 'P&L']} />
                    <Bar dataKey="pnl" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <div className="mt-3 space-y-2">
                {data.by_ticker.map(t => (
                  <div key={t.ticker} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-900">{t.ticker}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-gray-400">{t.trades} trades</span>
                      <span className="text-gray-400">{t.win_rate}% win</span>
                      <span className={`font-semibold ${t.pnl >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        ${t.pnl.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Long vs Short */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <ArrowUpRight size={16} className="text-emerald-500" />
                <h2 className="text-sm font-semibold text-gray-700">Longs</h2>
              </div>
              <p className={`text-lg font-bold ${data.by_side.long.pnl >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                ${data.by_side.long.pnl.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">{data.by_side.long.trades} trades · {data.by_side.long.win_rate}% win</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-2">
                <ArrowDownRight size={16} className="text-red-500" />
                <h2 className="text-sm font-semibold text-gray-700">Shorts</h2>
              </div>
              <p className={`text-lg font-bold ${data.by_side.short.pnl >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                ${data.by_side.short.pnl.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">{data.by_side.short.trades} trades · {data.by_side.short.win_rate}% win</p>
            </div>
          </div>

          {/* Calendar heatmap */}
          {data.calendar.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">Trading Calendar</h2>
              <CalendarHeatmap data={data.calendar} />
            </div>
          )}

          {/* Best / Worst trades */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <TrendingUp size={16} className="text-emerald-500" />
                <h2 className="text-sm font-semibold text-gray-700">Best Trades</h2>
              </div>
              <div className="space-y-2">
                {data.best_trades.map(t => (
                  <Link key={t.id} href={`/trade/${t.id}`} className="flex items-center justify-between text-sm hover:bg-gray-50 rounded-lg px-2 py-1 -mx-2">
                    <span className="font-medium text-gray-900">{t.ticker}</span>
                    <span className="text-emerald-600 font-semibold">+${Number(t.pnl).toFixed(2)}</span>
                  </Link>
                ))}
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <TrendingDown size={16} className="text-red-500" />
                <h2 className="text-sm font-semibold text-gray-700">Worst Trades</h2>
              </div>
              <div className="space-y-2">
                {data.worst_trades.map(t => (
                  <Link key={t.id} href={`/trade/${t.id}`} className="flex items-center justify-between text-sm hover:bg-gray-50 rounded-lg px-2 py-1 -mx-2">
                    <span className="font-medium text-gray-900">{t.ticker}</span>
                    <span className="text-red-500 font-semibold">-${Math.abs(Number(t.pnl)).toFixed(2)}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

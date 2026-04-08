import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const period = searchParams.get('period') ?? 'all'

  // Calculate time cutoff
  let cutoff: string | null = null
  const now = new Date()
  if (period === 'today') {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    cutoff = start.toISOString()
  } else if (period === 'week') {
    cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  } else if (period === 'month') {
    cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  }

  // Fetch all trades for user in period
  let query = supabase
    .from('trades')
    .select('id, ticker, side, quantity, entry_price, exit_price, pnl, pnl_pct, opened_at, closed_at, broker')
    .eq('user_id', user.id)
    .order('closed_at', { ascending: true })

  if (cutoff) {
    query = query.gte('closed_at', cutoff)
  }

  const { data: trades, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const allTrades = (trades ?? []).map(t => ({
    ...t,
    pnl: Number(t.pnl),
    pnl_pct: Number(t.pnl_pct),
    quantity: Number(t.quantity),
    entry_price: Number(t.entry_price),
    exit_price: Number(t.exit_price),
  }))

  // Stats
  const wins = allTrades.filter(t => t.pnl > 0)
  const losses = allTrades.filter(t => t.pnl < 0)
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0)
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0))
  const totalPnl = allTrades.reduce((s, t) => s + t.pnl, 0)
  const totalTrades = allTrades.length

  // Streak
  let currentStreak = 0
  let streakType: 'win' | 'loss' | null = null
  for (let i = allTrades.length - 1; i >= 0; i--) {
    const isWin = allTrades[i].pnl > 0
    if (streakType === null) {
      streakType = isWin ? 'win' : 'loss'
      currentStreak = 1
    } else if ((isWin && streakType === 'win') || (!isWin && streakType === 'loss')) {
      currentStreak++
    } else {
      break
    }
  }

  // Equity curve
  let cumPnl = 0
  const equity_curve = allTrades.map(t => {
    cumPnl += t.pnl
    return { date: t.closed_at, cumulative_pnl: Math.round(cumPnl * 100) / 100 }
  })

  // By ticker
  const tickerMap = new Map<string, { pnls: number[] }>()
  for (const t of allTrades) {
    if (!tickerMap.has(t.ticker)) tickerMap.set(t.ticker, { pnls: [] })
    tickerMap.get(t.ticker)!.pnls.push(t.pnl)
  }
  const by_ticker = Array.from(tickerMap.entries())
    .map(([ticker, { pnls }]) => ({
      ticker,
      trades: pnls.length,
      pnl: Math.round(pnls.reduce((s, p) => s + p, 0) * 100) / 100,
      win_rate: Math.round((pnls.filter(p => p > 0).length / pnls.length) * 100 * 10) / 10,
    }))
    .sort((a, b) => b.pnl - a.pnl)

  // By side
  function sideStats(side: string) {
    const sideTrades = allTrades.filter(t => t.side === side)
    const sideWins = sideTrades.filter(t => t.pnl > 0).length
    return {
      trades: sideTrades.length,
      pnl: Math.round(sideTrades.reduce((s, t) => s + t.pnl, 0) * 100) / 100,
      win_rate: sideTrades.length > 0 ? Math.round((sideWins / sideTrades.length) * 100 * 10) / 10 : 0,
    }
  }

  // Calendar heatmap
  const calMap = new Map<string, { pnl: number; trades: number }>()
  for (const t of allTrades) {
    const day = t.closed_at.slice(0, 10) // YYYY-MM-DD
    const existing = calMap.get(day) ?? { pnl: 0, trades: 0 }
    existing.pnl += t.pnl
    existing.trades++
    calMap.set(day, existing)
  }
  const calendar = Array.from(calMap.entries())
    .map(([date, data]) => ({ date, pnl: Math.round(data.pnl * 100) / 100, trades: data.trades }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Best/worst trades
  const sorted = [...allTrades].sort((a, b) => b.pnl - a.pnl)
  const best_trades = sorted.slice(0, 5)
  const worst_trades = sorted.slice(-5).reverse()

  return NextResponse.json({
    equity_curve,
    stats: {
      total_trades: totalTrades,
      wins: wins.length,
      losses: losses.length,
      win_rate: totalTrades > 0 ? Math.round((wins.length / totalTrades) * 100 * 10) / 10 : 0,
      profit_factor: grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : grossProfit > 0 ? 999 : 0,
      avg_pnl: totalTrades > 0 ? Math.round((totalPnl / totalTrades) * 100) / 100 : 0,
      total_pnl: Math.round(totalPnl * 100) / 100,
      best_trade: sorted.length > 0 ? sorted[0].pnl : 0,
      worst_trade: sorted.length > 0 ? sorted[sorted.length - 1].pnl : 0,
      current_streak: currentStreak,
      streak_type: streakType,
    },
    by_ticker,
    by_side: { long: sideStats('long'), short: sideStats('short') },
    calendar,
    best_trades,
    worst_trades,
  })
}

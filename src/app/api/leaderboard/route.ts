import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const MIN_TRADES: Record<string, number> = { week: 2, month: 5, all: 10 }

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { searchParams } = req.nextUrl
  const metric = searchParams.get('metric') ?? 'win_rate'
  const period = searchParams.get('period') ?? 'week'
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const limit = 20

  // Calculate time cutoff
  let cutoff: string | null = null
  const now = new Date()
  if (period === 'week') {
    cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  } else if (period === 'month') {
    cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  }

  // Fetch trades
  let query = supabase.from('trades').select('user_id, pnl')
  if (cutoff) {
    query = query.gte('closed_at', cutoff)
  }
  const { data: trades, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Aggregate by user
  const userMap = new Map<string, { pnls: number[] }>()
  for (const t of trades ?? []) {
    if (!userMap.has(t.user_id)) {
      userMap.set(t.user_id, { pnls: [] })
    }
    userMap.get(t.user_id)!.pnls.push(Number(t.pnl))
  }

  const minTrades = MIN_TRADES[period] ?? 2
  const entries: {
    user_id: string
    total_trades: number
    win_rate: number
    total_pnl: number
    profit_factor: number
    avg_pnl: number
  }[] = []

  for (const [user_id, { pnls }] of userMap) {
    if (pnls.length < minTrades) continue

    const wins = pnls.filter(p => p > 0).length
    const grossProfit = pnls.filter(p => p > 0).reduce((s, p) => s + p, 0)
    const grossLoss = Math.abs(pnls.filter(p => p < 0).reduce((s, p) => s + p, 0))
    const totalPnl = pnls.reduce((s, p) => s + p, 0)

    entries.push({
      user_id,
      total_trades: pnls.length,
      win_rate: Math.round((wins / pnls.length) * 100 * 10) / 10,
      total_pnl: Math.round(totalPnl * 100) / 100,
      profit_factor: grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : grossProfit > 0 ? 999 : 0,
      avg_pnl: Math.round((totalPnl / pnls.length) * 100) / 100,
    })
  }

  // Sort by metric
  const sortKey = metric as keyof typeof entries[0]
  entries.sort((a, b) => {
    const av = typeof a[sortKey] === 'number' ? (a[sortKey] as number) : 0
    const bv = typeof b[sortKey] === 'number' ? (b[sortKey] as number) : 0
    return bv - av
  })

  const total = entries.length
  const start = (page - 1) * limit
  const pageEntries = entries.slice(start, start + limit)

  // Find current user's rank
  let current_user_rank: number | undefined
  if (user) {
    const idx = entries.findIndex(e => e.user_id === user.id)
    if (idx >= 0) current_user_rank = idx + 1
  }

  // Fetch user profiles for this page
  const userIds = pageEntries.map(e => e.user_id)
  const { data: users } = await supabase
    .from('users')
    .select('id, username, display_name, avatar_url')
    .in('id', userIds)

  const userLookup = new Map((users ?? []).map(u => [u.id, u]))

  const result = pageEntries.map((e, i) => ({
    rank: start + i + 1,
    user: userLookup.get(e.user_id) ?? { id: e.user_id, username: 'unknown', display_name: null, avatar_url: null },
    total_trades: e.total_trades,
    win_rate: e.win_rate,
    total_pnl: e.total_pnl,
    profit_factor: e.profit_factor,
    avg_pnl: e.avg_pnl,
  }))

  return NextResponse.json({ entries: result, total, page, current_user_rank })
}

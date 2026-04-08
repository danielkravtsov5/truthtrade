import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export const preferredRegion = 'sin1'

/**
 * POST /api/seed-trade
 * Creates a mock trade + post for testing. Authenticated user only.
 * Body (all optional): { ticker, side, pnl }
 */
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  const tickers = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'DOGEUSDT']
  const ticker = body.ticker ?? tickers[Math.floor(Math.random() * tickers.length)]
  const side = body.side ?? (Math.random() > 0.5 ? 'long' : 'short')

  // Random realistic prices
  const basePrices: Record<string, number> = {
    BTCUSDT: 71500, ETHUSDT: 3200, SOLUSDT: 145, BNBUSDT: 580, DOGEUSDT: 0.15,
  }
  const base = basePrices[ticker] ?? 100
  const entryPrice = base * (1 + (Math.random() - 0.5) * 0.02)
  const pnlPct = body.pnl != null
    ? (body.pnl / (entryPrice * 0.5)) * 100
    : (Math.random() - 0.4) * 15 // slight profit bias
  const exitPrice = side === 'long'
    ? entryPrice * (1 + pnlPct / 100)
    : entryPrice * (1 - pnlPct / 100)
  const quantity = ticker === 'BTCUSDT' ? 0.05 + Math.random() * 0.2
    : ticker === 'DOGEUSDT' ? 500 + Math.random() * 2000
    : 1 + Math.random() * 10
  const pnl = side === 'long'
    ? (exitPrice - entryPrice) * quantity
    : (entryPrice - exitPrice) * quantity

  // Random open/close times in last 24h
  const closedAt = new Date(Date.now() - Math.random() * 3600_000) // last hour
  const holdMinutes = 5 + Math.floor(Math.random() * 240)
  const openedAt = new Date(closedAt.getTime() - holdMinutes * 60_000)

  const brokerTradeId = `mock_${user.id}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  const { data: trade, error: tradeError } = await supabase
    .from('trades')
    .insert({
      user_id: user.id,
      broker: 'binance',
      broker_trade_id: brokerTradeId,
      ticker,
      side,
      quantity: Math.round(quantity * 1e6) / 1e6,
      entry_price: Math.round(entryPrice * 1e4) / 1e4,
      exit_price: Math.round(exitPrice * 1e4) / 1e4,
      pnl: Math.round(pnl * 100) / 100,
      pnl_pct: Math.round(pnlPct * 100) / 100,
      opened_at: openedAt.toISOString(),
      closed_at: closedAt.toISOString(),
      raw_data: { mock: true },
    })
    .select()
    .single()

  if (tradeError) {
    return NextResponse.json({ error: tradeError.message }, { status: 500 })
  }

  const { error: postError } = await supabase
    .from('posts')
    .insert({ user_id: user.id, trade_id: trade.id, analysis: null })

  if (postError) {
    return NextResponse.json({ error: postError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    trade: {
      ticker,
      side,
      pnl: trade.pnl,
      pnl_pct: trade.pnl_pct,
      entry_price: trade.entry_price,
      exit_price: trade.exit_price,
    },
  })
}

import crypto from 'crypto'

const BASE_URL = 'https://api.binance.com'

// Common USDT trading pairs to poll (user can add more via settings)
export const DEFAULT_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'MATICUSDT',
]

function sign(queryString: string, secret: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update(queryString)
    .digest('hex')
}

async function signedRequest<T>(
  apiKey: string,
  apiSecret: string,
  endpoint: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  const timestamp = Date.now()
  const queryParams = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    timestamp: String(timestamp),
  })
  const signature = sign(queryParams.toString(), apiSecret)
  queryParams.set('signature', signature)

  const res = await fetch(`${BASE_URL}${endpoint}?${queryParams}`, {
    headers: { 'X-MBX-APIKEY': apiKey },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Binance API error ${res.status}: ${JSON.stringify(err)}`)
  }

  return res.json()
}

export interface BinanceTrade {
  symbol: string
  id: number
  orderId: number
  price: string
  qty: string
  quoteQty: string
  commission: string
  commissionAsset: string
  time: number
  isBuyer: boolean
  isMaker: boolean
  isBestMatch: boolean
}

export interface BinanceOrder {
  symbol: string
  orderId: number
  clientOrderId: string
  price: string
  origQty: string
  executedQty: string
  status: string
  type: string
  side: string   // BUY | SELL
  time: number
  updateTime: number
  fills?: Array<{ price: string; qty: string }>
}

/** Fetch recent trades for a symbol since a given time */
export async function getTradesForSymbol(
  apiKey: string,
  apiSecret: string,
  symbol: string,
  startTime?: number
): Promise<BinanceTrade[]> {
  const params: Record<string, string | number> = { symbol, limit: 500 }
  if (startTime) params.startTime = startTime
  return signedRequest<BinanceTrade[]>(apiKey, apiSecret, '/api/v3/myTrades', params)
}

/** Fetch recent orders for a symbol since a given time */
export async function getOrdersForSymbol(
  apiKey: string,
  apiSecret: string,
  symbol: string,
  startTime?: number
): Promise<BinanceOrder[]> {
  const params: Record<string, string | number> = { symbol, limit: 500 }
  if (startTime) params.startTime = startTime
  return signedRequest<BinanceOrder[]>(apiKey, apiSecret, '/api/v3/allOrders', params)
}

/** Verify that an API key is valid and has read permissions */
export async function verifyApiKey(apiKey: string, apiSecret: string): Promise<boolean> {
  try {
    await signedRequest(apiKey, apiSecret, '/api/v3/account')
    return true
  } catch (err) {
    console.error('Binance verifyApiKey failed:', err)
    return false
  }
}

import type { NormalizedFill } from '@/types'

/** Convert raw Binance trades into NormalizedFills for the position tracker. */
export function normalizeFills(trades: BinanceTrade[], symbol: string): NormalizedFill[] {
  return trades.map((t) => ({
    fill_id: `binance_${t.id}`,
    ticker: symbol,
    side: t.isBuyer ? 'buy' as const : 'sell' as const,
    quantity: parseFloat(t.qty),
    price: parseFloat(t.price),
    timestamp: new Date(t.time).toISOString(),
    raw: t as unknown as Record<string, unknown>,
  }))
}

/**
 * Match BUY fills and SELL fills for a symbol into completed round-trip trades.
 * Uses FIFO matching: each SELL closes the earliest open BUY position.
 *
 * Returns an array of closed trades with entry/exit prices and P&L.
 */
export function matchTrades(trades: BinanceTrade[], symbol: string) {
  // Sort by time ascending
  const sorted = [...trades].sort((a, b) => a.time - b.time)

  const buyQueue: { price: number; qty: number; time: number; id: number }[] = []
  const closedTrades: {
    broker_trade_id: string
    ticker: string
    side: 'long' | 'short'
    quantity: number
    entry_price: number
    exit_price: number
    pnl: number
    pnl_pct: number
    opened_at: string
    closed_at: string
    raw_data: object
  }[] = []

  for (const trade of sorted) {
    const price = parseFloat(trade.price)
    const qty = parseFloat(trade.qty)

    if (trade.isBuyer) {
      buyQueue.push({ price, qty, time: trade.time, id: trade.id })
    } else {
      // SELL — match against oldest buy
      let remainingQty = qty
      while (remainingQty > 0 && buyQueue.length > 0) {
        const buy = buyQueue[0]
        const matchedQty = Math.min(buy.qty, remainingQty)
        const entryPrice = buy.price
        const exitPrice = price
        const pnl = (exitPrice - entryPrice) * matchedQty
        const pnlPct = ((exitPrice - entryPrice) / entryPrice) * 100

        closedTrades.push({
          broker_trade_id: `${symbol}_${buy.id}_${trade.id}`,
          ticker: symbol,
          side: 'long',
          quantity: matchedQty,
          entry_price: entryPrice,
          exit_price: exitPrice,
          pnl: Math.round(pnl * 100) / 100,
          pnl_pct: Math.round(pnlPct * 100) / 100,
          opened_at: new Date(buy.time).toISOString(),
          closed_at: new Date(trade.time).toISOString(),
          raw_data: { buy_trade: buy, sell_trade: trade },
        })

        buy.qty -= matchedQty
        remainingQty -= matchedQty
        if (buy.qty <= 0) buyQueue.shift()
      }
    }
  }

  return closedTrades
}

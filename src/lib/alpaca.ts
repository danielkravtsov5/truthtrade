const LIVE_BASE = 'https://api.alpaca.markets'
const PAPER_BASE = 'https://paper-api.alpaca.markets'

function getBaseUrl(paper = false) {
  return paper ? PAPER_BASE : LIVE_BASE
}

async function apiRequest<T>(
  apiKey: string,
  apiSecret: string,
  endpoint: string,
  paper = false,
  params?: Record<string, string | number>
): Promise<T> {
  let url = `${getBaseUrl(paper)}${endpoint}`

  if (params) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
    ).toString()
    if (qs) url += `?${qs}`
  }

  const res = await fetch(url, {
    headers: {
      'APCA-API-KEY-ID': apiKey,
      'APCA-API-SECRET-KEY': apiSecret,
    },
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Alpaca API error ${res.status}: ${err}`)
  }

  return res.json()
}

export interface AlpacaActivity {
  id: string
  activity_type: string
  symbol: string
  side: 'buy' | 'sell'
  qty: string
  price: string
  cum_qty: string
  transaction_time: string
  order_id: string
  type: string
}

export async function getFills(
  apiKey: string,
  apiSecret: string,
  paper = false,
  after?: string
): Promise<AlpacaActivity[]> {
  const allFills: AlpacaActivity[] = []
  let pageToken = ''

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const params: Record<string, string | number> = {
      activity_types: 'FILL',
      direction: 'asc',
      page_size: 100,
    }
    if (after && !pageToken) params.after = after
    if (pageToken) params.page_token = pageToken

    const fills = await apiRequest<AlpacaActivity[]>(
      apiKey, apiSecret, '/v2/account/activities', paper, params
    )

    allFills.push(...fills)
    if (fills.length < 100) break
    pageToken = fills[fills.length - 1].id
  }

  return allFills
}

export async function verifyApiKey(
  apiKey: string,
  apiSecret: string,
  paper = false
): Promise<boolean> {
  try {
    await apiRequest(apiKey, apiSecret, '/v2/account', paper)
    return true
  } catch {
    return false
  }
}

import type { NormalizedFill } from '@/types'

/** Convert raw Alpaca fills into NormalizedFills. */
export function normalizeFills(fills: AlpacaActivity[]): NormalizedFill[] {
  return fills.map((f) => ({
    fill_id: `alpaca_${f.id}`,
    ticker: f.symbol,
    side: f.side as 'buy' | 'sell',
    quantity: parseFloat(f.qty),
    price: parseFloat(f.price),
    timestamp: f.transaction_time,
    raw: f as unknown as Record<string, unknown>,
  }))
}

export function matchFills(fills: AlpacaActivity[]) {
  // Group by symbol
  const bySymbol = new Map<string, AlpacaActivity[]>()
  for (const fill of fills) {
    const existing = bySymbol.get(fill.symbol) ?? []
    existing.push(fill)
    bySymbol.set(fill.symbol, existing)
  }

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

  for (const [symbol, symbolFills] of bySymbol) {
    const sorted = [...symbolFills].sort(
      (a, b) => new Date(a.transaction_time).getTime() - new Date(b.transaction_time).getTime()
    )
    const buyQueue: { price: number; qty: number; time: string; id: string }[] = []

    for (const fill of sorted) {
      const price = parseFloat(fill.price)
      const qty = parseFloat(fill.qty)

      if (fill.side === 'buy') {
        buyQueue.push({ price, qty, time: fill.transaction_time, id: fill.id })
      } else {
        let remainingQty = qty
        while (remainingQty > 0 && buyQueue.length > 0) {
          const buy = buyQueue[0]
          const matchedQty = Math.min(buy.qty, remainingQty)
          const pnl = (price - buy.price) * matchedQty
          const pnlPct = ((price - buy.price) / buy.price) * 100

          closedTrades.push({
            broker_trade_id: `alpaca_${buy.id}_${fill.id}`,
            ticker: symbol,
            side: 'long',
            quantity: matchedQty,
            entry_price: buy.price,
            exit_price: price,
            pnl: Math.round(pnl * 100) / 100,
            pnl_pct: Math.round(pnlPct * 100) / 100,
            opened_at: buy.time,
            closed_at: fill.transaction_time,
            raw_data: { buy_fill: buy, sell_fill: fill },
          })

          buy.qty -= matchedQty
          remainingQty -= matchedQty
          if (buy.qty <= 0) buyQueue.shift()
        }
      }
    }
  }

  return closedTrades
}

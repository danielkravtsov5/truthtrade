import crypto from 'crypto'

const BASE_URL = 'https://api.kraken.com'

function getSignature(path: string, nonce: number, postData: string, secret: string): string {
  const message = nonce + postData
  const hash = crypto.createHash('sha256').update(message).digest()
  const hmac = crypto.createHmac('sha512', Buffer.from(secret, 'base64'))
  hmac.update(Buffer.concat([Buffer.from(path), hash]))
  return hmac.digest('base64')
}

async function privateRequest<T>(
  apiKey: string,
  apiSecret: string,
  endpoint: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  const nonce = Date.now() * 1000
  const body = new URLSearchParams({
    nonce: String(nonce),
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  }).toString()

  const path = `/0/private/${endpoint}`
  const signature = getSignature(path, nonce, body, apiSecret)

  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'API-Key': apiKey,
      'API-Sign': signature,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  if (!res.ok) {
    throw new Error(`Kraken API error ${res.status}`)
  }

  const data = await res.json()
  if (data.error && data.error.length > 0) {
    throw new Error(`Kraken error: ${data.error.join(', ')}`)
  }

  return data.result as T
}

export interface KrakenTrade {
  ordertxid: string
  pair: string
  time: number
  type: 'buy' | 'sell'
  ordertype: string
  price: string
  cost: string
  fee: string
  vol: string
  margin: string
  misc: string
}

interface TradesHistoryResult {
  trades: Record<string, KrakenTrade>
  count: number
}

export async function getTradesHistory(
  apiKey: string,
  apiSecret: string,
  start?: number
): Promise<KrakenTrade[]> {
  const params: Record<string, string | number> = {}
  if (start) params.start = start

  const result = await privateRequest<TradesHistoryResult>(
    apiKey, apiSecret, 'TradesHistory', params
  )

  return Object.entries(result.trades).map(([id, trade]) => ({
    ...trade,
    ordertxid: id,
  }))
}

export async function verifyApiKey(apiKey: string, apiSecret: string): Promise<boolean> {
  try {
    await privateRequest(apiKey, apiSecret, 'Balance')
    return true
  } catch {
    return false
  }
}

import type { NormalizedFill } from '@/types'

/** Convert raw Kraken trades into NormalizedFills. */
export function normalizeFills(trades: KrakenTrade[]): NormalizedFill[] {
  return trades.map((t) => ({
    fill_id: `kraken_${t.ordertxid}`,
    ticker: t.pair,
    side: t.type as 'buy' | 'sell',
    quantity: parseFloat(t.vol),
    price: parseFloat(t.price),
    timestamp: new Date(t.time * 1000).toISOString(),
    raw: t as unknown as Record<string, unknown>,
  }))
}

export function matchTrades(trades: KrakenTrade[]) {
  // Group by pair
  const byPair = new Map<string, KrakenTrade[]>()
  for (const trade of trades) {
    const existing = byPair.get(trade.pair) ?? []
    existing.push(trade)
    byPair.set(trade.pair, existing)
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

  for (const [pair, pairTrades] of byPair) {
    const sorted = [...pairTrades].sort((a, b) => a.time - b.time)
    const buyQueue: { price: number; qty: number; time: number; id: string }[] = []

    for (const trade of sorted) {
      const price = parseFloat(trade.price)
      const qty = parseFloat(trade.vol)

      if (trade.type === 'buy') {
        buyQueue.push({ price, qty, time: trade.time, id: trade.ordertxid })
      } else {
        let remainingQty = qty
        while (remainingQty > 0 && buyQueue.length > 0) {
          const buy = buyQueue[0]
          const matchedQty = Math.min(buy.qty, remainingQty)
          const pnl = (price - buy.price) * matchedQty
          const pnlPct = ((price - buy.price) / buy.price) * 100

          closedTrades.push({
            broker_trade_id: `kraken_${buy.id}_${trade.ordertxid}`,
            ticker: pair,
            side: 'long',
            quantity: matchedQty,
            entry_price: buy.price,
            exit_price: price,
            pnl: Math.round(pnl * 100) / 100,
            pnl_pct: Math.round(pnlPct * 100) / 100,
            opened_at: new Date(buy.time * 1000).toISOString(),
            closed_at: new Date(trade.time * 1000).toISOString(),
            raw_data: { buy_trade: buy, sell_trade: trade },
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

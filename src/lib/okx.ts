import crypto from 'crypto'

const BASE_URL = 'https://www.okx.com'

function sign(timestamp: string, method: string, path: string, body: string, secret: string): string {
  const preSign = timestamp + method + path + body
  return crypto.createHmac('sha256', secret).update(preSign).digest('base64')
}

async function signedRequest<T>(
  apiKey: string,
  apiSecret: string,
  passphrase: string,
  method: 'GET' | 'POST',
  endpoint: string,
  params?: Record<string, string | number>
): Promise<T> {
  const timestamp = new Date().toISOString()
  let url = `${BASE_URL}${endpoint}`
  let body = ''

  if (method === 'GET' && params) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
    ).toString()
    if (qs) url += `?${qs}`
  } else if (method === 'POST' && params) {
    body = JSON.stringify(params)
  }

  const pathForSign = method === 'GET' && params
    ? `${endpoint}?${new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))).toString()}`
    : endpoint

  const signature = sign(timestamp, method, pathForSign, method === 'POST' ? body : '', apiSecret)

  const res = await fetch(url, {
    method,
    headers: {
      'OK-ACCESS-KEY': apiKey,
      'OK-ACCESS-SIGN': signature,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': passphrase,
      'Content-Type': 'application/json',
    },
    ...(method === 'POST' && body ? { body } : {}),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OKX API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  if (data.code !== '0') {
    throw new Error(`OKX error ${data.code}: ${data.msg}`)
  }

  return data.data as T
}

export interface OkxFill {
  instId: string
  tradeId: string
  ordId: string
  side: 'buy' | 'sell'
  fillPx: string
  fillSz: string
  ts: string
  instType: string
  fee: string
  feeCcy: string
}

export async function getFillsHistory(
  apiKey: string,
  apiSecret: string,
  passphrase: string,
  instType: 'SPOT' | 'MARGIN' | 'SWAP' | 'FUTURES' = 'SPOT',
  startTime?: number
): Promise<OkxFill[]> {
  const allFills: OkxFill[] = []
  let after = ''

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const params: Record<string, string | number> = { instType, limit: 100 }
    if (startTime && !after) params.begin = startTime
    if (after) params.after = after

    const fills = await signedRequest<OkxFill[]>(
      apiKey, apiSecret, passphrase, 'GET',
      '/api/v5/trade/fills-history', params
    )

    allFills.push(...fills)
    if (fills.length < 100) break
    after = fills[fills.length - 1].tradeId
  }

  return allFills
}

export async function verifyApiKey(
  apiKey: string,
  apiSecret: string,
  passphrase: string
): Promise<boolean> {
  try {
    await signedRequest(
      apiKey, apiSecret, passphrase, 'GET',
      '/api/v5/account/balance', {}
    )
    return true
  } catch {
    return false
  }
}

import type { NormalizedFill } from '@/types'

/** Convert raw OKX fills into NormalizedFills. */
export function normalizeFills(fills: OkxFill[]): NormalizedFill[] {
  return fills.map((f) => ({
    fill_id: `okx_${f.tradeId}`,
    ticker: f.instId,
    side: f.side as 'buy' | 'sell',
    quantity: parseFloat(f.fillSz),
    price: parseFloat(f.fillPx),
    timestamp: new Date(Number(f.ts)).toISOString(),
    raw: f as unknown as Record<string, unknown>,
  }))
}

export function matchFills(fills: OkxFill[]) {
  // Group by instrument
  const byInst = new Map<string, OkxFill[]>()
  for (const fill of fills) {
    const existing = byInst.get(fill.instId) ?? []
    existing.push(fill)
    byInst.set(fill.instId, existing)
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

  for (const [instId, instFills] of byInst) {
    const sorted = [...instFills].sort((a, b) => Number(a.ts) - Number(b.ts))
    const buyQueue: { price: number; qty: number; ts: string; id: string }[] = []

    for (const fill of sorted) {
      const price = parseFloat(fill.fillPx)
      const qty = parseFloat(fill.fillSz)

      if (fill.side === 'buy') {
        buyQueue.push({ price, qty, ts: fill.ts, id: fill.tradeId })
      } else {
        let remainingQty = qty
        while (remainingQty > 0 && buyQueue.length > 0) {
          const buy = buyQueue[0]
          const matchedQty = Math.min(buy.qty, remainingQty)
          const pnl = (price - buy.price) * matchedQty
          const pnlPct = ((price - buy.price) / buy.price) * 100

          closedTrades.push({
            broker_trade_id: `okx_${buy.id}_${fill.tradeId}`,
            ticker: instId,
            side: 'long',
            quantity: matchedQty,
            entry_price: buy.price,
            exit_price: price,
            pnl: Math.round(pnl * 100) / 100,
            pnl_pct: Math.round(pnlPct * 100) / 100,
            opened_at: new Date(Number(buy.ts)).toISOString(),
            closed_at: new Date(Number(fill.ts)).toISOString(),
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

import * as jose from 'jose'
import crypto from 'crypto'

const BASE_URL = 'https://api.coinbase.com'

async function createJwt(
  keyName: string,
  privateKeyPem: string,
  method: string,
  path: string
): Promise<string> {
  const privateKey = await jose.importPKCS8(privateKeyPem, 'ES256')
  const uri = `${method} api.coinbase.com${path}`

  const jwt = await new jose.SignJWT({
    sub: keyName,
    iss: 'cdp',
    uri,
  })
    .setProtectedHeader({
      alg: 'ES256',
      kid: keyName,
      nonce: crypto.randomBytes(16).toString('hex'),
      typ: 'JWT',
    })
    .setIssuedAt()
    .setExpirationTime('2m')
    .setNotBefore(Math.floor(Date.now() / 1000))
    .sign(privateKey)

  return jwt
}

async function apiRequest<T>(
  keyName: string,
  privateKey: string,
  method: 'GET' | 'POST',
  endpoint: string,
  params?: Record<string, string | number>
): Promise<T> {
  let url = `${BASE_URL}${endpoint}`
  let body: string | undefined

  if (method === 'GET' && params) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
    ).toString()
    if (qs) url += `?${qs}`
  } else if (method === 'POST' && params) {
    body = JSON.stringify(params)
  }

  const pathWithQuery = method === 'GET' && params
    ? `${endpoint}?${new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))).toString()}`
    : endpoint

  const jwt = await createJwt(keyName, privateKey, method, pathWithQuery)

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body } : {}),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Coinbase API error ${res.status}: ${err}`)
  }

  return res.json()
}

export interface CoinbaseFill {
  entry_id: string
  trade_id: string
  order_id: string
  product_id: string
  side: 'BUY' | 'SELL'
  price: string
  size: string
  trade_time: string
  commission: string
}

interface FillsResponse {
  fills: CoinbaseFill[]
  cursor: string
}

export async function getFills(
  keyName: string,
  privateKey: string,
  startDate?: string
): Promise<CoinbaseFill[]> {
  const allFills: CoinbaseFill[] = []
  let cursor = ''

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const params: Record<string, string | number> = { limit: 1000 }
    if (startDate && !cursor) params.start_sequence_timestamp = startDate
    if (cursor) params.cursor = cursor

    const data = await apiRequest<FillsResponse>(
      keyName, privateKey, 'GET',
      '/api/v3/brokerage/orders/historical/fills', params
    )

    allFills.push(...data.fills)
    if (!data.cursor || data.fills.length < 1000) break
    cursor = data.cursor
  }

  return allFills
}

export async function verifyApiKey(
  keyName: string,
  privateKey: string
): Promise<boolean> {
  try {
    await apiRequest(keyName, privateKey, 'GET', '/api/v3/brokerage/accounts', {})
    return true
  } catch {
    return false
  }
}

export function matchFills(fills: CoinbaseFill[]) {
  // Group by product
  const byProduct = new Map<string, CoinbaseFill[]>()
  for (const fill of fills) {
    const existing = byProduct.get(fill.product_id) ?? []
    existing.push(fill)
    byProduct.set(fill.product_id, existing)
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

  for (const [productId, productFills] of byProduct) {
    const sorted = [...productFills].sort(
      (a, b) => new Date(a.trade_time).getTime() - new Date(b.trade_time).getTime()
    )
    const buyQueue: { price: number; qty: number; time: string; id: string }[] = []

    for (const fill of sorted) {
      const price = parseFloat(fill.price)
      const qty = parseFloat(fill.size)

      if (fill.side === 'BUY') {
        buyQueue.push({ price, qty, time: fill.trade_time, id: fill.entry_id })
      } else {
        let remainingQty = qty
        while (remainingQty > 0 && buyQueue.length > 0) {
          const buy = buyQueue[0]
          const matchedQty = Math.min(buy.qty, remainingQty)
          const pnl = (price - buy.price) * matchedQty
          const pnlPct = ((price - buy.price) / buy.price) * 100

          closedTrades.push({
            broker_trade_id: `coinbase_${buy.id}_${fill.entry_id}`,
            ticker: productId,
            side: 'long',
            quantity: matchedQty,
            entry_price: buy.price,
            exit_price: price,
            pnl: Math.round(pnl * 100) / 100,
            pnl_pct: Math.round(pnlPct * 100) / 100,
            opened_at: buy.time,
            closed_at: fill.trade_time,
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

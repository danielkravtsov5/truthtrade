import crypto from 'crypto'

const BASE_URL = 'https://api.bybit.com'
const RECV_WINDOW = '5000'

function sign(params: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(params).digest('hex')
}

async function signedRequest<T>(
  apiKey: string,
  apiSecret: string,
  endpoint: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  const timestamp = Date.now().toString()
  const queryString = new URLSearchParams(
    Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
  ).toString()

  const signPayload = timestamp + apiKey + RECV_WINDOW + queryString
  const signature = sign(signPayload, apiSecret)

  const url = queryString
    ? `${BASE_URL}${endpoint}?${queryString}`
    : `${BASE_URL}${endpoint}`

  const res = await fetch(url, {
    headers: {
      'X-BAPI-API-KEY': apiKey,
      'X-BAPI-SIGN': signature,
      'X-BAPI-TIMESTAMP': timestamp,
      'X-BAPI-RECV-WINDOW': RECV_WINDOW,
    },
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Bybit API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  if (data.retCode !== 0) {
    throw new Error(`Bybit error ${data.retCode}: ${data.retMsg}`)
  }

  return data.result as T
}

export interface BybitExecution {
  symbol: string
  orderId: string
  execId: string
  side: 'Buy' | 'Sell'
  execPrice: string
  execQty: string
  execTime: string
  category: string
}

interface ExecutionListResult {
  list: BybitExecution[]
  nextPageCursor: string
}

export async function getExecutions(
  apiKey: string,
  apiSecret: string,
  category: 'spot' | 'linear' | 'inverse' = 'spot',
  startTime?: number
): Promise<BybitExecution[]> {
  const allExecs: BybitExecution[] = []
  let cursor = ''

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const params: Record<string, string | number> = { category, limit: 100 }
    if (startTime) params.startTime = startTime
    if (cursor) params.cursor = cursor

    const result = await signedRequest<ExecutionListResult>(
      apiKey, apiSecret, '/v5/execution/list', params
    )

    allExecs.push(...result.list)
    if (!result.nextPageCursor || result.list.length < 100) break
    cursor = result.nextPageCursor
  }

  return allExecs
}

export async function verifyApiKey(apiKey: string, apiSecret: string): Promise<boolean> {
  try {
    await signedRequest(apiKey, apiSecret, '/v5/account/wallet-balance', { accountType: 'UNIFIED' })
    return true
  } catch {
    return false
  }
}

export function matchExecutions(execs: BybitExecution[]) {
  const sorted = [...execs].sort(
    (a, b) => Number(a.execTime) - Number(b.execTime)
  )

  const buyQueue: { price: number; qty: number; time: string; id: string }[] = []
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

  for (const exec of sorted) {
    const price = parseFloat(exec.execPrice)
    const qty = parseFloat(exec.execQty)

    if (exec.side === 'Buy') {
      buyQueue.push({ price, qty, time: exec.execTime, id: exec.execId })
    } else {
      let remainingQty = qty
      while (remainingQty > 0 && buyQueue.length > 0) {
        const buy = buyQueue[0]
        const matchedQty = Math.min(buy.qty, remainingQty)
        const pnl = (price - buy.price) * matchedQty
        const pnlPct = ((price - buy.price) / buy.price) * 100

        closedTrades.push({
          broker_trade_id: `bybit_${buy.id}_${exec.execId}`,
          ticker: exec.symbol,
          side: 'long',
          quantity: matchedQty,
          entry_price: buy.price,
          exit_price: price,
          pnl: Math.round(pnl * 100) / 100,
          pnl_pct: Math.round(pnlPct * 100) / 100,
          opened_at: new Date(Number(buy.time)).toISOString(),
          closed_at: new Date(Number(exec.execTime)).toISOString(),
          raw_data: { buy_exec: buy, sell_exec: exec },
        })

        buy.qty -= matchedQty
        remainingQty -= matchedQty
        if (buy.qty <= 0) buyQueue.shift()
      }
    }
  }

  return closedTrades
}

const LIVE_BASE = 'https://api-fxtrade.oanda.com'
const PRACTICE_BASE = 'https://api-fxpractice.oanda.com'

function getBaseUrl(practice = false) {
  return practice ? PRACTICE_BASE : LIVE_BASE
}

async function apiRequest<T>(
  token: string,
  endpoint: string,
  practice = false,
  params?: Record<string, string | number>
): Promise<T> {
  let url = `${getBaseUrl(practice)}${endpoint}`

  if (params) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
    ).toString()
    if (qs) url += `?${qs}`
  }

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OANDA API error ${res.status}: ${err}`)
  }

  return res.json()
}

export interface OandaAccount {
  id: string
  currency: string
  balance: string
}

interface AccountsResponse {
  accounts: { id: string; tags: string[] }[]
}

export async function getAccounts(
  token: string,
  practice = false
): Promise<{ id: string }[]> {
  const data = await apiRequest<AccountsResponse>(token, '/v3/accounts', practice)
  return data.accounts
}

export interface OandaTransaction {
  id: string
  type: string
  instrument?: string
  time: string
  units?: string
  price?: string
  pl?: string
  reason?: string
  tradesClosed?: { tradeID: string; units: string; realizedPL: string; price: string }[]
}

interface TransactionsResponse {
  transactions: OandaTransaction[]
  pageSize: number
  count: number
  pages?: string[]
}

export async function getTransactions(
  token: string,
  accountId: string,
  practice = false,
  from?: string
): Promise<OandaTransaction[]> {
  const params: Record<string, string | number> = {
    type: 'ORDER_FILL',
    pageSize: 1000,
  }
  if (from) params.from = from

  const data = await apiRequest<TransactionsResponse>(
    token, `/v3/accounts/${accountId}/transactions`, practice, params
  )

  return data.transactions
}

export async function verifyToken(
  token: string,
  practice = false
): Promise<{ valid: boolean; accountId?: string }> {
  try {
    const accounts = await getAccounts(token, practice)
    if (accounts.length === 0) return { valid: false }
    return { valid: true, accountId: accounts[0].id }
  } catch {
    return { valid: false }
  }
}

import type { NormalizedFill } from '@/types'

/** Convert raw OANDA transactions into NormalizedFills. */
export function normalizeFills(transactions: OandaTransaction[]): NormalizedFill[] {
  const fills: NormalizedFill[] = []
  for (const tx of transactions) {
    if (!tx.instrument || !tx.units || !tx.price) continue
    const units = parseFloat(tx.units)
    fills.push({
      fill_id: `oanda_${tx.id}`,
      ticker: tx.instrument,
      side: units > 0 ? 'buy' : 'sell',
      quantity: Math.abs(units),
      price: parseFloat(tx.price),
      timestamp: tx.time,
      raw: tx as unknown as Record<string, unknown>,
    })
  }
  return fills
}

export function matchTransactions(transactions: OandaTransaction[]) {
  // OANDA ORDER_FILL transactions with tradesClosed already contain P&L
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

  for (const tx of transactions) {
    if (!tx.tradesClosed || tx.tradesClosed.length === 0) continue
    if (!tx.instrument) continue

    for (const closed of tx.tradesClosed) {
      const units = parseFloat(closed.units)
      const exitPrice = parseFloat(closed.price)
      const pnl = parseFloat(closed.realizedPL)
      // Units negative = was a short position being closed
      const side: 'long' | 'short' = units < 0 ? 'long' : 'short'
      const qty = Math.abs(units)

      // Approximate entry price from P&L
      // For long: pnl = (exit - entry) * qty → entry = exit - pnl/qty
      // For short: pnl = (entry - exit) * qty → entry = exit + pnl/qty
      const entryPrice = side === 'long'
        ? exitPrice - (pnl / qty)
        : exitPrice + (pnl / qty)

      const pnlPct = entryPrice !== 0 ? (pnl / (Math.abs(entryPrice) * qty)) * 100 : 0

      closedTrades.push({
        broker_trade_id: `oanda_${closed.tradeID}_${tx.id}`,
        ticker: tx.instrument,
        side,
        quantity: qty,
        entry_price: Math.round(entryPrice * 100000) / 100000,
        exit_price: exitPrice,
        pnl: Math.round(pnl * 100) / 100,
        pnl_pct: Math.round(pnlPct * 100) / 100,
        opened_at: tx.time, // close time (we don't have open time from this endpoint)
        closed_at: tx.time,
        raw_data: { transaction: tx, closedTrade: closed },
      })
    }
  }

  return closedTrades
}

const DEMO_BASE = 'https://demo.tradovateapi.com/v1'
const LIVE_BASE = 'https://live.tradovateapi.com/v1'

function getBaseUrl(demo = false) {
  return demo ? DEMO_BASE : LIVE_BASE
}

// --- Authentication ---

export async function getAccessToken(
  username: string,
  password: string,
  options?: { demo?: boolean }
): Promise<{ accessToken: string; expiresAt: string }> {
  const base = getBaseUrl(options?.demo)
  const res = await fetch(`${base}/auth/accesstokenrequest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: username,
      password,
      appId: process.env.TRADOVATE_APP_ID,
      appVersion: '1.0',
      cid: process.env.TRADOVATE_CID,
      sec: process.env.TRADOVATE_SECRET,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Tradovate auth failed: ${err}`)
  }

  const data = await res.json()
  if (data.errorText) throw new Error(data.errorText)

  return {
    accessToken: data.accessToken,
    expiresAt: data.expirationTime,
  }
}

export async function renewAccessToken(accessToken: string, demo = false): Promise<string> {
  const base = getBaseUrl(demo)
  const res = await fetch(`${base}/auth/renewaccesstoken`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) throw new Error('Failed to renew Tradovate token')
  const data = await res.json()
  return data.accessToken
}

// --- Account ---

export async function getAccounts(accessToken: string, demo = false) {
  const base = getBaseUrl(demo)
  const res = await fetch(`${base}/account/list`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Failed to fetch Tradovate accounts')
  return res.json()
}

// --- Fills (trade history) ---

export interface TradovateFill {
  id: number
  orderId: number
  contractId: number
  timestamp: string
  tradeDate: { year: number; month: number; day: number }
  action: 'Buy' | 'Sell'
  qty: number
  price: number
  active: boolean
  finallyPaired: number
}

export async function getFills(accessToken: string, demo = false): Promise<TradovateFill[]> {
  const base = getBaseUrl(demo)
  const res = await fetch(`${base}/fill/list`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Failed to fetch Tradovate fills')
  return res.json()
}

// --- Contracts (to resolve symbol names) ---

interface TradovateContract {
  id: number
  name: string
  contractMaturityId: number
  status: string
  providerTickSize: number
}

const contractCache = new Map<number, string>()

export async function getContractName(
  accessToken: string,
  contractId: number,
  demo = false
): Promise<string> {
  if (contractCache.has(contractId)) return contractCache.get(contractId)!

  const base = getBaseUrl(demo)
  const res = await fetch(`${base}/contract/item?id=${contractId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return `Contract#${contractId}`
  const contract: TradovateContract = await res.json()
  contractCache.set(contractId, contract.name)
  return contract.name
}

// --- Match fills into round-trip trades ---

export interface MatchedTrade {
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
  raw_data: Record<string, unknown>
}

export async function matchFillsToTrades(
  accessToken: string,
  fills: TradovateFill[],
  demo = false
): Promise<MatchedTrade[]> {
  // Group fills by contractId
  const byContract = new Map<number, TradovateFill[]>()
  for (const fill of fills) {
    const existing = byContract.get(fill.contractId) ?? []
    existing.push(fill)
    byContract.set(fill.contractId, existing)
  }

  const trades: MatchedTrade[] = []

  for (const [contractId, contractFills] of byContract) {
    const ticker = await getContractName(accessToken, contractId, demo)

    // Sort by timestamp
    contractFills.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    // FIFO matching: buys open, sells close (or vice versa)
    const buyQueue: TradovateFill[] = []
    const sellQueue: TradovateFill[] = []

    for (const fill of contractFills) {
      if (fill.action === 'Buy') {
        // Check if this closes a short
        if (sellQueue.length > 0) {
          const entry = sellQueue.shift()!
          const qty = Math.min(entry.qty, fill.qty)
          const pnl = (entry.price - fill.price) * qty
          const pnlPct = ((entry.price - fill.price) / entry.price) * 100

          trades.push({
            broker_trade_id: `tv_${entry.id}_${fill.id}`,
            ticker,
            side: 'short',
            quantity: qty,
            entry_price: entry.price,
            exit_price: fill.price,
            pnl,
            pnl_pct: pnlPct,
            opened_at: entry.timestamp,
            closed_at: fill.timestamp,
            raw_data: { entry_fill: entry, exit_fill: fill },
          })
        } else {
          buyQueue.push(fill)
        }
      } else {
        // Sell: check if this closes a long
        if (buyQueue.length > 0) {
          const entry = buyQueue.shift()!
          const qty = Math.min(entry.qty, fill.qty)
          const pnl = (fill.price - entry.price) * qty
          const pnlPct = ((fill.price - entry.price) / entry.price) * 100

          trades.push({
            broker_trade_id: `tv_${entry.id}_${fill.id}`,
            ticker,
            side: 'long',
            quantity: qty,
            entry_price: entry.price,
            exit_price: fill.price,
            pnl,
            pnl_pct: pnlPct,
            opened_at: entry.timestamp,
            closed_at: fill.timestamp,
            raw_data: { entry_fill: entry, exit_fill: fill },
          })
        } else {
          sellQueue.push(fill)
        }
      }
    }
  }

  return trades
}

// --- Verify credentials ---

export async function verifyCredentials(
  username: string,
  password: string,
  demo = false
): Promise<{ valid: boolean; accessToken?: string; expiresAt?: string; accountId?: number }> {
  try {
    const { accessToken, expiresAt } = await getAccessToken(username, password, { demo })
    const accounts = await getAccounts(accessToken, demo)
    const accountId = accounts?.[0]?.id ?? null
    return { valid: true, accessToken, expiresAt, accountId }
  } catch {
    return { valid: false }
  }
}

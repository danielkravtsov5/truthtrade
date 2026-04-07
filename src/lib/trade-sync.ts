import { createServiceClient } from './supabase-server'
import {
  getTradesForSymbol,
  matchTrades,
  DEFAULT_SYMBOLS,
} from './binance'
import {
  getFills as getTradovateFills,
  matchFillsToTrades,
  renewAccessToken,
} from './tradovate'
import {
  getExecutions as getBybitExecutions,
  matchExecutions as matchBybitExecutions,
} from './bybit'
import {
  getTradesHistory as getKrakenTrades,
  matchTrades as matchKrakenTrades,
} from './kraken'
import {
  getFillsHistory as getOkxFills,
  matchFills as matchOkxFills,
} from './okx'
import {
  getFills as getAlpacaFills,
  matchFills as matchAlpacaFills,
} from './alpaca'
import {
  getTransactions as getOandaTransactions,
  matchTransactions as matchOandaTransactions,
} from './oanda'
import {
  getFills as getCoinbaseFills,
  matchFills as matchCoinbaseFills,
} from './coinbase'

/**
 * Sync trades for all users with a broker connection.
 * Called by the Vercel cron job every minute.
 */
export async function syncAllUsers() {
  const supabase = createServiceClient()

  const { data: connections, error } = await supabase
    .from('broker_connections')
    .select('*')

  if (error) throw error
  if (!connections || connections.length === 0) return { synced: 0 }

  let totalSynced = 0

  for (const conn of connections) {
    try {
      let synced = 0
      switch (conn.broker) {
        case 'binance':
          synced = await syncBinanceTrades(conn)
          break
        case 'tradovate':
          synced = await syncTradovateTrades(conn)
          break
        case 'bybit':
          synced = await syncBybitTrades(conn)
          break
        case 'kraken':
          synced = await syncKrakenTrades(conn)
          break
        case 'okx':
          synced = await syncOkxTrades(conn)
          break
        case 'alpaca':
          synced = await syncAlpacaTrades(conn)
          break
        case 'oanda':
          synced = await syncOandaTrades(conn)
          break
        case 'coinbase':
          synced = await syncCoinbaseTrades(conn)
          break
      }
      totalSynced += synced

      await supabase
        .from('broker_connections')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', conn.id)
    } catch (err) {
      console.error(`Failed to sync user ${conn.user_id} (${conn.broker}):`, err)
    }
  }

  return { synced: totalSynced }
}

// Helper to insert trades and auto-create posts
async function insertTrades(
  userId: string,
  broker: string,
  trades: {
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
  }[]
): Promise<number> {
  const supabase = createServiceClient()
  let count = 0

  for (const trade of trades) {
    const { data: insertedTrade, error: tradeError } = await supabase
      .from('trades')
      .insert({
        user_id: userId,
        broker,
        ...trade,
      })
      .select()
      .single()

    if (tradeError) {
      if (tradeError.code === '23505') continue // duplicate
      throw tradeError
    }

    await supabase.from('posts').insert({
      user_id: userId,
      trade_id: insertedTrade.id,
      analysis: null,
    })

    count++
  }

  return count
}

// --- Binance sync ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncBinanceTrades(conn: any): Promise<number> {
  const startTime = conn.last_synced_at
    ? new Date(conn.last_synced_at).getTime() - 60_000
    : Date.now() - 24 * 60 * 60 * 1000

  let newTradeCount = 0

  for (const symbol of DEFAULT_SYMBOLS) {
    try {
      const rawTrades = await getTradesForSymbol(
        conn.api_key, conn.api_secret, symbol, startTime
      )
      if (rawTrades.length === 0) continue
      const closedTrades = matchTrades(rawTrades, symbol)
      newTradeCount += await insertTrades(conn.user_id, 'binance', closedTrades)
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('-1121')) continue
      console.error(`Error syncing ${symbol} for user ${conn.user_id}:`, err)
    }
  }

  return newTradeCount
}

// --- Tradovate sync ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncTradovateTrades(conn: any): Promise<number> {
  const supabase = createServiceClient()

  let accessToken = conn.access_token
  if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
    try {
      accessToken = await renewAccessToken(accessToken, conn.paper_trading)
      await supabase
        .from('broker_connections')
        .update({ access_token: accessToken })
        .eq('id', conn.id)
    } catch {
      console.error(`Failed to renew Tradovate token for user ${conn.user_id}`)
      return 0
    }
  }

  if (!accessToken) return 0

  try {
    const fills = await getTradovateFills(accessToken, conn.paper_trading)
    if (fills.length === 0) return 0
    const trades = await matchFillsToTrades(accessToken, fills, conn.paper_trading)
    return await insertTrades(conn.user_id, 'tradovate', trades)
  } catch (err) {
    console.error(`Error syncing Tradovate for user ${conn.user_id}:`, err)
    return 0
  }
}

// --- Bybit sync ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncBybitTrades(conn: any): Promise<number> {
  const startTime = conn.last_synced_at
    ? new Date(conn.last_synced_at).getTime() - 60_000
    : undefined

  try {
    const execs = await getBybitExecutions(conn.api_key, conn.api_secret, 'spot', startTime)
    if (execs.length === 0) return 0
    const trades = matchBybitExecutions(execs)
    return await insertTrades(conn.user_id, 'bybit', trades)
  } catch (err) {
    console.error(`Error syncing Bybit for user ${conn.user_id}:`, err)
    return 0
  }
}

// --- Kraken sync ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncKrakenTrades(conn: any): Promise<number> {
  const start = conn.last_synced_at
    ? Math.floor(new Date(conn.last_synced_at).getTime() / 1000) - 60
    : undefined

  try {
    const trades = await getKrakenTrades(conn.api_key, conn.api_secret, start)
    if (trades.length === 0) return 0
    const matched = matchKrakenTrades(trades)
    return await insertTrades(conn.user_id, 'kraken', matched)
  } catch (err) {
    console.error(`Error syncing Kraken for user ${conn.user_id}:`, err)
    return 0
  }
}

// --- OKX sync ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncOkxTrades(conn: any): Promise<number> {
  const startTime = conn.last_synced_at
    ? new Date(conn.last_synced_at).getTime() - 60_000
    : undefined

  try {
    const fills = await getOkxFills(
      conn.api_key, conn.api_secret, conn.api_passphrase,
      'SPOT', startTime
    )
    if (fills.length === 0) return 0
    const trades = matchOkxFills(fills)
    return await insertTrades(conn.user_id, 'okx', trades)
  } catch (err) {
    console.error(`Error syncing OKX for user ${conn.user_id}:`, err)
    return 0
  }
}

// --- Alpaca sync ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncAlpacaTrades(conn: any): Promise<number> {
  const after = conn.last_synced_at
    ? new Date(new Date(conn.last_synced_at).getTime() - 60_000).toISOString()
    : undefined

  try {
    const fills = await getAlpacaFills(
      conn.api_key, conn.api_secret, conn.paper_trading, after
    )
    if (fills.length === 0) return 0
    const trades = matchAlpacaFills(fills)
    return await insertTrades(conn.user_id, 'alpaca', trades)
  } catch (err) {
    console.error(`Error syncing Alpaca for user ${conn.user_id}:`, err)
    return 0
  }
}

// --- OANDA sync ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncOandaTrades(conn: any): Promise<number> {
  if (!conn.access_token || !conn.oanda_account_id) return 0

  const from = conn.last_synced_at
    ? new Date(new Date(conn.last_synced_at).getTime() - 60_000).toISOString()
    : undefined

  try {
    const txs = await getOandaTransactions(
      conn.access_token, conn.oanda_account_id, conn.paper_trading, from
    )
    if (txs.length === 0) return 0
    const trades = matchOandaTransactions(txs)
    return await insertTrades(conn.user_id, 'oanda', trades)
  } catch (err) {
    console.error(`Error syncing OANDA for user ${conn.user_id}:`, err)
    return 0
  }
}

// --- Coinbase sync ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncCoinbaseTrades(conn: any): Promise<number> {
  if (!conn.coinbase_key_name || !conn.coinbase_private_key) return 0

  const startDate = conn.last_synced_at
    ? new Date(new Date(conn.last_synced_at).getTime() - 60_000).toISOString()
    : undefined

  try {
    const fills = await getCoinbaseFills(
      conn.coinbase_key_name, conn.coinbase_private_key, startDate
    )
    if (fills.length === 0) return 0
    const trades = matchCoinbaseFills(fills)
    return await insertTrades(conn.user_id, 'coinbase', trades)
  } catch (err) {
    console.error(`Error syncing Coinbase for user ${conn.user_id}:`, err)
    return 0
  }
}

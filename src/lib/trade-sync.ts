import { createServiceClient } from './supabase-server'
import {
  getTradesForSymbol,
  matchTrades,
  DEFAULT_SYMBOLS,
} from './binance'
import {
  getFills,
  matchFillsToTrades,
  renewAccessToken,
} from './tradovate'

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
      if (conn.broker === 'binance') {
        synced = await syncBinanceTrades(conn)
      } else if (conn.broker === 'tradovate') {
        synced = await syncTradovateTrades(conn)
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

// --- Binance sync ---

async function syncBinanceTrades(conn: {
  id: string
  user_id: string
  api_key: string
  api_secret: string
  last_synced_at: string | null
}): Promise<number> {
  const supabase = createServiceClient()

  const startTime = conn.last_synced_at
    ? new Date(conn.last_synced_at).getTime() - 60_000
    : Date.now() - 24 * 60 * 60 * 1000

  let newTradeCount = 0

  for (const symbol of DEFAULT_SYMBOLS) {
    try {
      const rawTrades = await getTradesForSymbol(
        conn.api_key,
        conn.api_secret,
        symbol,
        startTime
      )

      if (rawTrades.length === 0) continue

      const closedTrades = matchTrades(rawTrades, symbol)

      for (const trade of closedTrades) {
        const { data: insertedTrade, error: tradeError } = await supabase
          .from('trades')
          .insert({
            user_id: conn.user_id,
            broker: 'binance',
            ...trade,
          })
          .select()
          .single()

        if (tradeError) {
          if (tradeError.code === '23505') continue
          throw tradeError
        }

        await supabase.from('posts').insert({
          user_id: conn.user_id,
          trade_id: insertedTrade.id,
          analysis: null,
        })

        newTradeCount++
      }
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

  // Renew token if expired
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
    const fills = await getFills(accessToken, conn.paper_trading)
    if (fills.length === 0) return 0

    const trades = await matchFillsToTrades(accessToken, fills, conn.paper_trading)
    let newTradeCount = 0

    for (const trade of trades) {
      const { data: insertedTrade, error: tradeError } = await supabase
        .from('trades')
        .insert({
          user_id: conn.user_id,
          broker: 'tradovate',
          ...trade,
        })
        .select()
        .single()

      if (tradeError) {
        if (tradeError.code === '23505') continue
        throw tradeError
      }

      await supabase.from('posts').insert({
        user_id: conn.user_id,
        trade_id: insertedTrade.id,
        analysis: null,
      })

      newTradeCount++
    }

    return newTradeCount
  } catch (err) {
    console.error(`Error syncing Tradovate for user ${conn.user_id}:`, err)
    return 0
  }
}

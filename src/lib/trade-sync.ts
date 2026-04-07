import { createServiceClient } from './supabase-server'
import {
  getTradesForSymbol,
  matchTrades,
  DEFAULT_SYMBOLS,
} from './binance'

/**
 * Sync trades for all users with a Binance connection.
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
      const synced = await syncUserTrades(conn)
      totalSynced += synced

      // Update last_synced_at
      await supabase
        .from('broker_connections')
        .update({ last_synced_at: new Date().toISOString() })
        .eq('id', conn.id)
    } catch (err) {
      console.error(`Failed to sync user ${conn.user_id}:`, err)
    }
  }

  return { synced: totalSynced }
}

async function syncUserTrades(conn: {
  id: string
  user_id: string
  api_key: string
  api_secret: string
  last_synced_at: string | null
}): Promise<number> {
  const supabase = createServiceClient()

  // Look back 24h if never synced, otherwise from last sync
  const startTime = conn.last_synced_at
    ? new Date(conn.last_synced_at).getTime() - 60_000 // 1 min overlap
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
        // Insert trade (ignore duplicates)
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
          // Duplicate — skip
          if (tradeError.code === '23505') continue
          throw tradeError
        }

        // Auto-create post for the new trade
        await supabase.from('posts').insert({
          user_id: conn.user_id,
          trade_id: insertedTrade.id,
          analysis: null,
        })

        newTradeCount++
      }
    } catch (err: unknown) {
      // Symbol not traded or rate limited — continue
      if (err instanceof Error && err.message.includes('-1121')) continue
      console.error(`Error syncing ${symbol} for user ${conn.user_id}:`, err)
    }
  }

  return newTradeCount
}

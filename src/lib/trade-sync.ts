import { createServiceClient } from './supabase-server'
import type { NormalizedFill } from '@/types'
import {
  getTradesForSymbol,
  normalizeFills as normalizeBinanceFills,
  DEFAULT_SYMBOLS,
} from './binance'
import {
  getFills as getTradovateFills,
  normalizeFills as normalizeTradovateFills,
  renewAccessToken,
} from './tradovate'
import {
  getExecutions as getBybitExecutions,
  normalizeFills as normalizeBybitFills,
} from './bybit'
import {
  getTradesHistory as getKrakenTrades,
  normalizeFills as normalizeKrakenFills,
} from './kraken'
import {
  getFillsHistory as getOkxFills,
  normalizeFills as normalizeOkxFills,
} from './okx'
import {
  getFills as getAlpacaFills,
  normalizeFills as normalizeAlpacaFills,
} from './alpaca'
import {
  getTransactions as getOandaTransactions,
  normalizeFills as normalizeOandaFills,
} from './oanda'
import {
  getFills as getCoinbaseFills,
  normalizeFills as normalizeCoinbaseFills,
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

/**
 * Process normalized fills through position tracking.
 * For each fill:
 *   - Upsert the open_positions row for that user/broker/ticker
 *   - Accumulate entry or exit cost depending on side vs position side
 *   - When net_quantity reaches 0 → create a trade + post, delete the position
 *
 * Returns the number of closed positions (= posts created).
 */
async function processFills(
  userId: string,
  broker: string,
  fills: NormalizedFill[]
): Promise<number> {
  if (fills.length === 0) return 0

  const supabase = createServiceClient()

  // Sort fills by timestamp ascending
  const sorted = [...fills].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  // Group by ticker for efficiency
  const byTicker = new Map<string, NormalizedFill[]>()
  for (const fill of sorted) {
    const existing = byTicker.get(fill.ticker) ?? []
    existing.push(fill)
    byTicker.set(fill.ticker, existing)
  }

  let closedCount = 0

  for (const [ticker, tickerFills] of byTicker) {
    // Get or create the open position for this user/broker/ticker
    const { data: existing } = await supabase
      .from('open_positions')
      .select('*')
      .eq('user_id', userId)
      .eq('broker', broker)
      .eq('ticker', ticker)
      .single()

    let netQty = existing?.net_quantity ? Number(existing.net_quantity) : 0
    let side: 'long' | 'short' | null = existing?.side ?? null
    let totalEntryCost = existing?.total_entry_cost ? Number(existing.total_entry_cost) : 0
    let totalEntryQty = existing?.total_entry_qty ? Number(existing.total_entry_qty) : 0
    let totalExitProceeds = existing?.total_exit_proceeds ? Number(existing.total_exit_proceeds) : 0
    let totalExitQty = existing?.total_exit_qty ? Number(existing.total_exit_qty) : 0
    let openedAt: string | null = existing?.opened_at ?? null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let accumulatedFills: any[] = existing?.fills ?? []
    const processedFillIds = new Set(accumulatedFills.map((f: NormalizedFill) => f.fill_id))

    for (const fill of tickerFills) {
      // Skip fills we already processed (idempotency)
      if (processedFillIds.has(fill.fill_id)) continue

      accumulatedFills.push(fill)
      processedFillIds.add(fill.fill_id)

      if (netQty === 0) {
        // Opening a new position
        side = fill.side === 'buy' ? 'long' : 'short'
        netQty = fill.quantity
        totalEntryCost = fill.price * fill.quantity
        totalEntryQty = fill.quantity
        totalExitProceeds = 0
        totalExitQty = 0
        openedAt = fill.timestamp
      } else if (
        (side === 'long' && fill.side === 'buy') ||
        (side === 'short' && fill.side === 'sell')
      ) {
        // Adding to position
        netQty += fill.quantity
        totalEntryCost += fill.price * fill.quantity
        totalEntryQty += fill.quantity
      } else {
        // Reducing position
        netQty -= fill.quantity
        totalExitProceeds += fill.price * fill.quantity
        totalExitQty += fill.quantity

        // Round to avoid floating point issues
        netQty = Math.round(netQty * 1e8) / 1e8

        if (netQty <= 0) {
          // Position closed! Create trade + post
          const avgEntry = totalEntryCost / totalEntryQty
          const avgExit = totalExitProceeds / totalExitQty
          const quantity = totalEntryQty
          const pnl = side === 'long'
            ? (avgExit - avgEntry) * quantity
            : (avgEntry - avgExit) * quantity
          const pnlPct = (pnl / (avgEntry * quantity)) * 100

          const brokerTradeId = `pos_${broker}_${userId}_${ticker}_${openedAt}`

          const { data: insertedTrade, error: tradeError } = await supabase
            .from('trades')
            .insert({
              user_id: userId,
              broker,
              broker_trade_id: brokerTradeId,
              ticker,
              side: side!,
              quantity,
              entry_price: Math.round(avgEntry * 1e8) / 1e8,
              exit_price: Math.round(avgExit * 1e8) / 1e8,
              pnl: Math.round(pnl * 100) / 100,
              pnl_pct: Math.round(pnlPct * 100) / 100,
              opened_at: openedAt,
              closed_at: fill.timestamp,
              is_position_close: true,
              raw_data: { fills: accumulatedFills },
            })
            .select()
            .single()

          if (tradeError) {
            if (tradeError.code === '23505') {
              // Duplicate — position already recorded
            } else {
              throw tradeError
            }
          } else {
            // Create the post for this closed position
            await supabase.from('posts').insert({
              user_id: userId,
              trade_id: insertedTrade.id,
              analysis: null,
            })
            closedCount++
          }

          // Delete the open position row
          if (existing?.id) {
            await supabase.from('open_positions').delete().eq('id', existing.id)
          } else {
            await supabase
              .from('open_positions')
              .delete()
              .eq('user_id', userId)
              .eq('broker', broker)
              .eq('ticker', ticker)
          }

          // If there's overflow (netQty < 0), the fill opens a new position in the opposite direction
          if (netQty < 0) {
            const overflowQty = Math.abs(netQty)
            side = side === 'long' ? 'short' : 'long'
            netQty = overflowQty
            totalEntryCost = fill.price * overflowQty
            totalEntryQty = overflowQty
            totalExitProceeds = 0
            totalExitQty = 0
            openedAt = fill.timestamp
            accumulatedFills = [fill]
          } else {
            // Exactly zero — reset
            netQty = 0
            side = null
            totalEntryCost = 0
            totalEntryQty = 0
            totalExitProceeds = 0
            totalExitQty = 0
            openedAt = null
            accumulatedFills = []
            continue // Skip upsert — we just deleted the row
          }
        }
      }
    }

    // Upsert the open position if there's still a position open
    if (netQty > 0 && side) {
      await supabase
        .from('open_positions')
        .upsert(
          {
            ...(existing?.id ? { id: existing.id } : {}),
            user_id: userId,
            broker,
            ticker,
            side,
            net_quantity: netQty,
            total_entry_cost: totalEntryCost,
            total_entry_qty: totalEntryQty,
            total_exit_proceeds: totalExitProceeds,
            total_exit_qty: totalExitQty,
            opened_at: openedAt,
            fills: accumulatedFills,
          },
          { onConflict: 'user_id,broker,ticker' }
        )
    }
  }

  return closedCount
}

// --- Binance sync ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncBinanceTrades(conn: any): Promise<number> {
  const startTime = conn.last_synced_at
    ? new Date(conn.last_synced_at).getTime() - 60_000
    : Date.now() - 24 * 60 * 60 * 1000

  let closedCount = 0

  for (const symbol of DEFAULT_SYMBOLS) {
    try {
      const rawTrades = await getTradesForSymbol(
        conn.api_key, conn.api_secret, symbol, startTime
      )
      if (rawTrades.length === 0) continue
      const fills = normalizeBinanceFills(rawTrades, symbol)
      closedCount += await processFills(conn.user_id, 'binance', fills)
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('-1121')) continue
      console.error(`Error syncing ${symbol} for user ${conn.user_id}:`, err)
    }
  }

  return closedCount
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
    const rawFills = await getTradovateFills(accessToken, conn.paper_trading)
    if (rawFills.length === 0) return 0
    const fills = await normalizeTradovateFills(accessToken, rawFills, conn.paper_trading)
    return await processFills(conn.user_id, 'tradovate', fills)
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
    const fills = normalizeBybitFills(execs)
    return await processFills(conn.user_id, 'bybit', fills)
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
    const fills = normalizeKrakenFills(trades)
    return await processFills(conn.user_id, 'kraken', fills)
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
    const rawFills = await getOkxFills(
      conn.api_key, conn.api_secret, conn.api_passphrase,
      'SPOT', startTime
    )
    if (rawFills.length === 0) return 0
    const fills = normalizeOkxFills(rawFills)
    return await processFills(conn.user_id, 'okx', fills)
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
    const rawFills = await getAlpacaFills(
      conn.api_key, conn.api_secret, conn.paper_trading, after
    )
    if (rawFills.length === 0) return 0
    const fills = normalizeAlpacaFills(rawFills)
    return await processFills(conn.user_id, 'alpaca', fills)
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
    const fills = normalizeOandaFills(txs)
    return await processFills(conn.user_id, 'oanda', fills)
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
    const rawFills = await getCoinbaseFills(
      conn.coinbase_key_name, conn.coinbase_private_key, startDate
    )
    if (rawFills.length === 0) return 0
    const fills = normalizeCoinbaseFills(rawFills)
    return await processFills(conn.user_id, 'coinbase', fills)
  } catch (err) {
    console.error(`Error syncing Coinbase for user ${conn.user_id}:`, err)
    return 0
  }
}

import { NextRequest, NextResponse } from 'next/server'

interface Candle {
  time: number // unix seconds
  open: number
  high: number
  low: number
  close: number
}

// Crypto tickers commonly traded on Binance
const CRYPTO_SUFFIXES = ['USDT', 'USD', 'BUSD', 'USDC', 'BTC', 'ETH']

function isCrypto(ticker: string): boolean {
  const upper = ticker.toUpperCase()
  return CRYPTO_SUFFIXES.some(s => upper.endsWith(s)) ||
    ['BTC', 'ETH', 'SOL', 'DOGE', 'XRP', 'ADA', 'AVAX', 'MATIC', 'DOT', 'LINK'].some(c => upper.startsWith(c))
}

// Pick interval based on trade duration
function pickInterval(durationMs: number): { binance: string; yahoo: string; seconds: number } {
  const hours = durationMs / (1000 * 60 * 60)
  if (hours < 1) return { binance: '1m', yahoo: '1m', seconds: 60 }
  if (hours < 6) return { binance: '5m', yahoo: '5m', seconds: 300 }
  if (hours < 24) return { binance: '15m', yahoo: '15m', seconds: 900 }
  if (hours < 72) return { binance: '1h', yahoo: '1h', seconds: 3600 }
  return { binance: '4h', yahoo: '1d', seconds: 86400 }
}

async function fetchBinanceCandles(ticker: string, startMs: number, endMs: number, interval: string): Promise<Candle[]> {
  const symbol = ticker.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${startMs}&endTime=${endMs}&limit=500`
  const res = await fetch(url)
  if (!res.ok) return []
  const data = await res.json()
  return data.map((k: (string | number)[]) => ({
    time: Math.floor(Number(k[0]) / 1000),
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
  }))
}

async function fetchYahooCandles(ticker: string, startSec: number, endSec: number, interval: string): Promise<Candle[]> {
  // Yahoo Finance expects symbols like AAPL, EURUSD=X, etc.
  let symbol = ticker.toUpperCase()
  // Common forex pairs
  if (/^(EUR|GBP|AUD|NZD|USD|CAD|CHF|JPY){2}$/.test(symbol) || symbol.includes('_')) {
    symbol = symbol.replace('_', '') + '=X'
  }
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?period1=${startSec}&period2=${endSec}&interval=${interval}`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
  if (!res.ok) return []
  const data = await res.json()
  const result = data?.chart?.result?.[0]
  if (!result) return []
  const timestamps = result.timestamp as number[]
  const quotes = result.indicators?.quote?.[0]
  if (!timestamps || !quotes) return []
  return timestamps.map((t: number, i: number) => ({
    time: t,
    open: quotes.open[i] ?? 0,
    high: quotes.high[i] ?? 0,
    low: quotes.low[i] ?? 0,
    close: quotes.close[i] ?? 0,
  })).filter((c: Candle) => c.open > 0)
}

export async function GET(req: NextRequest) {
  const searchParams = await req.nextUrl.searchParams
  const ticker = searchParams.get('ticker')
  const openedAt = searchParams.get('opened_at')
  const closedAt = searchParams.get('closed_at')

  if (!ticker || !openedAt || !closedAt) {
    return NextResponse.json({ error: 'Missing ticker, opened_at, or closed_at' }, { status: 400 })
  }

  const openMs = new Date(openedAt).getTime()
  const closeMs = new Date(closedAt).getTime()
  const duration = closeMs - openMs

  const overrideInterval = searchParams.get('interval')
  const interval = overrideInterval
    ? { binance: overrideInterval, yahoo: overrideInterval, seconds: 0 }
    : pickInterval(duration)

  // When interval is overridden, ensure enough candles by widening the window
  // e.g. 50 candles worth of the selected interval on each side
  const intervalMs: Record<string, number> = {
    '1m': 60000, '5m': 300000, '15m': 900000,
    '1h': 3600000, '4h': 14400000, '1d': 86400000,
  }
  const minPadding = overrideInterval
    ? (intervalMs[overrideInterval] ?? 60000) * 50
    : Math.max(duration * 0.1, 60000)
  const padding = Math.max(duration * 0.1, minPadding)
  const startMs = openMs - padding
  const endMs = closeMs + padding

  let candles: Candle[]

  if (isCrypto(ticker)) {
    candles = await fetchBinanceCandles(ticker, startMs, endMs, interval.binance)
  } else {
    candles = await fetchYahooCandles(ticker, Math.floor(startMs / 1000), Math.floor(endMs / 1000), interval.yahoo)
  }

  return NextResponse.json({ candles })
}

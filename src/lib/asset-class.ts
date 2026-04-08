// Shared symbol lists and classification utility

export const CRYPTO_SYMBOLS = [
  'BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'AVAX', 'LINK', 'MATIC',
  'DOT', 'SHIB', 'TRX', 'UNI', 'ATOM', 'LTC', 'BCH', 'NEAR', 'APT', 'FIL',
  'ARB', 'OP', 'IMX', 'INJ', 'RNDR', 'FET', 'RUNE', 'STX', 'SUI', 'SEI',
  'TIA', 'JUP', 'WIF', 'PEPE', 'FLOKI', 'BONK', 'ORDI', 'WLD', 'BLUR', 'MEME',
  'AAVE', 'MKR', 'CRV', 'LDO', 'SNX', 'COMP', 'SUSHI', 'YFI', 'DYDX', 'GMX',
  'SAND', 'MANA', 'AXS', 'GALA', 'ENJ', 'ILV', 'FLOW', 'THETA', 'CHZ', 'APE',
  'FTM', 'ALGO', 'VET', 'HBAR', 'EOS', 'XLM', 'XMR', 'ZEC', 'DASH', 'IOTA',
  'ETC', 'NEO', 'QTUM', 'ZIL', 'ICX', 'ONT', 'WAVES', 'KSM', 'EGLD', 'KAVA',
  'CKB', 'CFX', 'ROSE', 'MINA', 'ONE', 'ZEN', 'BAT', 'GRT', 'ENS', 'SSV',
  'PENDLE', 'PYTH', 'JTO', 'BOME', 'ENA', 'TON', 'NOT', 'PEOPLE', 'TURBO', 'MEW',
]

export const STOCK_SYMBOLS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA', 'BRK.B', 'JPM', 'V',
  'MA', 'UNH', 'HD', 'PG', 'JNJ', 'XOM', 'BAC', 'ABBV', 'KO', 'PFE',
  'MRK', 'AVGO', 'PEP', 'TMO', 'COST', 'CSCO', 'ACN', 'ABT', 'MCD', 'NKE',
  'AMD', 'INTC', 'QCOM', 'CRM', 'ORCL', 'ADBE', 'NFLX', 'PYPL', 'SQ', 'SHOP',
  'COIN', 'MSTR', 'PLTR', 'SOFI', 'RIVN', 'LCID', 'NIO', 'HOOD', 'SNAP', 'RBLX',
  'SPY', 'QQQ', 'IWM', 'DIA', 'ES', 'NQ', 'YM', 'RTY', 'CL', 'GC',
]

export const FOREX_SYMBOLS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'NZD/USD', 'USD/CAD',
  'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'EUR/AUD', 'EUR/CHF', 'GBP/CHF',
]

export const FUTURES_SYMBOLS = ['ES', 'NQ', 'YM', 'RTY', 'CL', 'GC']

export type AssetClass = 'crypto' | 'stocks' | 'forex' | 'futures'

export interface SymbolEntry {
  symbol: string
  category: string
}

export const ALL_SYMBOLS: SymbolEntry[] = [
  ...CRYPTO_SYMBOLS.map(s => ({ symbol: s, category: 'Crypto' })),
  ...STOCK_SYMBOLS.map(s => ({ symbol: s, category: s.includes('/') ? 'Forex' : 'Stocks' })),
  ...FOREX_SYMBOLS.map(s => ({ symbol: s, category: 'Forex' })),
]

const cryptoSet = new Set(CRYPTO_SYMBOLS)
const futuresSet = new Set(FUTURES_SYMBOLS)

export function classifyTicker(ticker: string): AssetClass {
  // Normalize: strip common suffixes like USDT, USD, BUSD
  const upper = ticker.toUpperCase()

  // Forex pairs contain "/"
  if (upper.includes('/')) return 'forex'

  // OANDA-style forex (e.g. EUR_USD)
  if (upper.includes('_') && upper.length <= 7) return 'forex'

  // Futures symbols
  if (futuresSet.has(upper)) return 'futures'

  // Crypto: known symbol or ends in USDT/BUSD/USD on exchanges
  const base = upper.replace(/(USDT|BUSD|USD|PERP)$/, '')
  if (cryptoSet.has(base) || cryptoSet.has(upper)) return 'crypto'

  // Default to stocks
  return 'stocks'
}

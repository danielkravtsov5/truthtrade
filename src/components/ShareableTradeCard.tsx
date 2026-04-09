'use client'

import { Trade } from '@/types'
import { useRef, useState, useEffect, useCallback } from 'react'
import { toPng } from 'html-to-image'
import { Download, X } from 'lucide-react'

interface ShareableTradeCardProps {
  trade: Trade
  username: string
  onClose: () => void
}

interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

function MiniChart({ trade, candles }: { trade: Trade; candles: Candle[] }) {
  if (candles.length < 2) return null

  const isProfit = trade.pnl >= 0
  const prices = candles.map(c => c.close)
  const minPrice = Math.min(...prices, trade.entry_price, trade.exit_price)
  const maxPrice = Math.max(...prices, trade.entry_price, trade.exit_price)
  const padding = (maxPrice - minPrice) * 0.1
  const yMin = minPrice - padding
  const yMax = maxPrice + padding

  const W = 560
  const H = 200
  const PX = 20 // padding x
  const PY = 16 // padding y

  const toX = (i: number) => PX + (i / (candles.length - 1)) * (W - PX * 2)
  const toY = (p: number) => PY + (1 - (p - yMin) / (yMax - yMin)) * (H - PY * 2)

  // Price line path
  const linePath = candles
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${toX(i).toFixed(1)} ${toY(c.close).toFixed(1)}`)
    .join(' ')

  // Area fill path
  const areaPath = `${linePath} L ${toX(candles.length - 1).toFixed(1)} ${H - PY} L ${toX(0).toFixed(1)} ${H - PY} Z`

  const entryY = toY(trade.entry_price)
  const exitY = toY(trade.exit_price)

  // Find candle index closest to entry/exit
  const entryTime = new Date(trade.opened_at).getTime() / 1000
  const exitTime = new Date(trade.closed_at).getTime() / 1000
  let entryIdx = 0
  let exitIdx = candles.length - 1
  let minEntryDiff = Infinity
  let minExitDiff = Infinity
  candles.forEach((c, i) => {
    const eDiff = Math.abs(c.time - entryTime)
    const xDiff = Math.abs(c.time - exitTime)
    if (eDiff < minEntryDiff) { minEntryDiff = eDiff; entryIdx = i }
    if (xDiff < minExitDiff) { minExitDiff = xDiff; exitIdx = i }
  })

  const entryX = toX(entryIdx)
  const exitX = toX(exitIdx)

  const lineColor = isProfit ? '#34d399' : '#f87171'
  const lineColorFaded = isProfit ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)'

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <path d={areaPath} fill="url(#areaGrad)" />

      {/* Entry dashed line */}
      <line
        x1={PX} y1={entryY} x2={W - PX} y2={entryY}
        stroke="#6b7280" strokeWidth="1" strokeDasharray="6 4" opacity="0.5"
      />
      {/* Exit dashed line */}
      <line
        x1={PX} y1={exitY} x2={W - PX} y2={exitY}
        stroke={lineColor} strokeWidth="1" strokeDasharray="6 4" opacity="0.6"
      />

      {/* Price line */}
      <path d={linePath} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Entry dot */}
      <circle cx={entryX} cy={entryY} r="5" fill="#1f2937" stroke="#6b7280" strokeWidth="2" />
      {/* Exit dot */}
      <circle cx={exitX} cy={exitY} r="5" fill={lineColor} stroke={isProfit ? '#059669' : '#dc2626'} strokeWidth="2" />

      {/* Entry label */}
      <rect x={entryX - 50} y={entryY + (trade.side === 'long' ? 10 : -30)} width="100" height="20" rx="4" fill="rgba(31,41,55,0.9)" />
      <text x={entryX} y={entryY + (trade.side === 'long' ? 24 : -16)} textAnchor="middle" fill="#9ca3af" fontSize="11" fontFamily="monospace" fontWeight="600">
        Entry ${trade.entry_price.toFixed(2)}
      </text>

      {/* Exit label */}
      <rect x={exitX - 45} y={exitY + (trade.side === 'long' ? -30 : 10)} width="90" height="20" rx="4" fill={isProfit ? 'rgba(5,150,105,0.3)' : 'rgba(220,38,38,0.3)'} />
      <text x={exitX} y={exitY + (trade.side === 'long' ? -16 : 24)} textAnchor="middle" fill={lineColor} fontSize="11" fontFamily="monospace" fontWeight="600">
        Exit ${trade.exit_price.toFixed(2)}
      </text>
    </svg>
  )
}

export default function ShareableTradeCard({ trade, username, onClose }: ShareableTradeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [candles, setCandles] = useState<Candle[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  const isProfit = trade.pnl >= 0

  useEffect(() => {
    async function fetchCandles() {
      try {
        const params = new URLSearchParams({
          ticker: trade.ticker,
          opened_at: trade.opened_at,
          closed_at: trade.closed_at,
        })
        const res = await fetch(`/api/candles?${params}`)
        if (res.ok) {
          const { candles: data } = await res.json()
          setCandles(data || [])
        }
      } catch {
        // Chart will just not render
      } finally {
        setLoading(false)
      }
    }
    fetchCandles()
  }, [trade])

  const handleDownload = useCallback(async () => {
    if (!cardRef.current) return
    setExporting(true)
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 3,
        backgroundColor: '#0f172a',
      })
      const link = document.createElement('a')
      link.download = `${trade.ticker}_${isProfit ? 'win' : 'loss'}_truthtrade.png`
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Failed to export trade card:', err)
    } finally {
      setExporting(false)
    }
  }, [trade.ticker, isProfit])

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative max-w-lg w-full" onClick={e => e.stopPropagation()}>
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={handleDownload}
            disabled={exporting || loading}
            className="flex items-center gap-2 px-4 py-2 bg-white text-gray-900 rounded-lg font-semibold text-sm hover:bg-gray-100 transition-colors disabled:opacity-50"
          >
            <Download size={16} />
            {exporting ? 'Exporting...' : 'Download PNG'}
          </button>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* The Card */}
        <div
          ref={cardRef}
          className="rounded-2xl overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
            padding: '28px',
          }}
        >
          {/* Top: Ticker + Side badge */}
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="text-white font-bold text-3xl tracking-tight">{trade.ticker}</span>
                <span
                  className="px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider"
                  style={{
                    background: trade.side === 'long' ? 'rgba(59,130,246,0.2)' : 'rgba(249,115,22,0.2)',
                    color: trade.side === 'long' ? '#60a5fa' : '#fb923c',
                  }}
                >
                  {trade.side}
                </span>
              </div>
              <div className="text-slate-500 text-sm">
                @{username} &middot; {formatDate(trade.closed_at)}
              </div>
            </div>

            {/* PnL */}
            <div className="text-right">
              <div
                className="font-black text-3xl tracking-tight"
                style={{ color: isProfit ? '#34d399' : '#f87171' }}
              >
                {isProfit ? '+' : ''}{trade.pnl_pct.toFixed(2)}%
              </div>
              <div
                className="text-lg font-semibold"
                style={{ color: isProfit ? '#34d399' : '#f87171', opacity: 0.8 }}
              >
                {isProfit ? '+' : ''}${trade.pnl.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="rounded-xl overflow-hidden mb-5" style={{ background: 'rgba(15,23,42,0.6)' }}>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-5 h-5 border-2 border-slate-600 border-t-indigo-400 rounded-full animate-spin" />
              </div>
            ) : candles.length > 1 ? (
              <MiniChart trade={trade} candles={candles} />
            ) : (
              <div className="py-12 text-center text-slate-600 text-sm">No chart data</div>
            )}
          </div>

          {/* Trade details row */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            <div className="text-center">
              <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Entry</div>
              <div className="text-white text-sm font-semibold font-mono">${trade.entry_price.toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Exit</div>
              <div className="text-sm font-semibold font-mono" style={{ color: isProfit ? '#34d399' : '#f87171' }}>
                ${trade.exit_price.toFixed(2)}
              </div>
            </div>
            <div className="text-center">
              <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Quantity</div>
              <div className="text-white text-sm font-semibold font-mono">{trade.quantity}</div>
            </div>
            <div className="text-center">
              <div className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Duration</div>
              <div className="text-white text-sm font-semibold font-mono">
                {(() => {
                  const ms = new Date(trade.closed_at).getTime() - new Date(trade.opened_at).getTime()
                  const mins = Math.floor(ms / 60000)
                  if (mins < 60) return `${mins}m`
                  const hrs = Math.floor(mins / 60)
                  if (hrs < 24) return `${hrs}h ${mins % 60}m`
                  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`
                })()}
              </div>
            </div>
          </div>

          {/* Footer: Verified stamp + branding */}
          <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid rgba(148,163,184,0.1)' }}>
            {/* Verified API stamp */}
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
              style={{
                border: '1.5px solid rgba(52,211,153,0.4)',
                background: 'rgba(52,211,153,0.08)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M8 0L9.79 1.42L12.04 1.04L12.84 3.16L14.96 3.96L14.58 6.21L16 8L14.58 9.79L14.96 12.04L12.84 12.84L12.04 14.96L9.79 14.58L8 16L6.21 14.58L3.96 14.96L3.16 12.84L1.04 12.04L1.42 9.79L0 8L1.42 6.21L1.04 3.96L3.16 3.16L3.96 1.04L6.21 1.42L8 0Z"
                  fill="rgba(52,211,153,0.2)"
                  stroke="#34d399"
                  strokeWidth="0.5"
                />
                <path d="M5.5 8L7 9.5L10.5 6" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Verified API</span>
            </div>

            {/* Branding */}
            <div className="text-slate-500 text-xs font-medium tracking-wide">
              truthtrade.io
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

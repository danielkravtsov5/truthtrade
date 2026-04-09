'use client'

import { useEffect, useRef, useState } from 'react'
import { Trade, NormalizedFill } from '@/types'
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  ColorType,
  LineStyle,
} from 'lightweight-charts'
import type { IChartApi, CandlestickData, LineData, Time } from 'lightweight-charts'

interface TradeChartProps {
  trade: Trade
}

interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

const TIMEFRAMES = [
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '1h', value: '1h' },
  { label: '4h', value: '4h' },
  { label: '1d', value: '1d' },
]

interface ExitFill {
  price: number
  timestamp: string
}

function getExitFills(trade: Trade): ExitFill[] {
  const fills = (trade.raw_data?.fills as NormalizedFill[] | undefined)
  if (!fills || fills.length === 0) return [{ price: trade.exit_price, timestamp: trade.closed_at }]
  const exitSide = trade.side === 'long' ? 'sell' : 'buy'
  const exitFills = fills.filter(f => f.side === exitSide)
  if (exitFills.length === 0) return [{ price: trade.exit_price, timestamp: trade.closed_at }]
  return exitFills.map(f => ({ price: f.price, timestamp: f.timestamp }))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function addPriceLines(series: any, trade: Trade) {
  const isProfit = trade.pnl >= 0
  const exitFills = getExitFills(trade)

  series.createPriceLine({
    price: trade.entry_price,
    color: '#3b82f6',
    lineWidth: 1,
    lineStyle: LineStyle.Dashed,
    axisLabelVisible: false,
    title: '',
  })

  const exitColor = isProfit ? '#10b981' : '#ef4444'
  const uniqueExitPrices = [...new Set(exitFills.map(f => f.price))]
  uniqueExitPrices.forEach((price) => {
    series.createPriceLine({
      price,
      color: exitColor,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
      title: '',
    })
  })
}

interface ArrowOverlay {
  x: number
  y: number
  color: string
  label: string
  direction: 'up' | 'down'
}

export default function TradeChart({ trade }: TradeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [interval, setInterval] = useState<string | null>(null)
  const [arrows, setArrows] = useState<ArrowOverlay[]>([])

  useEffect(() => {
    if (!containerRef.current) return

    setLoading(true)
    setError(false)
    setArrows([])

    let cancelled = false

    async function loadChart() {
      const params = new URLSearchParams({
        ticker: trade.ticker,
        opened_at: trade.opened_at,
        closed_at: trade.closed_at,
      })
      if (interval) params.set('interval', interval)

      try {
        const res = await fetch(`/api/candles?${params}`)
        if (!res.ok || cancelled) { setError(true); setLoading(false); return }
        const { candles } = await res.json() as { candles: Candle[] }

        if (cancelled || !containerRef.current) return
        if (!candles || candles.length === 0) { setError(true); setLoading(false); return }

        const chart = createChart(containerRef.current, {
          autoSize: true,
          height: 220,
          layout: {
            background: { type: ColorType.Solid, color: '#ffffff' },
            textColor: '#9ca3af',
            fontSize: 11,
          },
          grid: {
            vertLines: { color: '#f3f4f6' },
            horzLines: { color: '#f3f4f6' },
          },
          timeScale: {
            timeVisible: true,
            borderColor: '#e5e7eb',
          },
          rightPriceScale: {
            borderColor: '#e5e7eb',
          },
          crosshair: {
            horzLine: { color: '#d1d5db', style: 2 },
            vertLine: { color: '#d1d5db', style: 2 },
          },
        })

        chartRef.current = chart

        const entryTime = findClosestTime(candles, new Date(trade.opened_at).getTime() / 1000)
        const exitFills = getExitFills(trade)

        // Use candlestick if we have OHLC data, otherwise line
        const hasOhlc = candles.some(c => c.high !== c.low)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let activeSeries: any

        if (hasOhlc) {
          const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#10b981',
            downColor: '#ef4444',
            borderUpColor: '#10b981',
            borderDownColor: '#ef4444',
            wickUpColor: '#10b981',
            wickDownColor: '#ef4444',
          })

          const candleData: CandlestickData[] = candles.map(c => ({
            time: c.time as Time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))

          candleSeries.setData(candleData)
          addPriceLines(candleSeries, trade)
          activeSeries = candleSeries
        } else {
          const lineSeries = chart.addSeries(LineSeries, {
            color: '#6366f1',
            lineWidth: 2,
          })

          const lineData: LineData[] = candles.map(c => ({
            time: c.time as Time,
            value: c.close,
          }))

          lineSeries.setData(lineData)
          addPriceLines(lineSeries, trade)
          activeSeries = lineSeries
        }

        chart.timeScale().fitContent()

        // Compute overlay arrow positions using pixel coordinates
        const isProfit = trade.pnl >= 0
        const exitColor = isProfit ? '#10b981' : '#ef4444'

        const computeArrows = () => {
          if (!activeSeries || cancelled) return
          const newArrows: ArrowOverlay[] = []

          // Entry arrow
          const entryX = chart.timeScale().timeToCoordinate(entryTime as Time)
          const entryY = activeSeries.priceToCoordinate(trade.entry_price)
          if (entryX !== null && entryY !== null) {
            newArrows.push({
              x: entryX,
              y: entryY,
              color: '#3b82f6',
              label: `${trade.side === 'short' ? '-' : ''}${trade.quantity}`,
              direction: trade.side === 'long' ? 'up' : 'down',
            })
          }

          // Exit arrows — one per fill, at the fill's candle
          exitFills.forEach((fill, i) => {
            const fillTime = findClosestTime(candles, new Date(fill.timestamp).getTime() / 1000)
            const x = chart.timeScale().timeToCoordinate(fillTime as Time)
            const y = activeSeries.priceToCoordinate(fill.price)
            if (x !== null && y !== null) {
              newArrows.push({
                x,
                y,
                color: exitColor,
                label: exitFills.length > 1 ? `TP${i + 1}` : 'TP',
                direction: trade.side === 'long' ? 'down' : 'up',
              })
            }
          })

          setArrows(newArrows)
        }

        requestAnimationFrame(() => {
          computeArrows()
          chart.timeScale().subscribeVisibleLogicalRangeChange(computeArrows)
        })

        setLoading(false)

        return () => {
          chart.remove()
          chartRef.current = null
        }
      } catch (err) {
        console.error('[TradeChart] Error loading chart:', err)
        if (!cancelled) { setError(true); setLoading(false) }
      }
    }

    const cleanup = loadChart()

    return () => {
      cancelled = true
      cleanup?.then(fn => fn?.())
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [trade, interval])

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-100 bg-white">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      )}
      <div className="flex items-center gap-1 px-3 pt-2">
        {TIMEFRAMES.map(tf => (
          <button
            key={tf.value}
            onClick={() => setInterval(tf.value === interval ? null : tf.value)}
            className={`px-2 py-0.5 text-xs rounded font-medium transition-colors ${
              tf.value === interval
                ? 'bg-indigo-500 text-white'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tf.label}
          </button>
        ))}
      </div>
      {error && !loading ? (
        <div className="flex items-center justify-center text-gray-400 text-xs py-8">
          No chart data for this timeframe
        </div>
      ) : (
        <div className="relative">
          <div ref={containerRef} className="w-full" style={{ minHeight: 220 }} />
          {/* Arrow overlays at exact entry/exit positions on chart */}
          {arrows.map((arrow, i) => (
            <div
              key={i}
              className="absolute pointer-events-none flex flex-col items-center"
              style={{
                left: arrow.x - 12,
                top: arrow.direction === 'down' ? arrow.y : arrow.y - 28,
                zIndex: 5,
              }}
            >
              {/* Label above/below arrow */}
              {arrow.direction === 'up' && (
                <span
                  className="text-[9px] font-bold leading-none mb-0.5"
                  style={{ color: arrow.color }}
                >
                  {arrow.label}
                </span>
              )}
              {/* Arrow SVG */}
              <svg width="14" height="10" viewBox="0 0 14 10">
                {arrow.direction === 'down' ? (
                  <polygon points="7,10 0,0 14,0" fill={arrow.color} />
                ) : (
                  <polygon points="7,0 0,10 14,10" fill={arrow.color} />
                )}
              </svg>
              {arrow.direction === 'down' && (
                <span
                  className="text-[9px] font-bold leading-none mt-0.5"
                  style={{ color: arrow.color }}
                >
                  {arrow.label}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function findClosestTime(candles: Candle[], targetSec: number): number {
  let closest = candles[0].time
  let minDiff = Math.abs(candles[0].time - targetSec)
  for (const c of candles) {
    const diff = Math.abs(c.time - targetSec)
    if (diff < minDiff) {
      minDiff = diff
      closest = c.time
    }
  }
  return closest
}

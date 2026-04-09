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

/** Candle bar arrow — sits above/below a candle */
interface BarArrow {
  x: number
  y: number
  color: string
  label: string
  direction: 'up' | 'down'
}

/** Price level arrow — sits on the right edge pointing left */
interface PriceArrow {
  y: number
  color: string
  label: string
  price: number
}

export default function TradeChart({ trade }: TradeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [interval, setInterval] = useState<string | null>(null)
  const [barArrows, setBarArrows] = useState<BarArrow[]>([])
  const [priceArrows, setPriceArrows] = useState<PriceArrow[]>([])

  useEffect(() => {
    if (!containerRef.current) return

    setLoading(true)
    setError(false)
    setBarArrows([])
    setPriceArrows([])

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

        const entryCandle = findClosestCandle(candles, new Date(trade.opened_at).getTime() / 1000)
        const exitFills = getExitFills(trade)
        const lastExitFill = exitFills[exitFills.length - 1]
        const exitCandle = findClosestCandle(candles, new Date(lastExitFill.timestamp).getTime() / 1000)

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
            lastValueVisible: false,
            priceLineVisible: false,
          })

          const candleData: CandlestickData[] = candles.map(c => ({
            time: c.time as Time,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))

          candleSeries.setData(candleData)
          activeSeries = candleSeries
        } else {
          const lineSeries = chart.addSeries(LineSeries, {
            color: '#6366f1',
            lineWidth: 2,
            lastValueVisible: false,
            priceLineVisible: false,
          })

          const lineData: LineData[] = candles.map(c => ({
            time: c.time as Time,
            value: c.close,
          }))

          lineSeries.setData(lineData)
          activeSeries = lineSeries
        }

        // Dashed price level lines (no axis labels — price arrows handle that)
        const isProfit = trade.pnl >= 0
        const entryColor = '#9ca3af'  // neutral gray
        const exitColor = isProfit ? '#10b981' : '#ef4444'  // green TP / red SL

        activeSeries.createPriceLine({
          price: trade.entry_price,
          color: entryColor,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: false,
          title: '',
        })

        const uniqueExitPrices = [...new Set(exitFills.map(f => f.price))]
        uniqueExitPrices.forEach((price) => {
          activeSeries.createPriceLine({
            price,
            color: exitColor,
            lineWidth: 1,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: false,
            title: '',
          })
        })

        chart.timeScale().fitContent()

        const computeOverlays = () => {
          if (!activeSeries || cancelled) return

          const newBarArrows: BarArrow[] = []
          const newPriceArrows: PriceArrow[] = []

          // --- Arrow 1: Entry bar arrow — tip at exact entry_price ---
          const entryBarX = chart.timeScale().timeToCoordinate(entryCandle.time as Time)
          const entryBarY = activeSeries.priceToCoordinate(trade.entry_price)
          if (entryBarX !== null && entryBarY !== null) {
            // For short: arrow above pointing DOWN to entry price
            // For long: arrow below pointing UP to entry price
            newBarArrows.push({
              x: entryBarX,
              y: entryBarY,
              color: entryColor,
              label: `${trade.side === 'short' ? '-' : ''}${trade.quantity}\n${trade.side === 'long' ? 'Long' : 'Short'}`,
              direction: trade.side === 'long' ? 'up' : 'down',
            })
          }

          // --- Arrow 2: Exit bar arrow — tip at exact exit_price ---
          const exitBarX = chart.timeScale().timeToCoordinate(exitCandle.time as Time)
          const exitBarY = activeSeries.priceToCoordinate(trade.exit_price)
          if (exitBarX !== null && exitBarY !== null) {
            // For short: arrow below pointing UP to exit price
            // For long: arrow above pointing DOWN to exit price
            const exitLabel = isProfit ? 'TP' : 'SL'
            const exitArrowColor = exitColor
            newBarArrows.push({
              x: exitBarX,
              y: exitBarY,
              color: exitArrowColor,
              label: `${exitLabel}\n${isProfit ? '+' : ''}${trade.quantity}`,
              direction: trade.side === 'long' ? 'down' : 'up',
            })
          }

          // --- Arrow 3: Entry price level (right side) ---
          const entryPriceY = activeSeries.priceToCoordinate(trade.entry_price)
          if (entryPriceY !== null) {
            newPriceArrows.push({
              y: entryPriceY,
              color: entryColor,
              label: `$${trade.entry_price.toFixed(2)}`,
              price: trade.entry_price,
            })
          }

          // --- Arrow 4: Exit price level (right side) ---
          const exitPriceY = activeSeries.priceToCoordinate(trade.exit_price)
          const exitPriceColor = exitColor
          if (exitPriceY !== null) {
            newPriceArrows.push({
              y: exitPriceY,
              color: exitPriceColor,
              label: `$${trade.exit_price.toFixed(2)}`,
              price: trade.exit_price,
            })
          }

          setBarArrows(newBarArrows)
          setPriceArrows(newPriceArrows)
        }

        requestAnimationFrame(() => {
          computeOverlays()
          chart.timeScale().subscribeVisibleLogicalRangeChange(computeOverlays)
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

          {/* Bar arrows — tip touches exact entry/exit price */}
          {barArrows.map((arrow, i) => (
            <div
              key={`bar-${i}`}
              className="absolute pointer-events-none flex flex-col items-center"
              style={{
                left: arrow.x - 14,
                // Arrow tip at arrow.y: if pointing down, label+arrow above the point
                // If pointing up, arrow+label below the point
                top: arrow.direction === 'down'
                  ? arrow.y - 40
                  : arrow.y,
                zIndex: 5,
                width: 28,
              }}
            >
              {/* For down arrow: label on top, then arrow, tip at bottom = price */}
              {arrow.direction === 'down' && (
                <>
                  <span className="text-[9px] font-bold leading-tight text-center whitespace-pre-line mb-0.5" style={{ color: arrow.color }}>
                    {arrow.label}
                  </span>
                  <svg width="14" height="10" viewBox="0 0 14 10" className="mx-auto">
                    <polygon points="7,10 0,0 14,0" fill={arrow.color} />
                  </svg>
                </>
              )}
              {/* For up arrow: arrow tip at top = price, then label below */}
              {arrow.direction === 'up' && (
                <>
                  <svg width="14" height="10" viewBox="0 0 14 10" className="mx-auto">
                    <polygon points="7,0 0,10 14,10" fill={arrow.color} />
                  </svg>
                  <span className="text-[9px] font-bold leading-tight text-center whitespace-pre-line mt-0.5" style={{ color: arrow.color }}>
                    {arrow.label}
                  </span>
                </>
              )}
            </div>
          ))}

          {/* Price arrows — small triangles on the price scale border */}
          {priceArrows.map((arrow, i) => (
            <div
              key={`price-${i}`}
              className="absolute pointer-events-none"
              style={{
                right: 52,
                top: arrow.y - 5,
                zIndex: 5,
              }}
            >
              <svg width="10" height="10" viewBox="0 0 10 10">
                <polygon points="0,5 10,0 10,10" fill={arrow.color} />
              </svg>
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

function findClosestCandle(candles: Candle[], targetSec: number): Candle {
  let closest = candles[0]
  let minDiff = Math.abs(candles[0].time - targetSec)
  for (const c of candles) {
    const diff = Math.abs(c.time - targetSec)
    if (diff < minDiff) {
      minDiff = diff
      closest = c
    }
  }
  return closest
}

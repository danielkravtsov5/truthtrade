'use client'

import { useEffect, useRef, useState } from 'react'
import { Trade } from '@/types'
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  ColorType,
  createSeriesMarkers,
} from 'lightweight-charts'
import type { IChartApi, CandlestickData, LineData, Time, SeriesMarker } from 'lightweight-charts'

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

export default function TradeChart({ trade }: TradeChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!containerRef.current) return

    let cancelled = false

    async function loadChart() {
      const params = new URLSearchParams({
        ticker: trade.ticker,
        opened_at: trade.opened_at,
        closed_at: trade.closed_at,
      })

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
        const exitTime = findClosestTime(candles, new Date(trade.closed_at).getTime() / 1000)

        const markers: SeriesMarker<Time>[] = [
          {
            time: entryTime as Time,
            position: trade.side === 'long' ? 'belowBar' : 'aboveBar',
            color: '#3b82f6',
            shape: trade.side === 'long' ? 'arrowUp' : 'arrowDown',
            text: `Entry $${trade.entry_price.toFixed(2)}`,
          },
          {
            time: exitTime as Time,
            position: trade.side === 'long' ? 'aboveBar' : 'belowBar',
            color: trade.pnl >= 0 ? '#10b981' : '#ef4444',
            shape: trade.side === 'long' ? 'arrowDown' : 'arrowUp',
            text: `Exit $${trade.exit_price.toFixed(2)}`,
          },
        ]

        // Use candlestick if we have OHLC data, otherwise line
        const hasOhlc = candles.some(c => c.high !== c.low)

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
          createSeriesMarkers(candleSeries, markers)
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
          createSeriesMarkers(lineSeries, markers)
        }

        chart.timeScale().fitContent()
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
  }, [trade])

  if (error) return null // Silently hide chart if candle data unavailable

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-100 bg-white">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      )}
      <div ref={containerRef} className="w-full" style={{ minHeight: 220 }} />
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

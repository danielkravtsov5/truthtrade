'use client'

import { useState, useRef, useEffect } from 'react'
import { Filter, X, ChevronDown } from 'lucide-react'
import { ALL_SYMBOLS } from '@/lib/asset-class'

interface FeedFiltersProps {
  filters: Record<string, string>
  onChange: (filters: Record<string, string>) => void
}

const ASSET_CLASSES = ['Crypto', 'Stocks', 'Forex']
const SIDES = ['long', 'short']
const OUTCOMES = ['win', 'loss']
const PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
]

function FilterChip({
  label,
  active,
  onClick,
  onClear,
}: {
  label: string
  active: boolean
  onClick: () => void
  onClear?: () => void
}) {
  return (
    <button
      onClick={active && onClear ? onClear : onClick}
      className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
        active
          ? 'bg-indigo-100 text-indigo-700'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      }`}
    >
      {label}
      {active && onClear && <X size={12} />}
    </button>
  )
}

function TickerSearch({
  value,
  onChange,
}: {
  value: string
  onChange: (ticker: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const q = query.toUpperCase().trim()
  const results = q.length > 0
    ? ALL_SYMBOLS.filter(s => s.symbol.includes(q)).slice(0, 8)
    : []

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={query}
        onChange={e => { setQuery(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder="Ticker..."
        className="w-20 px-2.5 py-1.5 text-xs border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto w-40">
          {results.map(({ symbol }) => (
            <button
              key={symbol}
              onClick={() => { onChange(symbol); setQuery(symbol); setOpen(false) }}
              className="block w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50"
            >
              {symbol}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function FeedFilters({ filters, onChange }: FeedFiltersProps) {
  const hasFilters = Object.keys(filters).length > 0

  function toggle(key: string, value: string) {
    const next = { ...filters }
    if (next[key] === value) {
      delete next[key]
    } else {
      next[key] = value
    }
    onChange(next)
  }

  function clearAll() {
    onChange({})
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
      <Filter size={14} className="text-gray-400 shrink-0" />

      {/* Asset class */}
      {ASSET_CLASSES.map(ac => (
        <FilterChip
          key={ac}
          label={ac}
          active={filters.assetClass === ac.toLowerCase()}
          onClick={() => toggle('assetClass', ac.toLowerCase())}
          onClear={() => toggle('assetClass', ac.toLowerCase())}
        />
      ))}

      {/* Ticker search */}
      <TickerSearch
        value={filters.ticker ?? ''}
        onChange={ticker => {
          const next = { ...filters }
          if (ticker) { next.ticker = ticker } else { delete next.ticker }
          onChange(next)
        }}
      />

      {/* Side */}
      {SIDES.map(s => (
        <FilterChip
          key={s}
          label={s === 'long' ? 'Long' : 'Short'}
          active={filters.side === s}
          onClick={() => toggle('side', s)}
          onClear={() => toggle('side', s)}
        />
      ))}

      {/* Outcome */}
      {OUTCOMES.map(o => (
        <FilterChip
          key={o}
          label={o === 'win' ? 'Win' : 'Loss'}
          active={filters.outcome === o}
          onClick={() => toggle('outcome', o)}
          onClear={() => toggle('outcome', o)}
        />
      ))}

      {/* Period */}
      {PERIODS.map(p => (
        <FilterChip
          key={p.value}
          label={p.label}
          active={filters.period === p.value}
          onClick={() => toggle('period', p.value)}
          onClear={() => toggle('period', p.value)}
        />
      ))}

      {hasFilters && (
        <button
          onClick={clearAll}
          className="px-3 py-1.5 text-xs font-medium text-red-500 hover:text-red-600 whitespace-nowrap"
        >
          Clear all
        </button>
      )}
    </div>
  )
}

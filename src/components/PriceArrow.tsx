interface PriceArrowProps {
  entryPrice: number
  exitPrices: number[]
  side: 'long' | 'short'
  isProfit: boolean
}

const SVG_W = 28
const SVG_H = 56
const PAD = 10
const CENTER_X = 14

export default function PriceArrow({ entryPrice, exitPrices, side, isProfit }: PriceArrowProps) {
  const allPrices = [entryPrice, ...exitPrices]
  const minPrice = Math.min(...allPrices)
  const maxPrice = Math.max(...allPrices)
  const range = maxPrice - minPrice

  // Map price to Y coordinate (higher price = lower Y)
  function priceToY(price: number): number {
    if (range === 0) return SVG_H / 2
    return PAD + (1 - (price - minPrice) / range) * (SVG_H - PAD * 2)
  }

  // If all prices identical, offset entry and exits so they don't overlap
  const entryY = range === 0 ? SVG_H / 2 + 8 : priceToY(entryPrice)
  const exitYs = exitPrices.map(p => range === 0 ? SVG_H / 2 - 8 : priceToY(p))

  const allYs = [entryY, ...exitYs]
  const topY = Math.min(...allYs)
  const bottomY = Math.max(...allYs)

  const color = isProfit ? '#10b981' : '#ef4444'

  // Arrow points toward profit direction
  // Long profit → arrow up (top), Long loss → arrow down (bottom)
  // Short profit → arrow down (bottom), Short loss → arrow up (top)
  const arrowAtTop = (side === 'long' && isProfit) || (side === 'short' && !isProfit)

  const arrowTipY = arrowAtTop ? topY - 5 : bottomY + 5
  const arrowBaseY = arrowAtTop ? topY + 1 : bottomY - 1

  return (
    <svg width={SVG_W} height={SVG_H} viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="flex-shrink-0">
      {/* Vertical line */}
      <line x1={CENTER_X} y1={topY} x2={CENTER_X} y2={bottomY} stroke={color} strokeWidth={1.5} />

      {/* Arrowhead */}
      <polygon
        points={`${CENTER_X},${arrowTipY} ${CENTER_X - 4},${arrowBaseY} ${CENTER_X + 4},${arrowBaseY}`}
        fill={color}
      />

      {/* Entry marker — blue square */}
      <rect x={CENTER_X - 3} y={entryY - 3} width={6} height={6} rx={1} fill="#3b82f6" />

      {/* Exit markers — circles */}
      {exitYs.map((y, i) => (
        <circle key={i} cx={CENTER_X} cy={y} r={3} fill={color} />
      ))}
    </svg>
  )
}

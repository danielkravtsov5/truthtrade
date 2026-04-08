'use client'

interface CalendarDay {
  date: string
  pnl: number
  trades: number
}

export default function CalendarHeatmap({ data }: { data: CalendarDay[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No trading days yet</p>
  }

  const dataMap = new Map(data.map(d => [d.date, d]))

  // Build grid: from earliest date to latest, fill gaps
  const startDate = new Date(data[0].date)
  const endDate = new Date(data[data.length - 1].date)

  // Align to start of week (Sunday)
  const gridStart = new Date(startDate)
  gridStart.setDate(gridStart.getDate() - gridStart.getDay())

  const days: (CalendarDay | null)[] = []
  const current = new Date(gridStart)
  while (current <= endDate) {
    const key = current.toISOString().slice(0, 10)
    days.push(dataMap.get(key) ?? null)
    current.setDate(current.getDate() + 1)
  }

  // Pad to complete last week
  while (days.length % 7 !== 0) {
    days.push(null)
  }

  const weeks = Math.ceil(days.length / 7)
  const maxAbsPnl = Math.max(...data.map(d => Math.abs(d.pnl)), 1)

  function getColor(day: CalendarDay | null): string {
    if (!day) return 'bg-gray-100'
    const intensity = Math.min(Math.abs(day.pnl) / maxAbsPnl, 1)
    if (day.pnl > 0) {
      if (intensity > 0.6) return 'bg-emerald-500'
      if (intensity > 0.3) return 'bg-emerald-300'
      return 'bg-emerald-200'
    } else if (day.pnl < 0) {
      if (intensity > 0.6) return 'bg-red-500'
      if (intensity > 0.3) return 'bg-red-300'
      return 'bg-red-200'
    }
    return 'bg-gray-200'
  }

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-0.5">
        {/* Day labels */}
        <div className="flex flex-col gap-0.5 mr-1">
          {dayLabels.map((label, i) => (
            <div key={i} className="w-6 h-3 flex items-center">
              <span className="text-[9px] text-gray-400">{i % 2 === 1 ? label : ''}</span>
            </div>
          ))}
        </div>

        {/* Week columns */}
        {Array.from({ length: weeks }, (_, weekIdx) => (
          <div key={weekIdx} className="flex flex-col gap-0.5">
            {Array.from({ length: 7 }, (_, dayIdx) => {
              const day = days[weekIdx * 7 + dayIdx]
              return (
                <div
                  key={dayIdx}
                  className={`w-3 h-3 rounded-sm ${getColor(day)}`}
                  title={day ? `${day.date}: $${day.pnl.toFixed(2)} (${day.trades} trade${day.trades > 1 ? 's' : ''})` : ''}
                />
              )
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1 mt-2 justify-end">
        <span className="text-[10px] text-gray-400">Loss</span>
        <div className="w-3 h-3 rounded-sm bg-red-500" />
        <div className="w-3 h-3 rounded-sm bg-red-300" />
        <div className="w-3 h-3 rounded-sm bg-gray-100" />
        <div className="w-3 h-3 rounded-sm bg-emerald-300" />
        <div className="w-3 h-3 rounded-sm bg-emerald-500" />
        <span className="text-[10px] text-gray-400">Profit</span>
      </div>
    </div>
  )
}

import Feed from '@/components/Feed'
import { createServerSupabaseClient } from '@/lib/supabase-server'

async function getTrendingTickers() {
  const supabase = await createServerSupabaseClient()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('trades')
    .select('ticker')
    .gte('closed_at', since)

  if (!data) return []

  const counts: Record<string, number> = {}
  data.forEach(t => { counts[t.ticker] = (counts[t.ticker] ?? 0) + 1 })
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([ticker, count]) => ({ ticker, count }))
}

async function getTopTraders() {
  const supabase = await createServerSupabaseClient()
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('trades')
    .select('user_id, pnl, users(username, display_name)')
    .gte('closed_at', since)

  if (!data) return []

  const byUser: Record<string, { username: string; display_name: string | null; total_pnl: number; trades: number; wins: number }> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data.forEach((t: any) => {
    const users = Array.isArray(t.users) ? t.users[0] : t.users
    if (!users) return
    if (!byUser[t.user_id]) {
      byUser[t.user_id] = { username: users.username, display_name: users.display_name, total_pnl: 0, trades: 0, wins: 0 }
    }
    byUser[t.user_id].total_pnl += t.pnl
    byUser[t.user_id].trades++
    if (t.pnl > 0) byUser[t.user_id].wins++
  })

  return Object.values(byUser)
    .filter(u => u.trades >= 2)
    .map(u => ({ ...u, win_rate: Math.round((u.wins / u.trades) * 100) }))
    .sort((a, b) => b.win_rate - a.win_rate)
    .slice(0, 5)
}

export default async function ExplorePage() {
  const [tickers, topTraders] = await Promise.all([getTrendingTickers(), getTopTraders()])

  return (
    <div className="max-w-xl mx-auto px-4 py-4">
          <h1 className="font-bold text-xl text-gray-900 mb-4">Explore</h1>

          {/* Trending tickers */}
          {tickers.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4">
              <h2 className="font-semibold text-gray-900 mb-3">Trending today</h2>
              <div className="flex flex-wrap gap-2">
                {tickers.map(({ ticker, count }) => (
                  <span key={ticker} className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium">
                    {ticker} <span className="text-indigo-400 text-xs">{count} trades</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Top traders this week */}
          {topTraders.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6">
              <h2 className="font-semibold text-gray-900 mb-3">Top traders this week</h2>
              <div className="space-y-3">
                {topTraders.map((trader, i) => (
                  <div key={trader.username} className="flex items-center gap-3">
                    <span className="text-gray-400 text-sm w-4">{i + 1}</span>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs">
                      {(trader.display_name ?? trader.username)[0].toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">@{trader.username}</p>
                      <p className="text-xs text-gray-400">{trader.trades} trades</p>
                    </div>
                    <span className={`text-sm font-bold ${trader.win_rate >= 50 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {trader.win_rate}% win
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h2 className="font-semibold text-gray-900 mb-3">Latest trades</h2>
          <Feed type="explore" />
    </div>
  )
}

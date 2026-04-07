import { notFound } from 'next/navigation'
import Navbar from '@/components/Navbar'
import ProfileHeader from '@/components/ProfileHeader'
import ProfileGrid from '@/components/ProfileGrid'
import Feed from '@/components/Feed'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { ProfileStats } from '@/types'

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user: currentUser } } = await supabase.auth.getUser()

  const { data: profileUser } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .single()

  if (!profileUser) notFound()

  // Stats
  const { data: trades } = await supabase
    .from('trades')
    .select('pnl')
    .eq('user_id', profileUser.id)

  const { count: followersCount } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', profileUser.id)

  const { count: followingCount } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('follower_id', profileUser.id)

  const stats: ProfileStats = {
    total_trades: trades?.length ?? 0,
    winning_trades: trades?.filter(t => t.pnl > 0).length ?? 0,
    win_rate: 0,
    avg_pnl: trades?.length ? trades.reduce((s, t) => s + t.pnl, 0) / trades.length : 0,
    total_pnl: trades?.reduce((s, t) => s + t.pnl, 0) ?? 0,
    best_trade_pnl: trades?.length ? Math.max(...trades.map(t => t.pnl)) : 0,
    followers_count: followersCount ?? 0,
    following_count: followingCount ?? 0,
  }
  stats.win_rate = stats.total_trades > 0 ? (stats.winning_trades / stats.total_trades) * 100 : 0

  // Is current user following this profile?
  let isFollowing = false
  if (currentUser && currentUser.id !== profileUser.id) {
    const { data: follow } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', currentUser.id)
      .eq('following_id', profileUser.id)
      .single()
    isFollowing = !!follow
  }

  // Posts for the grid
  const { data: posts } = await supabase
    .from('posts')
    .select(`
      id, analysis, created_at, updated_at,
      trade:trades(id, ticker, side, quantity, entry_price, exit_price, pnl, pnl_pct, opened_at, closed_at, broker),
      user:users(id, username, display_name, avatar_url)
    `)
    .eq('user_id', profileUser.id)
    .order('created_at', { ascending: false })
    .limit(30)

  return (
    <div className="flex min-h-screen">
      <Navbar />
      <main className="flex-1 md:ml-64 pb-20 md:pb-0">
        <div className="max-w-xl mx-auto">
          <ProfileHeader
            user={profileUser}
            stats={stats}
            isOwn={currentUser?.id === profileUser.id}
            isFollowing={isFollowing}
          />

          <div className="mt-1">
            <ProfileGrid posts={(posts as never) ?? []} />
          </div>

          <div className="px-4 mt-4">
            <h2 className="font-semibold text-gray-900 mb-3">All trades</h2>
            <Feed type="explore" />
          </div>
        </div>
      </main>
    </div>
  )
}

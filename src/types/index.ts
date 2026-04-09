export type Broker = 'binance' | 'tradovate' | 'bybit' | 'kraken' | 'okx' | 'alpaca' | 'oanda' | 'coinbase'

export interface User {
  id: string
  username: string
  display_name: string | null
  bio: string | null
  location: string | null
  pnl_visible: boolean
  avatar_url: string | null
  cover_url: string | null
  created_at: string
}

export interface BrokerConnection {
  id: string
  user_id: string
  broker: Broker
  api_key: string | null
  api_secret: string | null
  access_token: string | null
  refresh_token: string | null
  token_expires_at: string | null
  tradovate_account_id: number | null
  api_passphrase: string | null
  oanda_account_id: string | null
  coinbase_key_name: string | null
  coinbase_private_key: string | null
  paper_trading: boolean
  last_synced_at: string | null
  created_at: string
}

export interface Trade {
  id: string
  user_id: string
  broker_trade_id: string
  ticker: string          // e.g. BTCUSDT
  side: 'long' | 'short'
  quantity: number
  entry_price: number
  exit_price: number
  pnl: number
  pnl_pct: number
  opened_at: string
  closed_at: string
  broker: Broker
  raw_data: Record<string, unknown>
}

export interface PostMedia {
  id: string
  post_id: string
  type: 'image' | 'video' | 'text'
  url: string | null
  body: string | null
  sort_order: number
}

export interface Post {
  id: string
  user_id: string
  trade_id: string
  analysis: string | null
  created_at: string
  updated_at: string
  // Joined fields
  trade?: Trade
  user?: User
  media?: PostMedia[]
  like_count?: number
  comment_count?: number
  user_has_liked?: boolean
}

export interface Comment {
  id: string
  user_id: string
  post_id: string
  body: string
  created_at: string
  user?: User
}

export interface Follow {
  follower_id: string
  following_id: string
  created_at: string
}

/** A broker-agnostic fill used by the position tracker in trade-sync. */
export interface NormalizedFill {
  fill_id: string        // broker-unique fill identifier
  ticker: string
  side: 'buy' | 'sell'
  quantity: number
  price: number
  timestamp: string      // ISO 8601
  raw: Record<string, unknown>
}

export interface ProfileStats {
  total_trades: number
  winning_trades: number
  win_rate: number
  profit_factor: number
  avg_pnl: number
  total_pnl: number
  best_trade_pnl: number
  posts_count: number
  followers_count: number
  following_count: number
  broker_name: string | null
}

export interface Insight {
  id: string
  user_id: string
  body: string
  created_at: string
  updated_at: string
  // Joined fields
  user?: User
  like_count?: number
  comment_count?: number
  user_has_liked?: boolean
}

export interface InsightComment {
  id: string
  user_id: string
  insight_id: string
  body: string
  created_at: string
  user?: User
}

export type NotificationType = 'like' | 'comment' | 'follow' | 'new_trade' | 'insight_like' | 'insight_comment'

export interface Notification {
  id: string
  user_id: string
  actor_id: string
  type: NotificationType
  post_id: string | null
  insight_id: string | null
  read: boolean
  created_at: string
  actor?: User
  post?: { id: string; trade?: { ticker: string; side: string; pnl: number } }
  insight?: { id: string; body: string }
}

export interface LeaderboardEntry {
  rank: number
  user: User
  total_trades: number
  win_rate: number
  total_pnl: number
  profit_factor: number
  avg_pnl: number
}

export interface DashboardData {
  equity_curve: { date: string; cumulative_pnl: number }[]
  stats: {
    total_trades: number
    wins: number
    losses: number
    win_rate: number
    profit_factor: number
    avg_pnl: number
    total_pnl: number
    best_trade: number
    worst_trade: number
    current_streak: number
    streak_type: 'win' | 'loss' | null
  }
  by_ticker: { ticker: string; trades: number; pnl: number; win_rate: number }[]
  by_side: {
    long: { trades: number; pnl: number; win_rate: number }
    short: { trades: number; pnl: number; win_rate: number }
  }
  calendar: { date: string; pnl: number; trades: number }[]
  best_trades: Trade[]
  worst_trades: Trade[]
}

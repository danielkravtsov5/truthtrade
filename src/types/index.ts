export type Broker = 'binance'

export interface User {
  id: string
  username: string
  display_name: string | null
  bio: string | null
  location: string | null
  pnl_visible: boolean
  avatar_url: string | null
  created_at: string
}

export interface BrokerConnection {
  id: string
  user_id: string
  broker: Broker
  api_key: string
  api_secret: string // stored encrypted
  paper_trading: boolean
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

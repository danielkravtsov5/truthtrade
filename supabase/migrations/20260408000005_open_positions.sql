-- Track open positions per user/broker/ticker.
-- When net_quantity reaches 0 the position is closed and a post is created.

CREATE TABLE open_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  broker text NOT NULL,
  ticker text NOT NULL,
  side text CHECK (side IN ('long', 'short')),
  net_quantity numeric NOT NULL DEFAULT 0,
  total_entry_cost numeric NOT NULL DEFAULT 0, -- sum(price * qty) for entry fills
  total_entry_qty numeric NOT NULL DEFAULT 0,  -- sum(qty) for entry fills
  total_exit_proceeds numeric NOT NULL DEFAULT 0, -- sum(price * qty) for exit fills
  total_exit_qty numeric NOT NULL DEFAULT 0,   -- sum(qty) for exit fills
  opened_at timestamptz,
  fills jsonb NOT NULL DEFAULT '[]',           -- all raw fills for audit trail
  UNIQUE(user_id, broker, ticker)
);

-- RLS: users can only see their own positions
ALTER TABLE open_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own positions"
  ON open_positions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on open_positions"
  ON open_positions FOR ALL
  USING (true)
  WITH CHECK (true);

-- Allow the trade_id UNIQUE constraint on posts to be nullable
-- so we can have posts without a trade (position-close posts)
-- Actually we keep the 1:1 mapping — the closing trade is linked.

-- Add a position_pnl field to trades so the closing trade carries aggregate P&L
ALTER TABLE trades ADD COLUMN IF NOT EXISTS is_position_close boolean DEFAULT false;

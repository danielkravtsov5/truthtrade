-- Additional indexes for dashboard, leaderboard, and feed filter queries
CREATE INDEX IF NOT EXISTS idx_trades_user_ticker ON public.trades(user_id, ticker);
CREATE INDEX IF NOT EXISTS idx_trades_ticker ON public.trades(ticker);
CREATE INDEX IF NOT EXISTS idx_trades_side ON public.trades(side);
CREATE INDEX IF NOT EXISTS idx_trades_pnl ON public.trades(pnl);
CREATE INDEX IF NOT EXISTS idx_trades_closed_at ON public.trades(closed_at);

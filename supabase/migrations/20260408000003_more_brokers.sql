-- Expand broker constraint to include all supported brokers
ALTER TABLE public.broker_connections DROP CONSTRAINT broker_connections_broker_check;
ALTER TABLE public.broker_connections ADD CONSTRAINT broker_connections_broker_check
  CHECK (broker IN ('binance', 'tradovate', 'bybit', 'kraken', 'okx', 'alpaca', 'oanda', 'coinbase'));

-- OKX needs a passphrase field
ALTER TABLE public.broker_connections ADD COLUMN IF NOT EXISTS api_passphrase text;

-- OANDA needs account ID
ALTER TABLE public.broker_connections ADD COLUMN IF NOT EXISTS oanda_account_id text;

-- Alpaca needs to know if paper trading
-- (paper_trading column already exists from tradovate migration)

-- Coinbase stores JWT key ID + private key (ES256)
ALTER TABLE public.broker_connections ADD COLUMN IF NOT EXISTS coinbase_key_name text;
ALTER TABLE public.broker_connections ADD COLUMN IF NOT EXISTS coinbase_private_key text;

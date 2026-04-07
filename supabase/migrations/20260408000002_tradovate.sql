-- Allow tradovate as a broker
ALTER TABLE public.broker_connections DROP CONSTRAINT broker_connections_broker_check;
ALTER TABLE public.broker_connections ADD CONSTRAINT broker_connections_broker_check CHECK (broker IN ('binance', 'tradovate'));

-- Add OAuth fields for Tradovate (api_key/api_secret stay for Binance, OAuth tokens for Tradovate)
ALTER TABLE public.broker_connections ALTER COLUMN api_key DROP NOT NULL;
ALTER TABLE public.broker_connections ALTER COLUMN api_secret DROP NOT NULL;
ALTER TABLE public.broker_connections ADD COLUMN access_token text;
ALTER TABLE public.broker_connections ADD COLUMN refresh_token text;
ALTER TABLE public.broker_connections ADD COLUMN token_expires_at timestamptz;
ALTER TABLE public.broker_connections ADD COLUMN tradovate_account_id bigint;

# TruthTrade

Verified day trading social platform. Traders connect real broker accounts and share verified trades — no faking. Think Instagram for traders, backed by real PnL data synced directly from brokers.

**Why this matters:** Every trading social platform today is full of fake screenshots. TruthTrade solves this by pulling trades directly from broker APIs — you can't fake what's verified. The core loop is: connect broker → trades sync automatically → positions close → posts appear in the feed with real PnL.

## Tech Stack

- **Framework:** Next.js 16 (App Router, React 19, TypeScript)
- **Database & Auth:** Supabase (PostgreSQL + Auth + Storage)
- **Styling:** Tailwind CSS 4 (no component library)
- **Icons:** Lucide React
- **Charts:** Recharts
- **Deployment:** Vercel (with cron job for trade syncing every minute)

## Commands

```bash
npm run dev       # Dev server at localhost:3000
npm run build     # Production build
npm start         # Start production server
```

## Project Structure

```
src/
├── app/                    # Next.js App Router pages + API routes
│   ├── api/
│   │   ├── auth/callback/  # Supabase OAuth callback
│   │   ├── broker/         # Broker connection + per-broker endpoints
│   │   │   ├── connect/    # Generic broker connection
│   │   │   ├── callback/   # OAuth callback for brokers
│   │   │   ├── alpaca/     # Alpaca-specific routes
│   │   │   ├── bybit/      # Bybit-specific routes
│   │   │   ├── coinbase/   # Coinbase-specific routes
│   │   │   ├── kraken/     # Kraken-specific routes
│   │   │   ├── oanda/      # OANDA-specific routes
│   │   │   ├── okx/        # OKX-specific routes
│   │   │   └── tradovate/  # Tradovate-specific routes
│   │   ├── feed/           # Paginated feed (explore/following)
│   │   ├── posts/[id]/     # Post CRUD, likes, comments, media
│   │   ├── follow/         # Follow/unfollow
│   │   ├── users/me/       # Profile updates, avatar upload
│   │   └── cron/sync-trades/ # Vercel cron: syncs trades every minute
│   ├── connect-broker/     # Broker connection UI
│   ├── explore/            # Explore all trades
│   ├── login/ & signup/    # Auth pages
│   ├── profile/[username]/ # User profiles
│   └── trade/[id]/         # Individual trade detail
├── components/             # React components (mostly client)
│   ├── AppShell.tsx        # Shared layout (sidebar + mobile nav)
│   ├── Feed.tsx            # Feed with infinite scroll
│   ├── TradeCard.tsx       # Trade post card
│   └── ...                 # Profile, carousel, navbar components
├── lib/                    # Supabase clients, broker APIs, trade sync
│   ├── supabase.ts         # Browser Supabase client
│   ├── supabase-server.ts  # Server Supabase client (createServerSupabaseClient)
│   ├── trade-sync.ts       # Orchestrates all broker syncing
│   ├── utils.ts            # Shared utilities
│   └── {broker}.ts         # Per-broker fetch + transform (alpaca, binance, bybit, coinbase, kraken, oanda, okx, tradovate)
├── types/index.ts          # All TypeScript types
└── proxy.ts                # Supabase session-refresh middleware

supabase/migrations/        # SQL migrations (date-versioned)
```

## Key Conventions

### Authentication
- Supabase Auth with email/password and Google OAuth
- `proxy.ts` is middleware that refreshes Supabase sessions on every request
- API routes authenticate via `createServerSupabaseClient()` then `supabase.auth.getUser()`
- Service role client used only for cron/admin operations

### API Routes
- All under `src/app/api/`
- Return `NextResponse.json()` with appropriate status codes
- Auth check pattern: get user, return 401 if not authenticated
- Cursor-based pagination using ISO date timestamps

### Broker Integrations
Each broker has a dedicated file in `src/lib/` that exports:
- Fetch functions to pull trades from the broker API
- Transform functions to normalize into the shared `Trade` schema
- `trade-sync.ts` orchestrates all broker syncing, called by the cron job

Current brokers: Alpaca, Binance, Bybit, Coinbase, Kraken, OANDA, OKX, Tradovate

To add a new broker:
1. Create `src/lib/{broker}.ts` with fetch + transform functions
2. Add API route at `src/app/api/broker/{broker}/`
3. Add broker fields to `broker_connections` table via migration
4. Register in `trade-sync.ts`

### Components
- Server Components by default; `'use client'` only for interactivity
- No component library — all UI is Tailwind utility classes
- Realtime updates via Supabase channels (`postgres_changes`)

### Database
- Supabase PostgreSQL with Row-Level Security on all tables
- Migrations in `supabase/migrations/` (format: `YYYYMMDDHHMMSS_description.sql`)
- Core tables: `users`, `broker_connections`, `trades`, `open_positions`, `posts`, `post_media`, `follows`, `likes`, `comments`
- `open_positions` tracks live positions per user/broker/ticker — when net_quantity hits 0, position closes and a post is auto-created
- Supabase Storage for avatars and post media

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   # Supabase anon/public key
SUPABASE_SERVICE_ROLE_KEY       # Supabase service role key (server-only)
NEXT_PUBLIC_APP_URL             # App URL (http://localhost:3000 for dev)
CRON_SECRET                     # Bearer token for cron endpoint auth
```

Optional (for specific broker OAuth flows):
```
TRADOVATE_APP_ID / TRADOVATE_CID / TRADOVATE_SECRET
```

## Don'ts

- Never use the Supabase service role client outside of `cron/` routes or admin operations
- Don't add component styles to `globals.css` — use Tailwind utility classes
- Don't create migrations without first reading existing migrations to understand current schema
- Don't add new dependencies without checking if the existing stack already covers the need (e.g., no axios — use fetch)
- Don't hardcode broker-specific logic in `trade-sync.ts` — keep it in the individual broker files
- Binance has a lib file (`src/lib/binance.ts`) but no API route yet — don't reference a binance API route

## Dev Workflows

**Adding a new page:** Create `src/app/{route}/page.tsx`. Use Server Components by default. Add to navigation in `AppShell.tsx` if needed.

**Testing broker changes:** The cron endpoint can be hit manually: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/sync-trades`

**Database changes:** Create a new migration file in `supabase/migrations/` with the next sequential timestamp. Always include RLS policies for new tables.

## Testing

No test framework is configured yet. When adding tests, prefer Vitest.

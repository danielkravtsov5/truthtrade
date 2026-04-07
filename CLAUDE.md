@AGENTS.md

# TruthTrade

Verified day trading social platform. Traders connect real broker accounts and share verified trades — no faking. Think Instagram for traders, backed by real PnL data synced directly from brokers.

## Tech Stack

- **Framework:** Next.js 16 (App Router, React 19, TypeScript)
- **Database & Auth:** Supabase (PostgreSQL + Auth + Storage)
- **Styling:** Tailwind CSS 4 (no component library)
- **Icons:** Lucide React
- **Charts:** Recharts
- **Deployment:** Vercel (with cron job for trade syncing)

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
├── lib/                    # Supabase clients, broker APIs, trade sync, utils
├── types/index.ts          # All TypeScript types
└── proxy.ts                # Next.js proxy (Supabase session refresh)

supabase/migrations/        # SQL migrations (date-versioned)
```

## Key Conventions

### Authentication
- Supabase Auth with email/password and Google OAuth
- `proxy.ts` refreshes sessions on every request
- API routes authenticate via `createServerSupabaseClient()` then `supabase.auth.getUser()`
- Service role client used only for cron/admin operations

### API Routes
- All under `src/app/api/`
- Return `NextResponse.json()` with appropriate status codes
- Auth check pattern: get user, return 401 if not authenticated
- Cursor-based pagination using ISO date timestamps

### Broker Integrations
Each broker has a dedicated file in `src/lib/` (e.g., `binance.ts`, `kraken.ts`) that exports:
- Fetch functions to pull trades from the broker API
- Transform functions to normalize into the shared `Trade` schema
- `trade-sync.ts` orchestrates all broker syncing, called by the cron job

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
- Core tables: `users`, `broker_connections`, `trades`, `posts`, `post_media`, `follows`, `likes`, `comments`
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

## Testing

No test framework is configured yet. When adding tests, prefer Vitest.

-- Enable UUID extension
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Users (extends Supabase auth.users)
create table public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  display_name text,
  bio text,
  avatar_url text,
  created_at timestamptz default now() not null
);

-- Broker connections (Binance API key/secret)
create table public.broker_connections (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  broker text not null check (broker in ('binance')),
  api_key text not null,
  api_secret text not null,   -- store encrypted at application level
  paper_trading boolean default false,
  last_synced_at timestamptz,
  created_at timestamptz default now() not null,
  unique(user_id, broker)
);

-- Trades (auto-synced from Binance)
create table public.trades (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  broker_trade_id text not null,
  ticker text not null,         -- e.g. BTCUSDT
  side text not null check (side in ('long', 'short')),
  quantity numeric not null,
  entry_price numeric not null,
  exit_price numeric not null,
  pnl numeric not null,
  pnl_pct numeric not null,
  opened_at timestamptz not null,
  closed_at timestamptz not null,
  broker text not null,
  raw_data jsonb default '{}',
  created_at timestamptz default now() not null,
  unique(user_id, broker_trade_id)
);

-- Posts (auto-created when trade syncs; trader adds analysis)
create table public.posts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  trade_id uuid references public.trades(id) on delete cascade not null unique,
  analysis text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Follows
create table public.follows (
  follower_id uuid references public.users(id) on delete cascade not null,
  following_id uuid references public.users(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  primary key (follower_id, following_id),
  check (follower_id != following_id)
);

-- Likes
create table public.likes (
  user_id uuid references public.users(id) on delete cascade not null,
  post_id uuid references public.posts(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  primary key (user_id, post_id)
);

-- Comments
create table public.comments (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  post_id uuid references public.posts(id) on delete cascade not null,
  body text not null,
  created_at timestamptz default now() not null
);

-- Indexes
create index on public.posts(user_id, created_at desc);
create index on public.trades(user_id, closed_at desc);
create index on public.follows(follower_id);
create index on public.follows(following_id);
create index on public.likes(post_id);
create index on public.comments(post_id, created_at);

-- RLS
alter table public.users enable row level security;
alter table public.broker_connections enable row level security;
alter table public.trades enable row level security;
alter table public.posts enable row level security;
alter table public.follows enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;

create policy "users_read_all" on public.users for select using (true);
create policy "users_insert_own" on public.users for insert with check (auth.uid() = id);
create policy "users_update_own" on public.users for update using (auth.uid() = id);

create policy "broker_own" on public.broker_connections for all using (auth.uid() = user_id);

create policy "trades_read_all" on public.trades for select using (true);
create policy "trades_insert_own" on public.trades for insert with check (auth.uid() = user_id);

create policy "posts_read_all" on public.posts for select using (true);
create policy "posts_insert_own" on public.posts for insert with check (auth.uid() = user_id);
create policy "posts_update_own" on public.posts for update using (auth.uid() = user_id);

create policy "follows_read_all" on public.follows for select using (true);
create policy "follows_own" on public.follows for all using (auth.uid() = follower_id);

create policy "likes_read_all" on public.likes for select using (true);
create policy "likes_own" on public.likes for all using (auth.uid() = user_id);

create policy "comments_read_all" on public.comments for select using (true);
create policy "comments_insert_auth" on public.comments for insert with check (auth.uid() = user_id);
create policy "comments_delete_own" on public.comments for delete using (auth.uid() = user_id);

-- Auto-create user profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'display_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Auto-update posts.updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger posts_updated_at
  before update on public.posts
  for each row execute procedure public.handle_updated_at();

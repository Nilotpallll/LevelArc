-- ============================================================================
-- LaunchPad — Supabase schema
-- Run this once in Supabase: Project → SQL Editor → New query → paste → Run
-- ============================================================================

-- Extension needed for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. PROFILES  (one row per student, linked 1:1 to Supabase Auth user)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  full_name         text not null,
  college           text,
  year_of_study     text check (year_of_study in ('1st Year','2nd Year','3rd Year','4th Year')),
  leetcode_username text,
  github_username   text,
  cgpa              numeric(3,2),
  level             int not null default 1,
  xp                int not null default 0,
  streak_days       int not null default 0,
  last_active_date  date default current_date,
  created_at        timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. SUBSCRIPTIONS  (mirrors Stripe state — written to by the webhook only)
-- ----------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  plan                  text not null check (plan in ('starter','pro','placement_ready')),
  stripe_customer_id    text,
  stripe_subscription_id text unique,
  status                text not null default 'incomplete'
                          check (status in ('incomplete','active','past_due','canceled','trialing')),
  current_period_end   timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists idx_subscriptions_user on public.subscriptions(user_id);

-- ----------------------------------------------------------------------------
-- 3. DSA PROGRESS
-- ----------------------------------------------------------------------------
create table if not exists public.dsa_progress (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profiles(id) on delete cascade,
  topic     text not null,
  percent   int not null default 0 check (percent between 0 and 100),
  updated_at timestamptz not null default now(),
  unique (user_id, topic)
);

-- ----------------------------------------------------------------------------
-- 4. LEETCODE STATS  (refreshed by /api/leetcode-stats)
-- ----------------------------------------------------------------------------
create table if not exists public.leetcode_stats (
  user_id       uuid primary key references public.profiles(id) on delete cascade,
  total_solved  int not null default 0,
  easy_solved   int not null default 0,
  medium_solved int not null default 0,
  hard_solved   int not null default 0,
  ranking       int,
  last_synced   timestamptz
);

-- ----------------------------------------------------------------------------
-- 5. GITHUB STATS  (refreshed by /api/github-stats)
-- ----------------------------------------------------------------------------
create table if not exists public.github_stats (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  public_repos   int not null default 0,
  followers      int not null default 0,
  total_commits_year int not null default 0,
  last_synced    timestamptz
);

-- ----------------------------------------------------------------------------
-- 6. DAILY ACTIVITY  (heatmap — one row per user per day)
-- ----------------------------------------------------------------------------
create table if not exists public.activity_log (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profiles(id) on delete cascade,
  activity_date date not null default current_date,
  problems_solved int not null default 0,
  unique (user_id, activity_date)
);

-- ----------------------------------------------------------------------------
-- 7. AI TASKS  (weekly coach checklist)
-- ----------------------------------------------------------------------------
create table if not exists public.ai_tasks (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references public.profiles(id) on delete cascade,
  text      text not null,
  tag       text not null check (tag in ('DSA','LeetCode','GitHub','Resume','Interview')),
  done      boolean not null default false,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 8. RESUME SCORES
-- ----------------------------------------------------------------------------
create table if not exists public.resume_scores (
  user_id       uuid primary key references public.profiles(id) on delete cascade,
  overall_score int not null default 0,
  sections      jsonb not null default '[]',
  updated_at    timestamptz not null default now()
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- Every table: a user can only read/write their own row(s).
-- The service_role key (used only in serverless functions, never the browser)
-- bypasses RLS entirely, which is how the Stripe webhook / sync jobs write.
-- ============================================================================
alter table public.profiles        enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.dsa_progress    enable row level security;
alter table public.leetcode_stats  enable row level security;
alter table public.github_stats    enable row level security;
alter table public.activity_log    enable row level security;
alter table public.ai_tasks        enable row level security;
alter table public.resume_scores   enable row level security;

-- Drop any prior policies so the schema can be re-run safely.
drop policy if exists "own profile read" on public.profiles;
drop policy if exists "own profile write" on public.profiles;
drop policy if exists "own profile insert" on public.profiles;
drop policy if exists "own subs read" on public.subscriptions;
drop policy if exists "own dsa read" on public.dsa_progress;
drop policy if exists "own dsa write" on public.dsa_progress;
drop policy if exists "own lc read" on public.leetcode_stats;
drop policy if exists "own gh read" on public.github_stats;
drop policy if exists "own activity read" on public.activity_log;
drop policy if exists "own activity write" on public.activity_log;
drop policy if exists "own tasks all" on public.ai_tasks;
drop policy if exists "own resume read" on public.resume_scores;

create policy "own profile read"   on public.profiles        for select using (auth.uid() = id);
create policy "own profile write"  on public.profiles        for update using (auth.uid() = id);
create policy "own profile insert" on public.profiles        for insert with check (auth.uid() = id);

create policy "own subs read"      on public.subscriptions   for select using (auth.uid() = user_id);

create policy "own dsa read"       on public.dsa_progress    for select using (auth.uid() = user_id);
create policy "own dsa write"      on public.dsa_progress    for all using (auth.uid() = user_id);

create policy "own lc read"        on public.leetcode_stats  for select using (auth.uid() = user_id);

create policy "own gh read"        on public.github_stats    for select using (auth.uid() = user_id);

create policy "own activity read"  on public.activity_log    for select using (auth.uid() = user_id);
create policy "own activity write" on public.activity_log    for all using (auth.uid() = user_id);

create policy "own tasks all"      on public.ai_tasks         for all using (auth.uid() = user_id);

create policy "own resume read"    on public.resume_scores    for select using (auth.uid() = user_id);

-- ============================================================================
-- PUBLIC LEADERBOARD VIEW — safe to expose: name + xp only, no PII
-- ============================================================================
create or replace view public.leaderboard as
  select id as user_id, full_name, xp, level
  from public.profiles
  order by xp desc;

grant select on public.leaderboard to anon, authenticated;

-- ============================================================================
-- AUTO-CREATE PROFILE ROW WHEN A USER SIGNS UP
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'New Student'));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

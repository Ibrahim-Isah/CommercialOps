-- Commercial Ops Dashboard — Supabase schema.
-- Run this ONCE in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: uses IF NOT EXISTS / drops policies before recreating them.

create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  issuing_body text not null,
  category text not null check (
    category in ('Regulatory', 'Operational', 'Insurance', 'Vessel', 'Environmental', 'Other')
  ),
  registration_date date not null,
  expiration_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Watchlist rows store the latest vessel snapshot as JSON: the vessel shape
-- has many optional AIS fields and is only a cached snapshot, so a jsonb
-- column keeps the schema stable as the Vessel type evolves.
create table if not exists public.watchlist (
  mmsi text primary key,
  vessel jsonb not null,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Small key/value table for app state (e.g. the one-time seed flag).
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- This is an internal tool with no user login yet; the Next.js server talks to
-- Supabase with the publishable (anon) key. Enable RLS with permissive
-- policies so the tables are not wide open the day auth IS added — tighten
-- these policies to authenticated users at that point.
alter table public.certificates enable row level security;
alter table public.watchlist enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "anon full access" on public.certificates;
create policy "anon full access" on public.certificates
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "anon full access" on public.watchlist;
create policy "anon full access" on public.watchlist
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "anon full access" on public.app_settings;
create policy "anon full access" on public.app_settings
  for all to anon, authenticated using (true) with check (true);

-- Gas pricing tables for the Oil & Gas Forecast page.
-- Run ONCE in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run. The app seeds both tables on first use, so no manual data
-- entry is needed — edit the rows afterwards to update reference values.

-- Historical benchmark price series (monthly). Generic shape so more series
-- can be added later without schema changes.
create table if not exists public.price_series (
  id uuid primary key default gen_random_uuid(),
  series_name text not null, -- 'henry_hub' | 'ttf' | 'jkm'
  date date not null,
  price numeric not null check (price >= 0),
  unit text not null default 'USD/MMBtu',
  currency text not null default 'USD',
  created_at timestamptz not null default now(),
  unique (series_name, date)
);

create index if not exists price_series_name_date_idx
  on public.price_series (series_name, date);

-- Nigeria PIA regulated gas prices, set annually by the NMDPRA.
-- One row per sector per effective date; for band sectors (gas-based
-- industries) price_usd_mmbtu is the ceiling (the DBP) and floor_usd_mmbtu
-- the lower bound. Edit these rows when the regulator publishes new values.
create table if not exists public.pia_gas_price (
  id uuid primary key default gen_random_uuid(),
  effective_date date not null,
  sector text not null check (sector in ('power', 'commercial', 'gas_based_industries')),
  price_usd_mmbtu numeric not null check (price_usd_mmbtu >= 0),
  floor_usd_mmbtu numeric check (floor_usd_mmbtu is null or floor_usd_mmbtu >= 0),
  created_at timestamptz not null default now(),
  unique (effective_date, sector)
);

-- Same posture as the rest of the app: internal tool on the publishable key.
alter table public.price_series enable row level security;
alter table public.pia_gas_price enable row level security;

drop policy if exists "anon full access" on public.price_series;
create policy "anon full access" on public.price_series
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "anon full access" on public.pia_gas_price;
create policy "anon full access" on public.pia_gas_price
  for all to anon, authenticated using (true) with check (true);

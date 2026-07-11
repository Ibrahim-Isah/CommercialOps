-- Commercial Ops Dashboard — Supply Chain module schema.
-- Run this ONCE in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: uses IF NOT EXISTS / drops policies before recreating them.
-- Requires the base schema (supabase/schema.sql) conventions but does not depend on it.

-- Procurement staff. The app has no auth system yet, so buyers are plain
-- records rather than auth users; when auth lands, link this to auth.users.
create table if not exists public.buyers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rc_number text,
  contact_person text,
  email text,
  phone text,
  address text,
  state text,
  category text not null default 'Other' check (category in (
    'Drilling Services', 'Engineering and Fabrication', 'Procurement and Supply',
    'Logistics and Marine', 'Inspection and Testing', 'HSE Services',
    'Manpower Supply', 'Equipment Rental', 'Chemicals', 'IT and Communications', 'Other'
  )),
  nigerian_equity_percentage numeric check (
    nigerian_equity_percentage is null
    or (nigerian_equity_percentage >= 0 and nigerian_equity_percentage <= 100)
  ),
  -- Performance sub-scores (0–5). The overall confidence rating is a weighted
  -- average computed in the app, unless confidence_override is set.
  delivery_score numeric check (delivery_score is null or (delivery_score >= 0 and delivery_score <= 5)),
  quality_score numeric check (quality_score is null or (quality_score >= 0 and quality_score <= 5)),
  hse_score numeric check (hse_score is null or (hse_score >= 0 and hse_score <= 5)),
  compliance_score numeric check (compliance_score is null or (compliance_score >= 0 and compliance_score <= 5)),
  confidence_override numeric check (confidence_override is null or (confidence_override >= 0 and confidence_override <= 5)),
  status text not null default 'active' check (status in ('active', 'suspended', 'blacklisted', 'inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vendor_documents (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors (id) on delete cascade,
  document_type text not null check (document_type in (
    'Certificate of Incorporation (CAC)', 'CAC Form C02 (Allotment of Shares)',
    'CAC Form C07 (List of Directors)', 'NUPRC Certificate',
    'NCDMB / NOGIC JQS registration', 'NIPEX / NJQS prequalification',
    'Tax Clearance Certificate (TCC)', 'VAT Registration Certificate',
    'HSE / ISO certification', 'Insurance certificate', 'Bank reference letter',
    'Audited financial statements', 'Other'
  )),
  document_name text not null,
  document_number text,
  issue_date date,
  expiry_date date, -- null = does not expire; status is derived from this in the app
  file_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vendor_documents_vendor_id_idx on public.vendor_documents (vendor_id);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  reference_number text not null,
  description text,
  vendor_id uuid references public.vendors (id) on delete set null,
  buyer_id uuid not null references public.buyers (id),
  status text not null default 'ongoing' check (status in ('ongoing', 'completed', 'cancelled', 'delayed', 'expired')),
  procurement_method text not null check (procurement_method in (
    'open competitive bidding', 'restricted tender', 'two stage tender', 'single source'
  )),
  -- Costs are carried per currency: a project may be budgeted in Naira,
  -- Dollars, or both (split contracts, e.g. 60/40, hold an amount in each).
  budgeted_cost_ngn numeric check (budgeted_cost_ngn is null or budgeted_cost_ngn >= 0),
  final_cost_ngn numeric check (final_cost_ngn is null or final_cost_ngn >= 0),
  budgeted_cost_usd numeric check (budgeted_cost_usd is null or budgeted_cost_usd >= 0),
  final_cost_usd numeric check (final_cost_usd is null or final_cost_usd >= 0),
  -- Generated columns: savings only exist once that currency has a final cost
  -- (stay null until then), and are directly queryable for analytics.
  cost_savings_ngn numeric generated always as (budgeted_cost_ngn - final_cost_ngn) stored,
  cost_savings_usd numeric generated always as (budgeted_cost_usd - final_cost_usd) stored,
  constraint projects_budget_present
    check (budgeted_cost_ngn is not null or budgeted_cost_usd is not null),
  start_date date not null,
  end_date date not null,
  actual_completion_date date,
  nigerian_content_percentage numeric check (
    nigerian_content_percentage is null
    or (nigerian_content_percentage >= 0 and nigerian_content_percentage <= 100)
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_vendor_id_idx on public.projects (vendor_id);
create index if not exists projects_buyer_id_idx on public.projects (buyer_id);
create index if not exists projects_status_idx on public.projects (status);

-- Audit trail: one row per status change.
create table if not exists public.project_status_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid references public.buyers (id) on delete set null,
  changed_at timestamptz not null default now(),
  note text
);

create index if not exists project_status_history_project_id_idx
  on public.project_status_history (project_id);

-- Same posture as the base schema: internal tool, server talks to Supabase
-- with the publishable (anon) key. Tighten these when auth is added.
alter table public.buyers enable row level security;
alter table public.vendors enable row level security;
alter table public.vendor_documents enable row level security;
alter table public.projects enable row level security;
alter table public.project_status_history enable row level security;

drop policy if exists "anon full access" on public.buyers;
create policy "anon full access" on public.buyers
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "anon full access" on public.vendors;
create policy "anon full access" on public.vendors
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "anon full access" on public.vendor_documents;
create policy "anon full access" on public.vendor_documents
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "anon full access" on public.projects;
create policy "anon full access" on public.projects
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "anon full access" on public.project_status_history;
create policy "anon full access" on public.project_status_history
  for all to anon, authenticated using (true) with check (true);

-- Storage bucket for uploaded vendor documents (public read so file links work).
insert into storage.buckets (id, name, public)
values ('vendor-documents', 'vendor-documents', true)
on conflict (id) do nothing;

drop policy if exists "anon vendor documents" on storage.objects;
create policy "anon vendor documents" on storage.objects
  for all to anon, authenticated
  using (bucket_id = 'vendor-documents')
  with check (bucket_id = 'vendor-documents');

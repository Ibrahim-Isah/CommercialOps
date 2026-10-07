-- Commercial Ops Dashboard — Grievance module schema.
-- Implements the Local Stakeholders Grievance Mechanism (OPI SXD 001/OERNL r01):
-- the Grievance Register (Annex A.3), the case lifecycle, and the audit trail
-- required for traceability (§7).
-- Run this ONCE in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Safe to re-run: uses IF NOT EXISTS / drops policies before recreating them.

create table if not exists public.grievances (
  id uuid primary key default gen_random_uuid(),
  -- Serial no. of the Grievance Register, e.g. GRV-2026-0001 (unique per year).
  reference_number text not null unique,
  title text not null,
  description text,
  category text not null check (category in (
    'Environmental Concerns', 'Gas Flaring', 'Land Degradation',
    'Community Displacement', 'Cultural Heritage', 'Compensation',
    'Local Employment', 'Community Development Projects',
    'Community Recognition', 'Delayed Payments'
  )),
  nature text not null check (nature in (
    'Encroachment', 'Flooding', 'Blasting (noise, vibration)', 'Soil erosion',
    'Oil spill', 'Access road', 'Land acquisition',
    'Material transportation and use', 'Water pollution', 'Gas flaring',
    'MoUs', 'Property damage (farmland, assets)', 'Other'
  )),
  severity text not null default 'Low' check (severity in ('Low', 'Medium', 'High')),
  -- §6.3 high-severity human-rights related grievances.
  human_rights_related boolean not null default false,
  -- §6.2 sensitive grievances: must be notified to XMD / GMD immediately.
  sensitive boolean not null default false,
  complainant_name text not null,
  complainant_type text not null default 'Individual' check (complainant_type in ('Individual', 'Group', 'Community')),
  complainant_contact text,
  stakeholder_group text,
  state text,
  lga text,
  community text,
  area text not null check (area in ('Land Area', 'Swamp Area', 'Port Harcourt Office')),
  medium text not null check (medium in (
    'Email', 'Written Letter', 'Phone Call', 'SMS', 'WhatsApp',
    'In-Person Engagement', 'Office Visit'
  )),
  date_of_complaint date not null,
  date_received date not null,
  registering_officer text not null,
  documentation text,
  responsible_department text,
  responsible_person text,
  action_to_be_done text,
  target_resolution_date date,
  -- Resolved on receipt, without the full investigation path (§ definitions: Rapid Response).
  rapid_response boolean not null default false,
  litigation boolean not null default false,
  step text not null default 'Receive & Register' check (step in (
    'Receive & Register', 'Acknowledge', 'Assess & Assign',
    'Investigate', 'Respond', 'Follow-Up & Close'
  )),
  status text not null default 'Open' check (status in ('Open', 'Resolved', 'Closed', 'Abandoned')),
  resolution_type text check (resolution_type is null or resolution_type in (
    'Rapid Response', 'First-Level Resolution', 'GRC Resolution', 'External Redress'
  )),
  resolution_notes text,
  resolved_date date,
  closure_type text check (closure_type is null or closure_type in (
    'Complainant Sign-Off', 'External Redress', 'Abandoned'
  )),
  closure_notes text,
  closed_date date,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists grievances_status_idx on public.grievances (status);
create index if not exists grievances_severity_idx on public.grievances (severity);
create index if not exists grievances_category_idx on public.grievances (category);
create index if not exists grievances_date_received_idx on public.grievances (date_received);

-- Audit trail: one row per action taken on a case (§7 document storage &
-- traceability — full record of actions taken and final resolutions).
create table if not exists public.grievance_events (
  id uuid primary key default gen_random_uuid(),
  grievance_id uuid not null references public.grievances (id) on delete cascade,
  type text not null check (type in (
    'registered', 'acknowledged', 'assigned', 'step-change', 'engagement',
    'reminder', 'escalation', 'response', 'resolution', 'closure', 'note'
  )),
  note text,
  actor text,
  created_at timestamptz not null default now()
);

create index if not exists grievance_events_grievance_id_idx
  on public.grievance_events (grievance_id);

-- Same posture as the other modules: internal tool, server talks to Supabase
-- with the publishable (anon) key. Tighten these when auth is added.
alter table public.grievances enable row level security;
alter table public.grievance_events enable row level security;

drop policy if exists "anon full access" on public.grievances;
create policy "anon full access" on public.grievances
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "anon full access" on public.grievance_events;
create policy "anon full access" on public.grievance_events
  for all to anon, authenticated using (true) with check (true);

-- Split-currency support for supply chain projects.
-- A project can be budgeted in Naira, Dollars, or both (e.g. a 60/40 split
-- contract carries an amount in each currency). Existing data is preserved:
-- budgeted_cost/final_cost become the ₦ amounts, usd_value becomes the $ budget.
-- Run ONCE in the Supabase SQL editor. Safe to re-run.

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'projects'
               and column_name = 'budgeted_cost') then
    alter table public.projects rename column budgeted_cost to budgeted_cost_ngn;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'projects'
               and column_name = 'final_cost') then
    alter table public.projects rename column final_cost to final_cost_ngn;
  end if;
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'projects'
               and column_name = 'usd_value') then
    alter table public.projects rename column usd_value to budgeted_cost_usd;
  end if;
end $$;

-- The single-currency generated column and the currency flag are superseded.
alter table public.projects drop column if exists cost_savings;
alter table public.projects drop column if exists currency;

alter table public.projects alter column budgeted_cost_ngn drop not null;

alter table public.projects add column if not exists final_cost_usd numeric
  check (final_cost_usd is null or final_cost_usd >= 0);

-- Savings per currency; each stays null until that currency has a final cost.
alter table public.projects add column if not exists cost_savings_ngn numeric
  generated always as (budgeted_cost_ngn - final_cost_ngn) stored;
alter table public.projects add column if not exists cost_savings_usd numeric
  generated always as (budgeted_cost_usd - final_cost_usd) stored;

-- Every project needs a budget in at least one currency.
alter table public.projects drop constraint if exists projects_budget_present;
alter table public.projects add constraint projects_budget_present
  check (budgeted_cost_ngn is not null or budgeted_cost_usd is not null);

create extension if not exists pgcrypto;

create table if not exists public.skin_id_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  store_name text not null,
  business_type text not null,
  platform text not null,
  catalog_size text not null,
  primary_goal text not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  lead_status text not null default 'qualified',
  timezone text,
  selected_start_time timestamptz,
  selected_end_time timestamptz,
  booking_status text not null default 'not_started',
  google_calendar_event_id text,
  google_meet_url text,
  source text not null default 'ask_nabi',
  constraint skin_id_leads_email_format check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint skin_id_leads_lead_status_check check (lead_status in ('qualified', 'booked', 'failed')),
  constraint skin_id_leads_booking_status_check check (booking_status in ('not_started', 'selecting', 'booking', 'booked', 'failed'))
);

alter table public.skin_id_leads enable row level security;

create index if not exists skin_id_leads_created_at_idx on public.skin_id_leads (created_at desc);
create index if not exists skin_id_leads_email_idx on public.skin_id_leads (lower(email));

create or replace function public.set_skin_id_leads_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_skin_id_leads_updated_at on public.skin_id_leads;
create trigger set_skin_id_leads_updated_at
before update on public.skin_id_leads
for each row
execute function public.set_skin_id_leads_updated_at();

-- No public insert/select/update policies are created intentionally.
-- Lead writes should go through the create-lead Edge Function with service-role credentials server-side only.

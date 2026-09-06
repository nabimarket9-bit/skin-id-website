create or replace view public.skin_id_leads_readable as
select
  id,
  created_at,
  updated_at,
  store_name,
  business_type,
  platform,
  catalog_size,
  primary_goal,
  first_name,
  last_name,
  email,
  lead_status,
  timezone,
  selected_start_time,
  selected_end_time,
  selected_start_time at time zone timezone as prospect_start_local,
  selected_end_time at time zone timezone as prospect_end_local,
  case
    when selected_start_time is null or selected_end_time is null or timezone is null then null
    else concat(
      to_char(selected_start_time at time zone timezone, 'Mon DD, YYYY FMHH12:MI AM'),
      ' - ',
      to_char(selected_end_time at time zone timezone, 'FMHH12:MI AM'),
      ' ',
      timezone
    )
  end as prospect_booking_display,
  booking_status,
  google_calendar_event_id,
  google_meet_url,
  source
from public.skin_id_leads;

revoke all on public.skin_id_leads_readable from anon;
revoke all on public.skin_id_leads_readable from authenticated;
grant select on public.skin_id_leads_readable to service_role;

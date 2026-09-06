alter table public.skin_id_leads
drop constraint if exists skin_id_leads_booking_status_check;

alter table public.skin_id_leads
add constraint skin_id_leads_booking_status_check
check (booking_status in ('not_started', 'selecting', 'booking', 'slot_selected', 'booked', 'failed'));

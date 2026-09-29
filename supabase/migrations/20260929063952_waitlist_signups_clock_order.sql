-- Place in line comes from signup time. now() is the transaction's start
-- time, so two signups in one transaction tied; use the wall clock.
alter table public.gecko_waitlist_signups alter column created_date set default clock_timestamp();

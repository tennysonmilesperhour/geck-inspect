-- NOT APPLIED YET. Apply only after the client with the waitlist-signup
-- edge function is live and that function is deployed (audit step 33).
--
-- Closes the old signup path. join_waitlist() lets anyone put any email
-- address on a list with no confirmation. The new page signs up through
-- the waitlist-signup edge function instead, which emails a confirmation
-- link. Until this runs, the old deployed page (and anyone calling the
-- function directly) can still skip confirmation.
--
-- Applying it before the new client ships would break signups on the
-- deployed page, which still calls join_waitlist().

revoke execute on function public.join_waitlist(text, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.join_waitlist(text, text, text, text, text, boolean) to service_role;

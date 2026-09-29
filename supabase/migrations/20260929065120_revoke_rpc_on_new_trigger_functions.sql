-- The trigger functions added on 29 Sep only run as triggers. Take away
-- the API execute permission the security advisor flags; triggers do not
-- check it when they fire.
revoke execute on function public.collection_activity_on_care() from public, anon, authenticated;
revoke execute on function public.collection_activity_on_gecko() from public, anon, authenticated;
revoke execute on function public.collection_activity_on_member() from public, anon, authenticated;
revoke execute on function public.guard_collection_member_update() from public, anon, authenticated;
revoke execute on function public.guard_waitlist_signup() from public, anon, authenticated;

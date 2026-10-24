-- A member who signs in with Facebook using only a phone number has no
-- email, so handle_new_auth_user skips their profile at signup. The app
-- then asks for an email; when they confirm it, auth.users.email goes
-- from empty to set. This runs the same function at that moment, so the
-- profile is created then. Additive: the old app version never hits it.
drop trigger if exists on_auth_user_email_added on auth.users;
create trigger on_auth_user_email_added
  after update of email on auth.users
  for each row
  when (coalesce(old.email, '') = '' and coalesce(new.email, '') <> '')
  execute function public.handle_new_auth_user();

-- Plan steps 20 (Forum), 21 (notifications) and 16 (Support), 3 Oct 2026.
-- Applied to production in six parts because the migration tool stalls on
-- long scripts; read them in version order.
--
-- Part 6 of 6: email unsubscribe. A Vault secret signs a per-member token
-- (profile id plus an HMAC). send-email asks for the token (service role
-- only) and puts it in the unsubscribe link and the List-Unsubscribe
-- header. unsubscribe_email_by_token() checks the signature and turns
-- email notifications off. It works signed out, because the signature is
-- the proof. The secret value is generated in the database and never
-- leaves it.

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'email_unsubscribe_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'email_unsubscribe_secret',
      'Signs the unsubscribe links in notification emails'
    );
  end if;
end;
$$;

create or replace function public.email_unsubscribe_token(p_profile_id text)
returns text
language plpgsql
stable
security definer
set search_path to 'public', 'extensions', 'vault'
as $$
declare
  v_secret text;
begin
  if p_profile_id is null or p_profile_id !~ '^[A-Za-z0-9_-]{1,64}$' then
    return null;
  end if;
  select decrypted_secret into v_secret
    from vault.decrypted_secrets
   where name = 'email_unsubscribe_secret'
   limit 1;
  if v_secret is null then
    return null;
  end if;
  return p_profile_id || '.' ||
    encode(extensions.hmac(p_profile_id, v_secret, 'sha256'), 'hex');
end;
$$;

revoke all on function public.email_unsubscribe_token(text) from public, anon, authenticated;
grant execute on function public.email_unsubscribe_token(text) to service_role;

create or replace function public.unsubscribe_email_by_token(p_token text)
returns boolean
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $$
declare
  v_id text;
  v_expected text;
begin
  if p_token is null or length(p_token) > 200 or position('.' in p_token) = 0 then
    return false;
  end if;
  v_id := split_part(p_token, '.', 1);
  v_expected := public.email_unsubscribe_token(v_id);
  if v_expected is null or v_expected <> p_token then
    return false;
  end if;
  update public.profiles
     set email_notifications_enabled = false
   where id = v_id;
  return found;
end;
$$;

revoke all on function public.unsubscribe_email_by_token(text) from public;
grant execute on function public.unsubscribe_email_by_token(text) to anon, authenticated, service_role;

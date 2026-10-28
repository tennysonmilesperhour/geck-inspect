-- Soft bounces that keep happening put an address on the do-not-email list.
--
-- record_email_event never suppresses a Transient or Undetermined bounce,
-- which is right for one full mailbox or one slow server. But an inbox that
-- soft bounces every week was mailed forever: on 26 Oct 2026 the Morph ID
-- evaluation account (no mailbox) retried for hours and bounced, as one
-- member's note did. This adds a rule: when an address has soft bounced on 3
-- different emails within 30 days, it goes on email_suppressions with the
-- new reason 'soft_bounced'. A hard bounce or a spam report later replaces
-- the softer reason, never the other way round.
--
-- Only addresses the delivery log keeps can be counted (members with a
-- login; the log keeps no visitor addresses), so a visitor's address is not
-- suppressed by this rule. Nothing in production matched it on 28 Oct.
--
-- The full body of record_email_event from 20261015151200 (the only
-- definition; production matched it by checksum on 28 Oct) with the marked
-- changes. Safe to run more than once.

alter table public.email_suppressions drop constraint if exists email_suppressions_reason_check;
alter table public.email_suppressions
  add constraint email_suppressions_reason_check check (reason in ('bounced', 'complained', 'soft_bounced'));

create or replace function public.record_email_event(
  p_event text,
  p_event_key text,
  p_resend_email_id text default null,
  p_email text default null,
  p_email_type text default null,
  p_occurred_at timestamptz default null,
  p_detail jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_email text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_type text := nullif(trim(coalesce(p_email_type, '')), '');
  v_detail jsonb := case when jsonb_typeof(p_detail) = 'object' then p_detail else '{}'::jsonb end;
  v_known_type text;
  v_known_email text;
  v_new boolean;
  v_reason text;
begin
  if p_event is null or p_event not in (
       'sent', 'delivered', 'delivery_delayed', 'opened', 'clicked', 'bounced', 'complained')
     or nullif(trim(coalesce(p_event_key, '')), '') is null then
    return false;
  end if;

  -- Webhooks for mail sent before tags existed carry no type; borrow it
  -- (and the address) from the 'sent' row of the same email.
  if p_resend_email_id is not null and (v_type is null or v_email is null) then
    select d.email_type, d.email
      into v_known_type, v_known_email
      from public.email_deliveries d
     where d.resend_email_id = p_resend_email_id
       and (d.email_type is not null or d.email is not null)
     order by d.occurred_at
     limit 1;
    v_type := coalesce(v_type, v_known_type);
    v_email := coalesce(v_email, v_known_email);
  end if;

  -- The log keeps an address only while it belongs to an account. Resend
  -- can report an open, a click or a bounce days after the email went
  -- out; for an account deleted since (admin_erase_account clears the
  -- address from this table) the late event must not write it back. A
  -- bounce or a complaint still puts the address on the suppression list
  -- below, so it is never mailed again.
  insert into public.email_deliveries
    (event_key, resend_email_id, email, email_type, event, occurred_at, detail)
  values
    (left(p_event_key, 200), left(p_resend_email_id, 200),
     case when v_email is not null and public.email_has_login(v_email) then left(v_email, 320) end,
     left(v_type, 64), p_event, coalesce(p_occurred_at, now()), v_detail)
  on conflict (event_key) do nothing;
  v_new := found;

  if v_new and v_email is not null and (
       p_event = 'complained'
       or (p_event = 'bounced'
           and coalesce(v_detail->>'bounce_type', '') !~* '^(transient|undetermined)$')
     ) then
    v_reason := p_event;
  -- New in 20261028025800: an address that soft bounced on 3 different
  -- emails within 30 days is treated as dead too. One full mailbox or one
  -- slow server never stops mail; the same inbox failing week after week
  -- does. Only addresses the log keeps (accounts) can be counted.
  elsif v_new and v_email is not null and p_event = 'bounced'
        and (select count(distinct d.resend_email_id)
               from public.email_deliveries d
              where d.email = v_email
                and d.event = 'bounced'
                and d.resend_email_id is not null
                and coalesce(d.detail->>'bounce_type', '') ~* '^(transient|undetermined)$'
                and d.occurred_at > now() - interval '30 days') >= 3 then
    v_reason := 'soft_bounced';
  end if;

  if v_reason is not null then
    insert into public.email_suppressions (email, reason, resend_email_id, detail)
    values (v_email, v_reason, p_resend_email_id, v_detail)
    on conflict (email) do update
      -- The strongest reason stays: complained, then bounced, then
      -- soft_bounced (changed in 20261028025800; before, a hard bounce
      -- could not replace a softer reason).
      set reason = case
                     when 'complained' in (excluded.reason, email_suppressions.reason) then 'complained'
                     when 'bounced' in (excluded.reason, email_suppressions.reason) then 'bounced'
                     else 'soft_bounced'
                   end,
          resend_email_id = excluded.resend_email_id,
          detail = excluded.detail,
          updated_date = now();
  end if;

  return v_new;
end;
$function$;

revoke all on function public.record_email_event(text, text, text, text, text, timestamptz, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_email_event(text, text, text, text, text, timestamptz, jsonb)
  to service_role;

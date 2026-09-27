-- Free accounts had 0 Morph ID credits, so the flagship feature ended in an
-- upgrade card for every free user: 18 signed-in users opened Morph ID in the
-- 90 days to 27 Sep 2026 and only 6 identifications had ever run. Decision
-- (27 Sep 2026): each free account gets one identification, ever, so every
-- keeper can try it once. Paid tiers are unchanged.
--
-- "Ever" is measured on the morph_id_usage ledger across all months. A failed
-- call is refunded by refund_morph_id_credit, which lowers the same ledger,
-- so a failure gives the free try back. Concurrent calls are safe: the
-- second one lands on the same (user_id, month_key) row, goes over the
-- included count, and is rejected.

create or replace function public.consume_morph_id_credit(p_user_id uuid, p_tier text, p_credits_included integer)
 returns morph_id_usage
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  rec public.morph_id_usage%rowtype;
  mk text := public.month_key_now();
  v_free boolean := coalesce(p_tier, 'free') = 'free';
  v_included integer := case when coalesce(p_tier, 'free') = 'free' then 0 else p_credits_included end;
  v_lifetime integer;
begin
  if v_free then
    select coalesce(sum(u.credits_consumed), 0)
      into v_lifetime
      from public.morph_id_usage u
     where u.user_id = p_user_id;
    if v_lifetime = 0 then
      v_included := 1;
    end if;
  end if;

  if v_included <= 0 then
    raise exception 'morph_id_credits_exhausted'
      using errcode = 'P0001';
  end if;

  insert into public.morph_id_usage (
    user_id, month_key, tier_at_start, credits_included, credits_consumed
  )
  values (p_user_id, mk, p_tier, v_included, 1)
  on conflict (user_id, month_key) do update
    set tier_at_start = excluded.tier_at_start,
        credits_included = greatest(public.morph_id_usage.credits_included, excluded.credits_included),
        credits_consumed = public.morph_id_usage.credits_consumed + 1,
        updated_date = now()
    returning * into rec;

  if rec.credits_consumed > rec.credits_included then
    update public.morph_id_usage
      set credits_consumed = rec.credits_included,
          updated_date = now()
      where id = rec.id;
    raise exception 'morph_id_credits_exhausted'
      using errcode = 'P0001';
  end if;

  return rec;
end;
$function$;

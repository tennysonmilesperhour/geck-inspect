-- Free tier gets no AI Morph ID credits (product decision, 4 Sep 2026).
--
-- The edge function recognize-gecko-morph passes the caller's tier and the
-- tier's allotment into consume_morph_id_credit(). Enforcing the zero here
-- means the rule holds even while the deployed function still carries the
-- old allotment of 1 for free accounts. The client shows an upgrade card
-- before any upload (Recognition.jsx) so free members rarely reach this.
create or replace function public.consume_morph_id_credit(p_user_id uuid, p_tier text, p_credits_included integer)
returns public.morph_id_usage
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  rec public.morph_id_usage%rowtype;
  mk text := public.month_key_now();
  v_included integer := case when coalesce(p_tier, 'free') = 'free' then 0 else p_credits_included end;
begin
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
$$;

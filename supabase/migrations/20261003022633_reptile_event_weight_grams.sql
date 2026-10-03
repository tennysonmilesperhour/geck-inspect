-- Other Reptiles weigh-ins store the weight as a number (audit step 31).
-- Additive: older clients keep writing "Weight: 45g" in notes only.
alter table public.reptile_events add column if not exists weight_grams numeric;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reptile_events_weight_grams_range' and conrelid = 'public.reptile_events'::regclass) then
    alter table public.reptile_events add constraint reptile_events_weight_grams_range check (weight_grams is null or (weight_grams > 0 and weight_grams < 1000000)) not valid;
  end if;
end $$;
comment on column public.reptile_events.weight_grams is 'The animal''s weight for a weigh-in event, in grams. Older weigh-ins only have "Weight: 45g" in notes.';

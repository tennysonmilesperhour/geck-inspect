-- The morph-id-eval GitHub Actions workflow (scripts/morph-id-eval/run-ci.mjs)
-- records each run's headline numbers next to the May runs. It calls this
-- with the service role, so it does not depend on the geck_data schema being
-- exposed through the API. Nobody else can call it.

create or replace function public.record_morph_eval_run(p_run jsonb)
returns bigint
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id bigint;
begin
  insert into geck_data.morph_eval_runs (
    started_at, finished_at, status, model, taxonomy_version, split,
    eval_set_size, primary_morph_top1_accuracy, primary_morph_top3_accuracy,
    per_trait_metrics, top_confusions, notes, triggered_by
  ) values (
    coalesce((p_run->>'started_at')::timestamptz, now()),
    coalesce((p_run->>'finished_at')::timestamptz, now()),
    'success',
    p_run->>'model',
    p_run->>'taxonomy_version',
    coalesce(p_run->>'split', 'test'),
    coalesce((p_run->>'eval_set_size')::integer, 0),
    (p_run->>'primary_morph_top1_accuracy')::numeric,
    (p_run->>'primary_morph_top3_accuracy')::numeric,
    coalesce(p_run->'per_trait_metrics', '{}'::jsonb),
    coalesce(p_run->'top_confusions', '[]'::jsonb),
    p_run->>'notes',
    coalesce(p_run->>'triggered_by', 'ci')
  )
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.record_morph_eval_run(jsonb) from public, anon, authenticated;
grant execute on function public.record_morph_eval_run(jsonb) to service_role;

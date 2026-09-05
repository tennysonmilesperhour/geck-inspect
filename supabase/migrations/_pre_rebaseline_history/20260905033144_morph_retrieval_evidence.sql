-- Raw-data Morph ID retrieval foundations.
--
-- Seller/listing labels remain weak evidence. The RPC returns provenance
-- weights and source-cluster ids so the edge function can balance retrieval
-- rather than treating every auto-approved row as independent ground truth.

alter table public.gecko_images
  add column if not exists embedding_status text not null default 'pending',
  add column if not exists embedding_attempts integer not null default 0,
  add column if not exists embedding_error text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'gecko_images_embedding_status_check'
      and conrelid = 'public.gecko_images'::regclass
  ) then
    alter table public.gecko_images
      add constraint gecko_images_embedding_status_check
      check (embedding_status in ('pending', 'processing', 'ready', 'failed'));
  end if;
end $$;

update public.gecko_images
set embedding_status = 'ready', embedding_error = null
where image_embedding is not null
  and embedding_status <> 'ready';

create index if not exists gecko_images_embedding_backfill_idx
  on public.gecko_images (embedding_status, embedding_attempts, created_date)
  where image_embedding is null;

create or replace function public.morph_visual_neighbors(
  query_embedding extensions.vector(768),
  match_count integer default 32
) returns table (
  id text,
  image_url text,
  primary_morph text,
  genetic_traits jsonb,
  secondary_traits jsonb,
  base_color text,
  similarity double precision,
  label_weight double precision,
  label_source text,
  source_cluster text
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    g.id,
    g.image_url,
    g.primary_morph,
    coalesce(g.training_meta->'genetic_traits', '[]'::jsonb),
    coalesce(g.secondary_traits, '[]'::jsonb),
    g.base_color,
    1 - (g.image_embedding operator(extensions.<=>) query_embedding) as similarity,
    case
      when g.training_meta->>'verification_tier' = 'hero_anchor' then 1.0
      when g.training_meta->>'provenance' in ('expert_owner', 'expert_reviewed') then 0.95
      when g.training_meta->>'provenance' = 'ai_then_expert' then 0.85
      when g.training_meta->>'provenance' = 'community' then 0.60
      when g.training_meta->>'verification_tier' = 'auto_bulk_approved' then 0.40
      else 0.50
    end::double precision as label_weight,
    coalesce(
      nullif(g.training_meta->>'verification_tier', ''),
      nullif(g.training_meta->>'provenance', ''),
      'unclassified'
    ) as label_source,
    coalesce(
      nullif(g.training_meta->>'listing_id', ''),
      nullif(g.training_meta->>'gecko_id', ''),
      g.id
    ) as source_cluster
  from public.gecko_images as g
  where g.image_embedding is not null
    and g.embedding_status = 'ready'
    and g.verified is true
    and g.primary_morph is not null
    and g.image_url is not null
  order by g.image_embedding operator(extensions.<=>) query_embedding
  limit greatest(1, least(match_count, 96));
$$;

revoke all on function public.morph_visual_neighbors(extensions.vector, integer)
  from public, anon, authenticated;
grant execute on function public.morph_visual_neighbors(extensions.vector, integer)
  to service_role;

comment on function public.morph_visual_neighbors(extensions.vector, integer) is
  'Service-only Morph ID retrieval. Returns weak-label provenance weights and source clusters for evidence balancing.';

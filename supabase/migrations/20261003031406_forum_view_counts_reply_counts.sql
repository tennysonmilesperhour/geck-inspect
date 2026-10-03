-- Plan steps 20 (Forum), 21 (notifications) and 16 (Support), 3 Oct 2026.
-- Applied to production in six parts because the migration tool stalls on
-- long scripts; read them in version order.
--
-- Part 4 of 6: real view counts and reply counts.
--   * One view per signed-in member per post, counted by
--     record_forum_post_view(), which is the only thing that can raise
--     view_count (the guard in part 2 stops anyone typing one in).
--   * forum_reply_counts() gives the comment count per post for the forum
--     index, so it does not have to load every comment.

create table if not exists public.forum_post_views (
  post_id text not null references public.forum_posts(id) on delete cascade,
  viewer_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (post_id, viewer_id)
);

alter table public.forum_post_views enable row level security;
revoke all on public.forum_post_views from anon, authenticated;

create or replace function public.record_forum_post_view(p_post_id text)
returns numeric
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_count numeric;
begin
  if v_uid is null or p_post_id is null then
    return null;
  end if;
  insert into public.forum_post_views (post_id, viewer_id)
  select fp.id, v_uid from public.forum_posts fp where fp.id = p_post_id
  on conflict do nothing;
  if found then
    update public.forum_posts
       set view_count = coalesce(view_count, 0) + 1
     where id = p_post_id
    returning view_count into v_count;
  else
    select view_count into v_count from public.forum_posts where id = p_post_id;
  end if;
  return v_count;
end;
$$;

revoke all on function public.record_forum_post_view(text) from public, anon;
grant execute on function public.record_forum_post_view(text) to authenticated, service_role;

create or replace function public.forum_reply_counts(p_post_ids text[] default null)
returns table (post_id text, reply_count bigint)
language sql
stable
set search_path to 'public'
as $$
  select fc.post_id, count(*)::bigint
  from public.forum_comments fc
  where p_post_ids is null or fc.post_id = any (p_post_ids)
  group by fc.post_id;
$$;

grant execute on function public.forum_reply_counts(text[]) to anon, authenticated, service_role;

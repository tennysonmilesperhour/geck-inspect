-- New public forum content and gallery photos require review. Existing content
-- keeps its current visibility. The old clients still receive their own rows.
begin;
do $$ declare t text; begin
  foreach t in array array['forum_posts','forum_comments','gecko_images'] loop
    execute format('alter table public.%I add column if not exists approval_status text not null default ''approved'' check (approval_status in (''pending'',''approved'',''rejected''))', t);
    execute format('alter table public.%I add column if not exists approval_revision bigint not null default 0', t);
  end loop;
end $$;

create or replace function public.guard_public_content_approval() returns trigger
language plpgsql set search_path = '' as $$
declare changed boolean;
  ignored text[] := array['moderation_hidden','approval_status','approval_revision','updated_date',
    'view_count','is_pinned','is_locked','image_embedding','embedding_model','embedding_date',
    'embedding_status','embedding_attempts','embedding_error'];
begin
  if tg_op = 'INSERT' then
    new.approval_status := 'pending';
    new.approval_revision := 1;
  else
    changed := (to_jsonb(new) - ignored) is distinct from (to_jsonb(old) - ignored);
    if current_user in ('authenticated','anon') and not coalesce(public.is_admin(), false) then
      new.approval_status := old.approval_status;
      new.approval_revision := old.approval_revision;
    end if;
    if changed then
      new.approval_status := 'pending';
      new.approval_revision := old.approval_revision + 1;
    end if;
  end if;
  -- Runs after the existing hidden-column guard; even the old Unhide action
  -- cannot publish an item that has not been approved.
  if new.approval_status <> 'approved' then new.moderation_hidden := true; end if;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['forum_posts','forum_comments','gecko_images'] loop
    execute format('create or replace trigger zz_public_content_approval before insert or update on public.%I for each row execute function public.guard_public_content_approval()', t);
  end loop;
end $$;

create or replace function public.admin_public_content_queue(p_status text default 'pending')
returns table(target_type text, target_id text, revision bigint, content jsonb)
language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(public.is_admin(), false) then raise exception 'Admin required' using errcode = '42501'; end if;
  return query
    select 'forum_post'::text, p.id, p.approval_revision, to_jsonb(p) from public.forum_posts p where p.approval_status = p_status
    union all select 'forum_comment', c.id, c.approval_revision, to_jsonb(c) from public.forum_comments c where c.approval_status = p_status
    union all select 'gecko_image', g.id, g.approval_revision, to_jsonb(g) - array['image_embedding','perceptual_hash'] from public.gecko_images g where g.approval_status = p_status;
end $$;

create or replace function public.review_public_content(p_target_type text, p_target_id text, p_revision bigint, p_approve boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare tbl text; affected integer;
begin
  if not coalesce(public.is_admin(), false) then raise exception 'Admin required' using errcode = '42501'; end if;
  tbl := case p_target_type when 'forum_post' then 'forum_posts' when 'forum_comment' then 'forum_comments' when 'gecko_image' then 'gecko_images' end;
  if tbl is null then raise exception 'Unknown content type'; end if;
  execute format('update public.%I set approval_status = $1, moderation_hidden = $2 where id = $3 and approval_revision = $4 and approval_status in (''pending'',''rejected'')', tbl)
    using case when p_approve then 'approved' else 'rejected' end, not p_approve, p_target_id, p_revision;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'This item changed. Refresh and review the latest version.'; end if;
end $$;
revoke all on function public.admin_public_content_queue(text) from public, anon;
revoke all on function public.review_public_content(text,text,bigint,boolean) from public, anon;
grant execute on function public.admin_public_content_queue(text) to authenticated;
grant execute on function public.review_public_content(text,text,bigint,boolean) to authenticated;
commit;

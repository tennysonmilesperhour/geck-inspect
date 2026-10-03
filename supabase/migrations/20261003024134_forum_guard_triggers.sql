-- Plan steps 20 (Forum), 21 (notifications) and 16 (Support), 3 Oct 2026.
-- Applied to production in six parts because the migration tool stalls on
-- long scripts; read them in version order.
--
-- Part 2 of 6: the forum guard functions. Part 3 attaches them.
--   * A member can edit their own post, but only an admin can pin or lock
--     it, and nobody can type in a view count. The guard quietly keeps the
--     old value of those fields for non-admins.
--   * A locked thread takes no new comments, except from an admin.
--   * A comment cannot be moved to another thread or parent on edit.
-- Security-definer functions (record_forum_post_view) and the service role
-- run as another database user and pass straight through.

create or replace function public.guard_forum_post_update()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  -- Security-definer functions (record_forum_post_view) and the service
  -- role run as a different database user and pass straight through.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if public.forum_is_admin() then
    return new;
  end if;
  new.is_pinned := old.is_pinned;
  new.is_locked := old.is_locked;
  new.view_count := old.view_count;
  new.created_by := old.created_by;
  return new;
end;
$$;

create or replace function public.guard_forum_comment_write()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  v_locked boolean;
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'UPDATE' then
    new.post_id := old.post_id;
    new.parent_comment_id := old.parent_comment_id;
    new.created_by := old.created_by;
    return new;
  end if;
  select fp.is_locked into v_locked from public.forum_posts fp where fp.id = new.post_id;
  if coalesce(v_locked, false) and not public.forum_is_admin() then
    raise exception 'This thread is locked, so it takes no new comments.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

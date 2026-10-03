-- Plan steps 20 (Forum), 21 (notifications) and 16 (Support), 3 Oct 2026.
-- Applied to production in six parts because the migration tool stalls on
-- long scripts; read them in version order.
--
-- Part 5 of 6: support_replies records what an admin wrote back on a
-- ticket. The member who filed the ticket can read the replies; only admins
-- can write or delete them. There is no email address in the table, only
-- the admin's auth id.

create table if not exists public.support_replies (
  id uuid primary key default gen_random_uuid(),
  message_id text not null references public.support_messages(id) on delete cascade,
  body text not null check (length(btrim(body)) between 1 and 5000),
  author_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);

create index if not exists support_replies_message_id_idx
  on public.support_replies (message_id, created_at);

alter table public.support_replies enable row level security;

do $p$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public'
                   and tablename = 'support_replies' and policyname = 'support_replies_read_own_or_admin') then
    create policy support_replies_read_own_or_admin on public.support_replies
      for select to authenticated
      using (
        public.forum_is_admin()
        or exists (
          select 1 from public.support_messages sm
          where sm.id = support_replies.message_id
            and ((select auth.email()) = sm.user_email or (select auth.email()) = sm.created_by)
        )
      );
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public'
                   and tablename = 'support_replies' and policyname = 'support_replies_insert_admin') then
    create policy support_replies_insert_admin on public.support_replies
      for insert to authenticated
      with check (public.forum_is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public'
                   and tablename = 'support_replies' and policyname = 'support_replies_delete_admin') then
    create policy support_replies_delete_admin on public.support_replies
      for delete to authenticated
      using (public.forum_is_admin());
  end if;
end $p$;

revoke all on public.support_replies from anon;
grant select, insert, delete on public.support_replies to authenticated;

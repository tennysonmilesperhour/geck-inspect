-- AI Consultant (feature-completeness audit, step 25).
--
-- Additive only.
--
-- 1. refund_feature_credit: gives back one monthly credit when the AI call
--    behind it failed. Only the service role (the invoke-llm edge
--    function) may run it; a member calling it directly could otherwise
--    refund credits they really used.
-- 2. consultant_conversations: saved GeckoGenius chats, one row per
--    conversation, readable and writable only by the member who owns it.

create or replace function public.refund_feature_credit(p_user_id uuid, p_feature text)
returns public.feature_usage
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.feature_usage;
begin
  update public.feature_usage
     set credits_consumed = greatest(credits_consumed - 1, 0),
         updated_date = now()
   where user_id = p_user_id
     and feature = p_feature
     and month_key = to_char(now() at time zone 'utc', 'YYYY-MM')
     and credits_consumed > 0
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function public.refund_feature_credit(uuid, text) from public, anon, authenticated;
grant execute on function public.refund_feature_credit(uuid, text) to service_role;

create table if not exists public.consultant_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  messages jsonb not null default '[]'::jsonb,
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  constraint consultant_conversations_title_len check (char_length(title) <= 200),
  constraint consultant_conversations_messages_array check (jsonb_typeof(messages) = 'array')
);

create index if not exists consultant_conversations_user_updated_idx
  on public.consultant_conversations (user_id, updated_date desc);

alter table public.consultant_conversations enable row level security;

-- Policies are created only when missing, so re-running is safe.
do $policies$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'consultant_conversations' and policyname = 'Members read their own consultant chats') then
    create policy "Members read their own consultant chats"
      on public.consultant_conversations for select
      to authenticated
      using (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'consultant_conversations' and policyname = 'Members add their own consultant chats') then
    create policy "Members add their own consultant chats"
      on public.consultant_conversations for insert
      to authenticated
      with check (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'consultant_conversations' and policyname = 'Members update their own consultant chats') then
    create policy "Members update their own consultant chats"
      on public.consultant_conversations for update
      to authenticated
      using (user_id = (select auth.uid()))
      with check (user_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'consultant_conversations' and policyname = 'Members delete their own consultant chats') then
    create policy "Members delete their own consultant chats"
      on public.consultant_conversations for delete
      to authenticated
      using (user_id = (select auth.uid()));
  end if;
end
$policies$;

grant select, insert, update, delete on public.consultant_conversations to authenticated;

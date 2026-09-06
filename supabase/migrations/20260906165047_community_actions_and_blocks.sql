-- One authenticated vote per target, changed atomically by the server.
create unique index if not exists question_votes_question_user on public.question_votes(question_id,user_id) where question_id is not null;
create unique index if not exists question_votes_answer_user on public.question_votes(answer_id,user_id) where answer_id is not null;
revoke insert, update, delete on public.question_votes from anon, authenticated;
create or replace function public.vote_question_answer(p_target uuid, p_kind text)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if auth.uid() is null then raise exception 'Sign in to vote'; end if;
  if p_kind not in ('question','answer') then raise exception 'Invalid vote target'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_target::text, 0));
  if p_kind = 'question' then
    if not exists(select 1 from public.questions where id=p_target) then raise exception 'Question not found'; end if;
    delete from public.question_votes where question_id=p_target and user_id=auth.uid();
    if not found then insert into public.question_votes(question_id,user_id,created_by) values(p_target,auth.uid(),auth.email()); end if;
    select count(*) into v_count from public.question_votes where question_id=p_target;
    update public.questions set upvote_count=v_count where id=p_target;
  else
    if not exists(select 1 from public.answers where id=p_target) then raise exception 'Answer not found'; end if;
    delete from public.question_votes where answer_id=p_target and user_id=auth.uid();
    if not found then insert into public.question_votes(answer_id,user_id,created_by) values(p_target,auth.uid(),auth.email()); end if;
    select count(*) into v_count from public.question_votes where answer_id=p_target;
    update public.answers set upvote_count=v_count where id=p_target;
  end if;
  return v_count;
end $$;
revoke all on function public.vote_question_answer(uuid,text) from public, anon;
grant execute on function public.vote_question_answer(uuid,text) to authenticated;

create or replace function public.accept_question_answer(p_question uuid,p_answer uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.questions where id=p_question and created_by=auth.email() for update;
  if not found or auth.uid() is null then raise exception 'Only the question author may accept an answer'; end if;
  if not exists(select 1 from public.answers where id=p_answer and question_id=p_question) then raise exception 'Answer does not belong to this question'; end if;
  update public.answers set is_best_answer=(id=p_answer) where question_id=p_question;
  update public.questions set best_answer_id=p_answer,status='answered',updated_date=now() where id=p_question;
end $$;
revoke all on function public.accept_question_answer(uuid,uuid) from public,anon;
grant execute on function public.accept_question_answer(uuid,uuid) to authenticated;

-- Clients may edit content, but cannot set server-managed vote/acceptance fields.
create or replace function public.guard_qa_counters() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon','authenticated') then
    if tg_op='INSERT' then
      new.upvote_count := 0;
      if tg_table_name='answers' then new.is_best_answer := false;
      else new.view_count := 0; new.best_answer_id := null; end if;
    elsif new.upvote_count is distinct from old.upvote_count then raise exception 'Use the voting action';
    elsif tg_table_name='answers' then
      if new.is_best_answer is distinct from old.is_best_answer then raise exception 'Use the accept answer action'; end if;
    else
      if new.best_answer_id is distinct from old.best_answer_id then raise exception 'Use the accept answer action'; end if;
    end if;
  end if;
  return new;
end $$;
create trigger questions_guard_counters before insert or update on public.questions for each row execute function public.guard_qa_counters();
create trigger answers_guard_counters before insert or update on public.answers for each row execute function public.guard_qa_counters();

create table public.user_blocks (
  blocker_email text not null default auth.email(),
  blocked_email text not null,
  created_at timestamptz not null default now(),
  primary key(blocker_email,blocked_email),
  check(blocker_email <> blocked_email)
);
alter table public.user_blocks enable row level security;
grant select,insert,delete on public.user_blocks to authenticated;
create policy blocks_read_own on public.user_blocks for select to authenticated using(blocker_email=(select auth.email()));
create policy blocks_insert_own on public.user_blocks for insert to authenticated with check(blocker_email=(select auth.email()));
create policy blocks_delete_own on public.user_blocks for delete to authenticated using(blocker_email=(select auth.email()));
create or replace function public.prevent_blocked_message() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.user_blocks where
    (blocker_email=new.sender_email and blocked_email=new.recipient_email) or
    (blocker_email=new.recipient_email and blocked_email=new.sender_email)) then
    raise exception 'This conversation is unavailable';
  end if;
  return new;
end $$;
create trigger direct_messages_enforce_blocks before insert on public.direct_messages for each row execute function public.prevent_blocked_message();

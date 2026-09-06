-- Run in the SQL editor or CLI. All test records are rolled back.
begin;
select set_config('request.jwt.claims', (select jsonb_build_object('sub',u.id,'email',u.email,'role','authenticated')::text from auth.users u join public.profiles p on p.email=u.email where p.role='user' limit 1), true);
set local role authenticated;
do $test$
declare req uuid := gen_random_uuid(); g public.geckos; n integer; q uuid; a uuid; v integer;
begin
  g := public.save_gecko_record('{"name":"Audit rollback fixture","weight_grams":12}'::jsonb,req,null,true,current_date);
  if g.is_public is distinct from false then raise exception 'Private default failed'; end if;
  g := public.save_gecko_record('{"name":"Audit rollback fixture","weight_grams":12}'::jsonb,req,null,true,current_date);
  select count(*) into n from public.weight_records where gecko_id=req::text;
  if n<>1 then raise exception 'Duplicate weight'; end if;
  g := public.save_gecko_record('{"name":"Renamed fixture","weight_grams":12}'::jsonb,gen_random_uuid(),req::text,false,current_date);
  select count(*) into n from public.weight_records where gecko_id=req::text;
  if n<>1 then raise exception 'Phantom weight'; end if;
  begin
    perform public.save_gecko_record('{"name":"Invalid fixture","weight_grams":-1}'::jsonb,gen_random_uuid(),req::text,true,current_date);
    raise exception 'Invalid weight accepted';
  exception when others then if sqlerrm='Invalid weight accepted' then raise; end if; end;
  if (select name from public.geckos where id=req::text)<>'Renamed fixture' then raise exception 'Atomicity failed'; end if;
  insert into public.questions(title,created_by,author_id) values('Rollback test',auth.email(),auth.uid()) returning id into q;
  insert into public.answers(question_id,body,created_by,author_id) values(q,'Rollback answer',auth.email(),auth.uid()) returning id into a;
  v:=public.vote_question_answer(q,'question'); if v<>1 then raise exception 'Question vote failed'; end if;
  v:=public.vote_question_answer(q,'question'); if v<>0 then raise exception 'Vote toggle failed'; end if;
  v:=public.vote_question_answer(a,'answer'); if v<>1 then raise exception 'Answer vote failed'; end if;
  perform public.accept_question_answer(q,a);
  if not (select is_best_answer from public.answers where id=a) then raise exception 'Acceptance failed'; end if;
  begin
    update public.answers set upvote_count=99 where id=a;
    raise exception 'Client changed votes';
  exception when others then if sqlerrm='Client changed votes' then raise; end if; end;
  insert into public.user_blocks(blocked_email) values('audit-block-fixture@example.invalid');
  begin
    insert into public.direct_messages(sender_email,recipient_email,content,created_by)
      values(auth.email(),'audit-block-fixture@example.invalid','Must not send',auth.email());
    raise exception 'Blocked message accepted';
  exception when others then if sqlerrm='Blocked message accepted' then raise; end if; end;
end $test$;
reset role;
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $test$ begin
  if exists(select 1 from public.geckos where is_public is distinct from true) then raise exception 'Private animal leaked'; end if;
  if exists(select 1 from public.read_profiles() where stripe_customer_id is not null or email is not null or location is not null or extra_data is not null) then raise exception 'Private directory fields leaked'; end if;
end $test$;
rollback;

begin;
\ir ../../scripts/sql-harness/impersonate.sql
select test_helpers.create_user('approval-owner@example.com');
select test_helpers.create_user('approval-viewer@example.com');
select test_helpers.create_user('approval-admin@example.com');
update public.profiles set role = 'admin' where email = 'approval-admin@example.com';
insert into public.forum_categories(id,name,description) values ('approval-category','Approval','Test');
select test_helpers.act_as('approval-owner@example.com');
insert into public.forum_posts(id,title,content,category_id,author_name,created_by,approval_status,moderation_hidden)
values ('approval-post','Review me','Original, see https://example.com','approval-category','Owner','approval-owner@example.com','approved',false);
insert into public.forum_comments(id,post_id,content,author_name,created_by,image_urls)
values ('approval-comment','approval-post','Comment','Owner','approval-owner@example.com','["https://example.com/c.jpg"]');
insert into public.gecko_images(id,image_url,created_by) values ('approval-image','https://example.com/gecko.jpg','approval-owner@example.com');
do $$ begin
  if (select approval_status <> 'pending' or not moderation_hidden or approval_revision <> 1 or approval_hold_reason <> 'Link from a new member' from public.forum_posts where id='approval-post') then raise exception 'FAIL: forged insert published'; end if;
  if (select approval_hold_reason is distinct from 'Photo from a new member' from public.forum_comments where id='approval-comment') then raise exception 'FAIL: comment photo not held'; end if;
  if (select approval_hold_reason is distinct from 'Photo from a new member' from public.gecko_images where id='approval-image') then raise exception 'FAIL: gallery photo not held'; end if;
  begin perform public.review_public_content('forum_post','approval-post',1,true); raise exception 'FAIL: member approved'; exception when insufficient_privilege then null; end;
  begin perform public.admin_public_content_queue(); raise exception 'FAIL: member read queue'; exception when insufficient_privilege then null; end;
end $$;
update public.forum_posts set approval_status='approved', approval_revision=999, moderation_hidden=false where id='approval-post';
select test_helpers.act_as('approval-viewer@example.com');
do $$ begin
  if exists(select 1 from public.forum_posts where id='approval-post') or exists(select 1 from public.forum_comments where id='approval-comment') or exists(select 1 from public.gecko_images where id='approval-image') then raise exception 'FAIL: pending content leaked to member'; end if;
end $$;
select test_helpers.act_as_anon();
do $$ begin
  if exists(select 1 from public.forum_posts where id='approval-post') or exists(select 1 from public.forum_comments where id='approval-comment') or exists(select 1 from public.gecko_images where id='approval-image') then raise exception 'FAIL: pending content leaked to anon'; end if;
end $$;
select test_helpers.act_as('approval-admin@example.com');
do $$ begin
  if (select count(*) from public.admin_public_content_queue()) <> 3 then raise exception 'FAIL: queue omitted content'; end if;
end $$;
select public.moderate_content('forum_post','approval-post','unhide');
do $$ begin
  if (select not moderation_hidden from public.forum_posts where id='approval-post') then raise exception 'FAIL: old unhide bypassed review'; end if;
end $$;
select public.review_public_content('forum_post','approval-post',1,true);
select public.review_public_content('forum_comment','approval-comment',1,true);
select public.review_public_content('gecko_image','approval-image',1,true);
select test_helpers.act_as('approval-viewer@example.com');
do $$ begin
  if not exists(select 1 from public.forum_posts where id='approval-post') or not exists(select 1 from public.forum_comments where id='approval-comment') or not exists(select 1 from public.gecko_images where id='approval-image') then raise exception 'FAIL: approved content invisible'; end if;
end $$;
-- The owner now has three approved items, so they are trusted.
select test_helpers.act_as('approval-owner@example.com');
update public.forum_posts set content='Edited, see https://example.com' where id='approval-post';
update public.forum_comments set image_urls='["https://example.com/changed.jpg"]' where id='approval-comment';
update public.gecko_images set image_url='https://example.com/changed.jpg' where id='approval-image';
do $$ begin
  if (select approval_status <> 'approved' or approval_revision <> 2 from public.forum_posts where id='approval-post') then raise exception 'FAIL: trusted edit not approved'; end if;
  if (select approval_status <> 'approved' from public.gecko_images where id='approval-image') then raise exception 'FAIL: trusted photo not approved'; end if;
end $$;
-- A held term stops even a trusted member.
update public.forum_posts set content='Message me on WhatsApp' where id='approval-post';
do $$ begin
  if (select approval_status <> 'pending' or not moderation_hidden or approval_revision <> 3 or approval_hold_reason <> 'Held term: Off-platform contact' from public.forum_posts where id='approval-post') then raise exception 'FAIL: held term published'; end if;
end $$;
update public.forum_posts set approval_status='approved', approval_hold_reason=null where id='approval-post';
do $$ begin
  if (select approval_status <> 'pending' or approval_hold_reason is null from public.forum_posts where id='approval-post') then raise exception 'FAIL: member cleared hold'; end if;
end $$;
select test_helpers.act_as('approval-admin@example.com');
do $$ begin
  if (select count(*) from public.admin_public_content_queue()) <> 1 then raise exception 'FAIL: held edit not queued'; end if;
  begin perform public.review_public_content('forum_post','approval-post',2,true); raise exception 'FAIL: stale review accepted'; exception when raise_exception then if sqlerrm like 'FAIL:%' then raise; end if; end;
end $$;
select public.review_public_content('forum_post','approval-post',3,false);
do $$ begin
  if (select approval_status <> 'rejected' or not moderation_hidden from public.forum_posts where id='approval-post') then raise exception 'FAIL: rejection published'; end if;
end $$;
-- After a rejection every new item from that member waits, and so does an edit of the rejected one.
select test_helpers.act_as('approval-owner@example.com');
insert into public.forum_comments(id,post_id,content,author_name,created_by)
values ('approval-comment-2','approval-post','Plain words','Owner','approval-owner@example.com');
update public.forum_posts set content='Third revision' where id='approval-post';
do $$ begin
  if (select approval_hold_reason is distinct from 'Author has rejected or hidden content' from public.forum_comments where id='approval-comment-2') then raise exception 'FAIL: rejected author not held'; end if;
  if (select approval_revision <> 4 or approval_status <> 'pending' or approval_hold_reason <> 'Edited after rejection' from public.forum_posts where id='approval-post') then raise exception 'FAIL: rejected edit not requeued'; end if;
end $$;
-- A new member's plain text goes live at once; links and photos wait.
select test_helpers.act_as('approval-viewer@example.com');
insert into public.forum_posts(id,title,content,category_id,author_name,created_by)
values ('viewer-plain','Hello','My Lilly White is shedding well','approval-category','Viewer','approval-viewer@example.com'),
       ('viewer-link','Shop','Visit geckodeals.shop today','approval-category','Viewer','approval-viewer@example.com');
insert into public.gecko_images(id,image_url,created_by) values ('viewer-image','https://example.com/v.jpg','approval-viewer@example.com');
select test_helpers.act_as_anon();
do $$ begin
  if not exists(select 1 from public.forum_posts where id='viewer-plain') then raise exception 'FAIL: plain text not published'; end if;
  if exists(select 1 from public.forum_posts where id='viewer-link') or exists(select 1 from public.gecko_images where id='viewer-image') then raise exception 'FAIL: new member link or photo published'; end if;
end $$;
-- A moderator's hide survives the author's edit.
select test_helpers.act_as('approval-admin@example.com');
select public.moderate_content('forum_post','viewer-plain','hide');
select test_helpers.act_as('approval-viewer@example.com');
update public.forum_posts set content='Edited plain words' where id='viewer-plain';
select test_helpers.act_as_anon();
do $$ begin
  if exists(select 1 from public.forum_posts where id='viewer-plain') then raise exception 'FAIL: edit undid moderator hide'; end if;
end $$;
rollback;

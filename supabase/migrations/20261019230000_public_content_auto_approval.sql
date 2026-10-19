-- Automatic approval for public forum content and gallery photos.
--
-- 20261018152154_public_content_approval.sql held every new post, comment
-- and gallery photo for an admin. This keeps that queue but lets the
-- database approve the safe majority on its own:
--
--   * Any text containing a held term (slurs, explicit words, scam and
--     off-platform payment phrases) waits for an admin, whoever wrote it.
--   * A member with rejected content, or approved content a moderator later
--     hid, waits for an admin every time.
--   * A trusted member (at least 2 approved, visible items across the
--     forum and Gallery) is approved at once.
--   * Anyone else is approved at once for plain text, and waits for an
--     admin when the item has a photo or a link.
--   * An edit of something already live follows the same rules. An edit of
--     something pending or rejected always goes back to the admin.
--
-- The reason an item was held is stored in approval_hold_reason so the
-- admin queue can show it. Held terms live in a table so they can be added
-- without a migration. Reports, blocking and moderator hide/remove are
-- unchanged and still work on approved content.
begin;

create table if not exists public.moderation_held_terms (
  term text primary key check (term = lower(term) and length(term) between 2 and 60),
  reason text not null
);
alter table public.moderation_held_terms enable row level security;
drop policy if exists moderation_held_terms_admin on public.moderation_held_terms;
create policy moderation_held_terms_admin on public.moderation_held_terms
  for all to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.moderation_held_terms from anon;

insert into public.moderation_held_terms (term, reason) values
  ('nigger', 'Slur'), ('nigga', 'Slur'), ('faggot', 'Slur'), ('fag', 'Slur'), ('retard', 'Slur'),
  ('retarded', 'Slur'), ('tranny', 'Slur'), ('kike', 'Slur'), ('spic', 'Slur'), ('chink', 'Slur'),
  ('wetback', 'Slur'), ('raghead', 'Slur'), ('dyke', 'Slur'),
  ('kill yourself', 'Self-harm or threat'), ('kys', 'Self-harm or threat'),
  ('i will kill you', 'Self-harm or threat'),
  ('porn', 'Explicit'), ('porno', 'Explicit'), ('nude', 'Explicit'), ('nudes', 'Explicit'),
  ('nsfw', 'Explicit'), ('onlyfans', 'Explicit'), ('xxx', 'Explicit'), ('pussy', 'Explicit'),
  ('cock', 'Explicit'), ('blowjob', 'Explicit'), ('cum', 'Explicit'), ('hentai', 'Explicit'),
  ('fuck', 'Profanity'), ('fucking', 'Profanity'), ('cunt', 'Profanity'), ('motherfucker', 'Profanity'),
  ('whatsapp', 'Off-platform contact'), ('telegram', 'Off-platform contact'),
  ('signal me', 'Off-platform contact'), ('text me at', 'Off-platform contact'),
  ('bitcoin', 'Scam or payment'), ('crypto', 'Scam or payment'), ('usdt', 'Scam or payment'),
  ('gift card', 'Scam or payment'), ('gift cards', 'Scam or payment'),
  ('western union', 'Scam or payment'), ('moneygram', 'Scam or payment'),
  ('friends and family', 'Scam or payment'), ('cash app', 'Scam or payment'),
  ('cashapp', 'Scam or payment'), ('wire transfer', 'Scam or payment'),
  ('free shipping worldwide', 'Scam or payment')
on conflict (term) do nothing;

do $$ declare t text; begin
  foreach t in array array['forum_posts','forum_comments','gecko_images'] loop
    execute format('alter table public.%I add column if not exists approval_hold_reason text', t);
  end loop;
end $$;

-- Returns why an item must wait for an admin, or null to approve it now.
-- Security definer so it can read the held terms and the author's history
-- whatever the caller's row access.
create or replace function public.public_content_hold_reason(p_author text, p_text text, p_has_media boolean)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  v_author text := lower(coalesce(p_author, ''));
  v_text text := lower(coalesce(p_text, ''));
  v_reason text;
  v_approved integer;
begin
  if v_author = '' then return 'No author'; end if;

  select h.reason into v_reason from public.moderation_held_terms h
  where v_text ~ ('\m' || regexp_replace(h.term, '([^a-z0-9 ])', '\\\1', 'g') || '\M')
  order by h.term limit 1;
  if v_reason is not null then return 'Held term: ' || v_reason; end if;

  if exists (select 1 from public.forum_posts p where lower(p.created_by) = v_author
               and (p.approval_status = 'rejected' or (p.approval_status = 'approved' and p.moderation_hidden)))
     or exists (select 1 from public.forum_comments c where lower(c.created_by) = v_author
               and (c.approval_status = 'rejected' or (c.approval_status = 'approved' and c.moderation_hidden)))
     or exists (select 1 from public.gecko_images g where lower(g.created_by) = v_author
               and (g.approval_status = 'rejected' or (g.approval_status = 'approved' and g.moderation_hidden))) then
    return 'Author has rejected or hidden content';
  end if;

  select (select count(*) from public.forum_posts p where lower(p.created_by) = v_author and p.approval_status = 'approved' and not p.moderation_hidden)
       + (select count(*) from public.forum_comments c where lower(c.created_by) = v_author and c.approval_status = 'approved' and not c.moderation_hidden)
       + (select count(*) from public.gecko_images g where lower(g.created_by) = v_author and g.approval_status = 'approved' and not g.moderation_hidden)
    into v_approved;
  if v_approved >= 2 then return null; end if;

  if p_has_media then return 'Photo from a new member'; end if;
  if v_text ~ '(https?://|www\.|\m[a-z0-9-]+\.(com|net|org|io|co|me|ly|gg|xyz|shop|store|link|app)\M)' then
    return 'Link from a new member';
  end if;
  return null;
end $$;
revoke all on function public.public_content_hold_reason(text,text,boolean) from public, anon;
grant execute on function public.public_content_hold_reason(text,text,boolean) to authenticated, service_role;

create or replace function public.guard_public_content_approval() returns trigger
language plpgsql set search_path = '' as $$
declare changed boolean; v_text text; v_media boolean; v_reason text;
  ignored text[] := array['moderation_hidden','approval_status','approval_revision','approval_hold_reason','updated_date',
    'view_count','is_pinned','is_locked','image_embedding','embedding_model','embedding_date',
    'embedding_status','embedding_attempts','embedding_error'];
begin
  if tg_table_name = 'gecko_images' then
    v_text := concat_ws(' ', new.notes, new.primary_morph, new.secondary_morph);
    v_media := true;
  elsif tg_table_name = 'forum_posts' then
    v_text := concat_ws(' ', new.title, new.content);
    v_media := coalesce(jsonb_array_length(case when jsonb_typeof(new.image_urls) = 'array' then new.image_urls end), 0) > 0;
  else
    v_text := new.content;
    v_media := coalesce(jsonb_array_length(case when jsonb_typeof(new.image_urls) = 'array' then new.image_urls end), 0) > 0;
  end if;

  if tg_op = 'INSERT' then
    v_reason := public.public_content_hold_reason(new.created_by, v_text, v_media);
    new.approval_status := case when v_reason is null then 'approved' else 'pending' end;
    new.approval_revision := 1;
    new.approval_hold_reason := v_reason;
  else
    changed := (to_jsonb(new) - ignored) is distinct from (to_jsonb(old) - ignored);
    if current_user in ('authenticated','anon') and not coalesce(public.is_admin(), false) then
      new.approval_status := old.approval_status;
      new.approval_revision := old.approval_revision;
      new.approval_hold_reason := old.approval_hold_reason;
    end if;
    if changed then
      v_reason := case old.approval_status
        when 'pending' then 'Edited while awaiting review'
        when 'rejected' then 'Edited after rejection'
        else public.public_content_hold_reason(new.created_by, v_text, v_media) end;
      new.approval_status := case when v_reason is null then 'approved' else 'pending' end;
      new.approval_revision := old.approval_revision + 1;
      new.approval_hold_reason := v_reason;
    end if;
  end if;
  -- Runs after the existing hidden-column guard; even the old Unhide action
  -- cannot publish an item that has not been approved. An approved edit keeps
  -- the item's current visibility, so a moderator's hide still holds.
  if new.approval_status <> 'approved' then new.moderation_hidden := true; end if;
  return new;
end $$;

-- The queue now returns the hold reason inside content (to_jsonb includes
-- the new column), so admin_public_content_queue needs no change.
commit;

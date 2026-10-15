-- Account erasure covers the round 2 records (comprehensive review of
-- 14 Oct 2026, round 2 follow-ups). NOT APPLIED YET.
--
-- Why: admin_erase_account (used by delete-my-account and
-- admin-delete-account) clears a member's rows table by table. Round 2
-- added three places that hold a member's address or words, and erasure
-- did not reach them, while the Privacy Policy says deletion removes the
-- login and personal records:
--   * email_deliveries (20261015151200): one row per email event, with the
--     address, and for a click the link that was clicked.
--   * lifecycle_email_sends (20261015151200): which welcome emails went to
--     the address. Left behind, it also stopped a member who deleted their
--     account and joined again from ever getting the welcome series.
--   * payment_events.cancellation_comment (20261015151400): free text the
--     member typed when cancelling.
-- After: the delivery rows keep their counts with no address and no
-- detail, the ledger rows are deleted, and the comment is cleared.
-- email_suppressions keeps the address on purpose (see step 1n).
--
-- The function below is the body from 20261015130000_comms_and_exposure.sql
-- (the version live on 15 Oct 2026) with those three additions only. It
-- sorts after every file it reads, so it can run in the same release.
-- Safe to run more than once.

CREATE OR REPLACE FUNCTION public.admin_erase_account(p_email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_email     text := lower(btrim(coalesce(p_email, '')));
  v_uid       uuid;
  v_uid_text  text;
  v_tomb      text := 'deleted-' || replace(gen_random_uuid()::text, '-', '') || '@deleted.geckinspect.invalid';
  v_label     constant text := 'Former member';
  v_zero      constant uuid := '00000000-0000-0000-0000-000000000000';
  v_url_re    constant text := '/storage/v1/object/(?:public|sign|authenticated)/([A-Za-z0-9_-]+)/([^?#"'' ]+)';
  v_buckets   constant text[] := array['geck-inspect-media', 'promote-images', 'raw-uploads'];
  v_profile   int := 0;
  v_geckos_deleted int := 0;
  v_geckos_kept    int := 0;
  v_messages  int := 0;
  v_images    int := 0;
  v_files     jsonb;
begin
  -- Server only. EXECUTE is also revoked from anon and authenticated, but
  -- this check holds even if a grant is ever restored by mistake: a call
  -- through the API carries a role claim, and only service_role passes. A
  -- direct database session (no claim) is an admin at the console.
  if auth.role() is not null and auth.role() <> 'service_role' then
    raise exception 'admin_erase_account: service role only';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'admin_erase_account: an email address is required';
  end if;
  if v_email like '%@deleted.geckinspect.invalid' then
    raise exception 'admin_erase_account: this account was already erased';
  end if;
  if exists (select 1 from public.profiles p where lower(p.email) = v_email and p.role = 'admin') then
    raise exception 'admin_erase_account: remove the admin role before erasing an admin account';
  end if;

  select u.id into v_uid from auth.users u where lower(u.email) = v_email limit 1;
  v_uid_text := v_uid::text;

  -- 1a. Gather the member's files before the rows that point at them go.
  create temp table if not exists pg_temp._erase_files (bucket text, name text) on commit drop;
  truncate pg_temp._erase_files;

  insert into pg_temp._erase_files (bucket, name)
  select o.bucket_id, o.name
    from storage.objects o
   where o.bucket_id = any (v_buckets)
     and v_uid is not null
     and (o.owner_id = v_uid_text
          or o.owner = v_uid
          or o.name ~ ('(^|/)' || v_uid_text || '/'));

  insert into pg_temp._erase_files (bucket, name)
  select m[1], m[2]
    from (
      select g.image_urls::text as blob from public.geckos g where lower(g.created_by) = v_email
      union all select r.image_urls::text from public.other_reptiles r where lower(r.created_by) = v_email
      union all select i.image_url from public.gecko_images i where lower(i.created_by) = v_email
      union all select p.profile_image_url || ' ' || coalesce(p.cover_image_url, '') from public.profiles p where lower(p.email) = v_email
      union all select l.image_url from public.lineage_placeholders l where lower(l.created_by) = v_email
      union all select coalesce(b.profile_photo, '') || ' ' || coalesce(b.banner_photo, '') from public.breeder_profiles b
               where lower(b.created_by) = v_email or (v_uid is not null and b.user_id = v_uid)
      union all select s.header_image_url from public.breeder_store_pages s where lower(s.owner_email) = v_email
      union all select v.attachments::text from public.vet_records v where lower(v.created_by) = v_email
      union all select c.image_url from public.morph_guide_comments c where lower(c.created_by) = v_email or lower(c.user_email) = v_email
      union all select r.image_url from public.morph_reference_images r
               where lower(r.submitted_by_email) = v_email and coalesce(r.status, '') <> 'approved'
      union all select p.public_url from public.promote_images p where v_uid is not null and p.user_id = v_uid
    ) blobs
    cross join lateral regexp_matches(coalesce(blobs.blob, ''), v_url_re, 'g') as m
   where m[1] = any (v_buckets);

  -- 1b. Lineage: keep the member's geckos that another member's gecko
  --     descends from (any number of generations), or that another
  --     member's breeding plan uses.
  create temp table if not exists pg_temp._erase_keep (id text primary key) on commit drop;
  truncate pg_temp._erase_keep;

  insert into pg_temp._erase_keep (id)
  with recursive mine as (
    select g.id, g.sire_id, g.dam_id from public.geckos g where lower(g.created_by) = v_email
  ),
  seeds as (
    select m.id
      from mine m
     where exists (select 1 from public.geckos o
                    where (o.sire_id = m.id or o.dam_id = m.id)
                      and lower(coalesce(o.created_by, '')) <> v_email)
        or exists (select 1 from public.breeding_plans bp
                    where (bp.sire_id = m.id or bp.dam_id = m.id)
                      and lower(coalesce(bp.created_by, '')) <> v_email)
  ),
  ancestors as (
    select s.id from seeds s
    union
    select m.id
      from ancestors a
      join public.geckos child on child.id = a.id
      join mine m on m.id in (child.sire_id, child.dam_id)
  )
  select distinct id from ancestors
  on conflict do nothing;

  -- Give every child (anyone's) a parent name before the parent is hidden
  -- or deleted.
  update public.geckos c
     set sire_name = p.name
    from public.geckos p
   where c.sire_id = p.id
     and lower(p.created_by) = v_email
     and nullif(btrim(c.sire_name), '') is null;
  update public.geckos c
     set dam_name = p.name
    from public.geckos p
   where c.dam_id = p.id
     and lower(p.created_by) = v_email
     and nullif(btrim(c.dam_name), '') is null;

  -- Other members' records that link to one of the member's geckos with a
  -- plain foreign key (no cascade) would block the delete. Clear the link;
  -- their own text (sire_name, review body) stays.
  update public.breeding_projects bp
     set sire_animal_id = null
   where bp.sire_animal_id in (select g.id from public.geckos g where lower(g.created_by) = v_email)
     and not (lower(coalesce(bp.created_by, '')) = v_email or (v_uid is not null and bp.user_id = v_uid));
  update public.breeding_projects bp
     set dam_animal_id = null
   where bp.dam_animal_id in (select g.id from public.geckos g where lower(g.created_by) = v_email)
     and not (lower(coalesce(bp.created_by, '')) = v_email or (v_uid is not null and bp.user_id = v_uid));
  update public.breeder_reviews r
     set animal_id = null
   where r.animal_id in (select g.id from public.geckos g where lower(g.created_by) = v_email);

  -- 1c. Kept lineage geckos: anonymise.
  update public.geckos g
     set created_by = v_tomb,
         collection_id = null,
         is_public = false,
         gallery_display = false,
         archived = true,
         archived_date = coalesce(g.archived_date, current_date),
         archive_reason = 'Owner account deleted',
         notes = null,
         genetics_notes = null,
         marketplace_description = null,
         asking_price = null,
         listing_price = null,
         sold_price = null,
         market_price_estimate = null,
         morphmarket_id = null,
         morphmarket_url = null,
         palm_street_id = null,
         palm_street_url = null,
         image_urls = '[]'::jsonb,
         image_crop_data = null,
         passport_code = null,
         breeder_name = null,
         breeder_user_id = null,
         hatch_facility = null,
         feeding_group_id = null,
         growth_slideshow_enabled = false
   where g.id in (select k.id from pg_temp._erase_keep k);
  get diagnostics v_geckos_kept = row_count;

  -- 1d. Chain of custody and transfers on animals other members now hold.
  update public.ownership_records o
     set owner_user_id = null,
         owner_name = v_label,
         owner_avatar_url = null,
         notes = null,
         created_by = case when lower(o.created_by) = v_email then v_tomb else o.created_by end
   where (v_uid is not null and o.owner_user_id = v_uid)
      or lower(coalesce(o.created_by, '')) = v_email;

  delete from public.transfer_requests t
   where t.status <> 'claimed'
     and ((v_uid is not null and (t.from_user_id = v_uid or t.to_user_id = v_uid))
          or lower(t.to_email) = v_email
          or lower(coalesce(t.created_by, '')) = v_email);
  update public.transfer_requests t
     set from_user_id = case when t.from_user_id = v_uid then v_zero else t.from_user_id end,
         to_user_id   = case when t.to_user_id = v_uid then null else t.to_user_id end,
         to_email     = case when lower(t.to_email) = v_email then v_tomb else t.to_email end,
         created_by   = case when lower(t.created_by) = v_email then v_tomb else t.created_by end,
         message      = null
   where (v_uid is not null and (t.from_user_id = v_uid or t.to_user_id = v_uid))
      or lower(t.to_email) = v_email
      or lower(coalesce(t.created_by, '')) = v_email;

  update public.geckos g
     set breeder_user_id = null
   where v_uid is not null and g.breeder_user_id = v_uid;

  -- 1e. Breeding records.
  update public.breeding_loans l
     set breeding_project_id = null
   where l.breeding_project_id in (
     select bp.id from public.breeding_projects bp
      where lower(coalesce(bp.created_by, '')) = v_email or (v_uid is not null and bp.user_id = v_uid));
  delete from public.breeding_loans l
   where (v_uid is not null and l.lender_user_id = v_uid)
      or (lower(coalesce(l.created_by, '')) = v_email and (l.lender_user_id is null or l.lender_user_id = v_uid));
  update public.breeding_loans l
     set borrower_user_id = null,
         borrower_email = null,
         borrower_name = v_label,
         created_by = case when lower(l.created_by) = v_email then v_tomb else l.created_by end
   where (v_uid is not null and l.borrower_user_id = v_uid)
      or lower(coalesce(l.borrower_email, '')) = v_email;

  delete from public.eggs e
   where e.breeding_plan_id in (select bp.id from public.breeding_plans bp where lower(bp.created_by) = v_email)
      or lower(coalesce(e.created_by, '')) = v_email;
  delete from public.breeding_plans bp where lower(bp.created_by) = v_email;
  delete from public.future_breeding_plans x where lower(x.created_by) = v_email;
  delete from public.pairing_outcome_logs x where lower(x.created_by) = v_email;
  delete from public.genetic_outcome_predictions x where lower(x.created_by) = v_email;
  delete from public.clutches x where lower(x.created_by) = v_email;
  delete from public.breeding_projects bp
   where lower(coalesce(bp.created_by, '')) = v_email or (v_uid is not null and bp.user_id = v_uid);
  delete from geck_data.breeding_pairs x where v_uid is not null and x.owner_id = v_uid;

  -- 1f. Husbandry records the member logged.
  --     On someone else's animal (one they sold or care for in a shared
  --     collection) the record stays with the animal's history, with the
  --     author replaced by the deleted-account address and their notes
  --     removed. On their own animals (including ones kept above for
  --     lineage, already re-addressed in 1c) it is deleted. "Someone
  --     else's" means a gecko or reptile that exists and is not theirs.
  update public.weight_records x
     set created_by = v_tomb, notes = null
   where lower(x.created_by) = v_email
     and exists (select 1 from public.geckos g
                  where g.id = x.gecko_id
                    and lower(coalesce(g.created_by, '')) <> v_email
                    and g.id not in (select k.id from pg_temp._erase_keep k));
  update public.feeding_records x
     set created_by = case when lower(x.created_by) = v_email then v_tomb else x.created_by end,
         logged_by = case when x.logged_by = v_uid then null else x.logged_by end,
         notes = null
   where (lower(x.created_by) = v_email or (v_uid is not null and x.logged_by = v_uid))
     and exists (select 1 from public.geckos g
                  where g.id = x.animal_id
                    and lower(coalesce(g.created_by, '')) <> v_email
                    and g.id not in (select k.id from pg_temp._erase_keep k));
  update public.shed_records x
     set created_by = case when lower(x.created_by) = v_email then v_tomb else x.created_by end,
         logged_by = case when x.logged_by = v_uid then null else x.logged_by end,
         notes = null
   where (lower(x.created_by) = v_email or (v_uid is not null and x.logged_by = v_uid))
     and exists (select 1 from public.geckos g
                  where g.id = x.animal_id
                    and lower(coalesce(g.created_by, '')) <> v_email
                    and g.id not in (select k.id from pg_temp._erase_keep k));
  update public.vet_records x
     set created_by = v_tomb
   where lower(x.created_by) = v_email
     and exists (select 1 from public.geckos g
                  where g.id = x.animal_id
                    and lower(coalesce(g.created_by, '')) <> v_email
                    and g.id not in (select k.id from pg_temp._erase_keep k));
  update public.gecko_events x
     set created_by = v_tomb, notes = null
   where lower(x.created_by) = v_email
     and exists (select 1 from public.geckos g
                  where g.id = x.gecko_id
                    and lower(coalesce(g.created_by, '')) <> v_email
                    and g.id not in (select k.id from pg_temp._erase_keep k));
  update public.reptile_events x
     set created_by = v_tomb, notes = null
   where lower(x.created_by) = v_email
     and exists (select 1 from public.other_reptiles r
                  where r.id = x.reptile_id
                    and lower(coalesce(r.created_by, '')) <> v_email);
  update public.lineage_placeholders x
     set created_by = v_tomb, notes = null
   where lower(x.created_by) = v_email
     and exists (select 1 from public.geckos g
                  where g.id = x.gecko_id
                    and lower(coalesce(g.created_by, '')) <> v_email
                    and g.id not in (select k.id from pg_temp._erase_keep k));
  -- Everything still in the member's name is on their own animals (or on
  -- an animal that no longer exists).
  delete from public.weight_records x where lower(x.created_by) = v_email;
  delete from public.feeding_records x where lower(x.created_by) = v_email or (v_uid is not null and x.logged_by = v_uid);
  delete from public.shed_records x where lower(x.created_by) = v_email or (v_uid is not null and x.logged_by = v_uid);
  delete from public.vet_records x where lower(x.created_by) = v_email;
  delete from public.gecko_events x where lower(x.created_by) = v_email;
  delete from public.reptile_events x where lower(x.created_by) = v_email;
  delete from public.lineage_placeholders x where lower(x.created_by) = v_email;

  -- 1g. Animals. Deleting a gecko also removes its weights, feedings, sheds,
  --     vet visits, ownership records, loans and pending transfers (existing
  --     cascades and triggers).
  delete from public.geckos g
   where lower(g.created_by) = v_email
     and g.id not in (select k.id from pg_temp._erase_keep k);
  get diagnostics v_geckos_deleted = row_count;
  -- Geckos with no recorded owner that sit in the member's own collections.
  delete from public.geckos g
   where nullif(btrim(g.created_by), '') is null
     and g.collection_id in (select c.id from public.collections c where lower(c.owner_email) = v_email);
  delete from public.other_reptiles x where lower(x.created_by) = v_email;
  delete from public.feeding_groups x where lower(x.created_by) = v_email;

  -- 1h. Collections. Remove the member from other members' collections,
  --     then delete their own. Clearing is_default first lets the existing
  --     rehome trigger move collaborators' geckos to their own default
  --     collection instead of leaving them in no collection.
  delete from public.collection_members cm
   where lower(cm.member_email) = v_email
     and cm.collection_id not in (select c.id from public.collections c where lower(c.owner_email) = v_email);
  update public.collection_members cm
     set invited_by_email = null
   where lower(cm.invited_by_email) = v_email;
  update public.collections c set is_default = false where lower(c.owner_email) = v_email;
  delete from public.collections c where lower(c.owner_email) = v_email;
  update public.collection_activity a
     set actor_email = null,
         actor_name = v_label
   where lower(a.actor_email) = v_email;
  update public.collection_activity a
     set detail = null
   where position(v_email in lower(coalesce(a.detail, ''))) > 0;

  -- 1i. Photos and the training data on them.
  delete from public.gecko_likes x
   where lower(x.user_email) = v_email
      or lower(x.owner_email) = v_email
      or x.gecko_image_id in (select i.id from public.gecko_images i where lower(i.created_by) = v_email);
  delete from public.gecko_of_the_day x
   where lower(x.uploader_email) = v_email
      or x.gecko_image_id in (select i.id from public.gecko_images i where lower(i.created_by) = v_email);
  delete from public.gecko_images i where lower(i.created_by) = v_email;
  get diagnostics v_images = row_count;
  update public.classification_votes v
     set created_by = case when lower(v.created_by) = v_email then v_tomb else v.created_by end,
         reviewer_email = case when lower(v.reviewer_email) = v_email then null else v.reviewer_email end,
         verified_by = case when lower(v.verified_by) = v_email then null else v.verified_by end
   where lower(coalesce(v.created_by, '')) = v_email
      or lower(coalesce(v.reviewer_email, '')) = v_email
      or lower(coalesce(v.verified_by, '')) = v_email;
  delete from public.morph_reference_images r
   where lower(r.submitted_by_email) = v_email and coalesce(r.status, '') <> 'approved';
  update public.morph_reference_images r
     set submitted_by_email = v_tomb,
         created_by = case when lower(r.created_by) = v_email then v_tomb else r.created_by end
   where lower(r.submitted_by_email) = v_email;
  update public.morph_price_entries p
     set submitted_by = null,
         created_by = case when lower(p.created_by) = v_email then v_tomb else p.created_by end,
         notes = null,
         is_anonymous = true
   where (v_uid is not null and p.submitted_by = v_uid) or lower(coalesce(p.created_by, '')) = v_email;
  delete from public.promote_images x where v_uid is not null and x.user_id = v_uid;

  -- 1j. Messages, notifications and support.
  delete from public.direct_messages d
   where lower(d.sender_email) = v_email
      or lower(d.recipient_email) = v_email
      or lower(coalesce(d.created_by, '')) = v_email;
  get diagnostics v_messages = row_count;
  delete from public.notifications n
   where lower(n.user_email) = v_email or lower(coalesce(n.created_by, '')) = v_email;
  delete from public.support_replies r
   where r.message_id in (
     select s.id::text from public.support_messages s
      where (lower(s.user_email) = v_email or lower(coalesce(s.created_by, '')) = v_email)
        and s.subject is distinct from 'Account deletion request');
  delete from public.support_messages s
   where (lower(s.user_email) = v_email or lower(coalesce(s.created_by, '')) = v_email)
     and s.subject is distinct from 'Account deletion request';
  -- 15 Oct 2026: a deletion request this member filed naming someone else
  -- is kept for the team's records, without the member's address. The
  -- member's own deletion ticket is left alone here: the edge function
  -- that called this closes it (and the guard then clears its filer), and
  -- a retried erasure from the inbox still needs it to be verifiable.
  update public.support_messages s
     set filed_by_email = null,
         created_by = case when lower(coalesce(s.created_by, '')) = v_email then null else s.created_by end
   where lower(s.filed_by_email) = v_email
     and lower(coalesce(s.user_email, '')) <> v_email;
  delete from public.push_subscriptions x where lower(x.user_email) = v_email;
  -- Tables added on 3 Oct 2026.
  delete from public.content_reports x where lower(x.reporter_email) = v_email;
  delete from public.planner_notes x where v_uid is not null and x.user_id = v_uid;
  delete from public.consultant_conversations x where v_uid is not null and x.user_id = v_uid;
  delete from public.forum_post_views x where v_uid is not null and x.viewer_id = v_uid;

  -- 1k. Community.
  update public.forum_posts f
     set author_name = v_label, created_by = v_tomb
   where lower(f.created_by) = v_email;
  update public.forum_comments f
     set author_name = v_label, created_by = v_tomb
   where lower(f.created_by) = v_email;
  delete from public.forum_likes x where lower(x.user_email) = v_email or lower(coalesce(x.created_by, '')) = v_email;
  update public.questions q
     set author_id = null, created_by = v_tomb
   where lower(q.created_by) = v_email or (v_uid is not null and q.author_id = v_uid);
  update public.answers a
     set author_id = null, created_by = v_tomb
   where lower(a.created_by) = v_email or (v_uid is not null and a.author_id = v_uid);
  delete from public.question_votes x where lower(x.created_by) = v_email or (v_uid is not null and x.user_id = v_uid);
  delete from public.morph_guide_comments x where lower(x.created_by) = v_email or lower(x.user_email) = v_email;
  delete from public.community_event_reactions x where lower(x.user_email) = v_email;
  delete from public.user_follows x
   where lower(x.follower_email) = v_email or lower(x.following_email) = v_email;
  delete from public.user_blocks x
   where lower(x.blocker_email) = v_email or lower(x.blocked_email) = v_email;
  delete from public.marketplace_likes x where lower(x.user_email) = v_email or lower(coalesce(x.created_by, '')) = v_email;
  delete from public.breeder_reviews r where v_uid is not null and r.reviewed_user_id = v_uid;
  update public.breeder_reviews r
     set reviewer_user_id = null,
         created_by = case when lower(r.created_by) = v_email then v_tomb else r.created_by end
   where (v_uid is not null and r.reviewer_user_id = v_uid) or lower(coalesce(r.created_by, '')) = v_email;
  delete from public.giveaway_entries x where lower(x.user_email) = v_email;
  update public.giveaways g
     set winner_emails = coalesce((
           select jsonb_agg(w) from jsonb_array_elements(g.winner_emails) w
            where lower(w #>> '{}') <> v_email), '[]'::jsonb)
   where jsonb_typeof(g.winner_emails) = 'array'
     and exists (select 1 from jsonb_array_elements(g.winner_emails) w where lower(w #>> '{}') = v_email);
  delete from public.user_badges x where lower(x.user_email) = v_email or lower(coalesce(x.created_by, '')) = v_email;
  delete from public.user_activity x where lower(x.user_email) = v_email or lower(coalesce(x.created_by, '')) = v_email;
  delete from public.user_events x where lower(x.user_email) = v_email or lower(coalesce(x.created_by, '')) = v_email;
  delete from public.expert_actions x where lower(x.expert_email) = v_email or lower(coalesce(x.created_by, '')) = v_email;
  delete from public.expert_verification_requests x where lower(x.user_email) = v_email or lower(coalesce(x.created_by, '')) = v_email;
  delete from public.mentor_offers x where lower(x.owner_email) = v_email or (v_uid is not null and x.user_id = v_uid);

  -- 1l. Breeder pages, waitlists and inquiries.
  delete from public.breeder_profiles x where lower(x.created_by) = v_email or (v_uid is not null and x.user_id = v_uid);
  delete from public.breeder_store_pages x where lower(x.owner_email) = v_email;
  delete from public.breeder_inquiries x where lower(x.buyer_email) = v_email or lower(x.breeder_email) = v_email;
  delete from public.gecko_waitlists x where v_uid is not null and x.breeder_user_id = v_uid;
  delete from public.gecko_waitlist_signups x where lower(x.email) = v_email;

  -- 1m. Business tools and market.
  delete from public.pending_sales x where lower(x.user_email) = v_email or lower(coalesce(x.created_by, '')) = v_email;
  delete from public.marketplace_costs x where lower(x.user_email) = v_email or lower(coalesce(x.created_by, '')) = v_email;
  delete from public.collection_valuations x where lower(x.created_by) = v_email or (v_uid is not null and x.user_id = v_uid);
  delete from public.market_value_daily x where lower(x.user_email) = v_email;
  delete from public.price_alerts x where lower(x.created_by) = v_email or (v_uid is not null and x.user_id = v_uid);
  delete from public.price_game_guesses x where v_uid is not null and x.user_id = v_uid;
  delete from public.tasks x where lower(x.created_by) = v_email;
  delete from public.projects x where lower(x.created_by) = v_email;
  delete from public.shipping_orders x where lower(x.created_by) = v_email;

  -- 1n. Usage, integrations and subscriptions.
  delete from public.newsletter_subscribers x where lower(x.email) = v_email or (v_uid is not null and x.user_id = v_uid);
  delete from public.guide_email_sends x where lower(x.email) = v_email;
  -- Email delivery log (20261015151200): keep the counts, drop the
  -- person. The address goes, and so does the detail, which holds the
  -- link they clicked or a bounce message that can quote the address.
  -- email_delivery_stats counts by message and type, so the admin
  -- figures do not change. The lifecycle ledger row goes too, which also
  -- lets someone who signs up again later get the welcome emails.
  -- email_suppressions is kept on purpose: an address that bounced or
  -- marked our email as spam must never be mailed again.
  update public.email_deliveries x
     set email = null,
         detail = '{}'::jsonb
   where lower(x.email) = v_email;
  delete from public.lifecycle_email_sends x where x.email = v_email;
  delete from public.feature_usage x where v_uid is not null and x.user_id = v_uid;
  delete from public.morph_id_usage x where v_uid is not null and x.user_id = v_uid;
  delete from public.iot_connections x where v_uid is not null and x.user_id = v_uid;
  delete from public.social_posts x where (v_uid is not null and x.created_by_user_id = v_uid) or lower(coalesce(x.created_by_email, '')) = v_email;
  delete from public.social_platform_connections x where v_uid is not null and x.user_id = v_uid;
  delete from public.social_post_usage x where v_uid is not null and x.user_id = v_uid;
  delete from public.social_post_photo_usage x where v_uid is not null and x.user_id = v_uid;
  delete from public.social_generation_log x where v_uid is not null and x.user_id = v_uid;
  delete from public.user_brand_voice x where v_uid is not null and x.user_id = v_uid;
  delete from public.store_carts x where v_uid is not null and x.owner_user_id = v_uid;
  delete from public.revenuecat_entitlements x where v_uid is not null and x.app_user_id = v_uid;
  delete from public.revenuecat_sync_requests x where v_uid is not null and x.app_user_id = v_uid;
  update public.store_affiliate_clicks x set user_id = null where v_uid is not null and x.user_id = v_uid;

  -- 1o. Money and referral records: keep the amounts, drop the person.
  update public.store_orders o
     set customer_email = v_tomb,
         customer_name = null,
         owner_user_id = null,
         ship_to = null,
         notes = null
   where lower(o.customer_email) = v_email or (v_uid is not null and o.owner_user_id = v_uid);
  update public.store_signup_grants g
     set granted_email = case when lower(g.granted_email) = v_email then v_tomb else g.granted_email end,
         redeemed_by_user_id = case when g.redeemed_by_user_id = v_uid then null else g.redeemed_by_user_id end,
         ship_to_postal_hash = null
   where lower(g.granted_email) = v_email or (v_uid is not null and g.redeemed_by_user_id = v_uid);
  update public.payment_events p
     set user_email = v_tomb,
         raw_stripe_payload = null,
         -- What the member typed when cancelling (20261015151400).
         cancellation_comment = null,
         created_by = case when lower(p.created_by) = v_email then v_tomb else p.created_by end
   where lower(p.user_email) = v_email;
  update public.referral_rewards r
     set referrer_email = case when lower(r.referrer_email) = v_email then v_tomb else r.referrer_email end,
         referred_email = case when lower(r.referred_email) = v_email then v_tomb else r.referred_email end
   where lower(r.referrer_email) = v_email or lower(r.referred_email) = v_email;
  update public.social_referral_bonuses b
     set referrer_email = case when lower(b.referrer_email) = v_email then v_tomb else b.referrer_email end,
         referred_email = case when lower(b.referred_email) = v_email then v_tomb else b.referred_email end,
         referrer_user_id = case when b.referrer_user_id = v_uid then null else b.referrer_user_id end,
         referred_user_id = case when b.referred_user_id = v_uid then null else b.referred_user_id end
   where lower(coalesce(b.referrer_email, '')) = v_email
      or lower(coalesce(b.referred_email, '')) = v_email
      or (v_uid is not null and (b.referrer_user_id = v_uid or b.referred_user_id = v_uid));

  -- 1p. Logs.
  update public.error_logs e
     set user_email = null,
         created_by = case when lower(e.created_by) = v_email then null else e.created_by end
   where lower(coalesce(e.user_email, '')) = v_email or lower(coalesce(e.created_by, '')) = v_email;
  update geck_data.error_logs e
     set user_email = null,
         created_by = case when e.created_by = v_uid then null else e.created_by end
   where lower(coalesce(e.user_email, '')) = v_email or (v_uid is not null and e.created_by = v_uid);
  update geck_data.user_events e
     set user_email = null,
         created_by = case when e.created_by = v_uid then null else e.created_by end
   where lower(coalesce(e.user_email, '')) = v_email or (v_uid is not null and e.created_by = v_uid);
  update geck_data.model_invocations m set user_id = null where v_uid is not null and m.user_id = v_uid;
  update geck_data.listing_images li set uploaded_by = null where v_uid is not null and li.uploaded_by = v_uid;
  delete from geck_data.alerts x where v_uid is not null and x.owner_id = v_uid;
  delete from geck_data.user_notification_channels x where v_uid is not null and x.owner_id = v_uid;

  -- 1q. The profile itself.
  delete from public.profiles p where lower(p.email) = v_email;
  get diagnostics v_profile = row_count;
  delete from geck_data.profiles p where lower(p.email) = v_email or (v_uid is not null and p.id = v_uid);

  -- 2. Files to remove: the member's, minus anything a surviving row uses.
  select coalesce(jsonb_agg(jsonb_build_object('bucket', f.bucket, 'path', f.name)), '[]'::jsonb)
    into v_files
    from (
      select distinct ef.bucket, ef.name
        from pg_temp._erase_files ef
        join storage.objects o on o.bucket_id = ef.bucket and o.name = ef.name
    ) f
   where not exists (select 1 from public.geckos x where strpos(x.image_urls::text, f.name) > 0)
     and not exists (select 1 from public.other_reptiles x where strpos(x.image_urls::text, f.name) > 0)
     and not exists (select 1 from public.gecko_images x where strpos(x.image_url, f.name) > 0)
     and not exists (select 1 from public.profiles x
                      where strpos(coalesce(x.profile_image_url, '') || coalesce(x.cover_image_url, ''), f.name) > 0)
     and not exists (select 1 from public.forum_posts x where strpos(x.image_urls::text, f.name) > 0)
     and not exists (select 1 from public.forum_comments x where strpos(x.image_urls::text, f.name) > 0)
     and not exists (select 1 from public.lineage_placeholders x where strpos(x.image_url, f.name) > 0)
     and not exists (select 1 from public.morph_reference_images x where strpos(x.image_url, f.name) > 0)
     and not exists (select 1 from public.morph_guides x where strpos(x.example_image_url, f.name) > 0)
     and not exists (select 1 from public.morph_traits x where strpos(x.image_url, f.name) > 0)
     and not exists (select 1 from public.care_guide_sections x where strpos(x.image_urls::text, f.name) > 0)
     and not exists (select 1 from public.breeder_store_pages x where strpos(x.header_image_url, f.name) > 0)
     and not exists (select 1 from public.breeder_profiles x
                      where strpos(coalesce(x.profile_photo, '') || coalesce(x.banner_photo, ''), f.name) > 0)
     and not exists (select 1 from public.store_products x where strpos(x.images::text, f.name) > 0)
     and not exists (select 1 from public.vet_records x where strpos(x.attachments::text, f.name) > 0)
     and not exists (select 1 from public.breeding_loans x
                      where strpos(coalesce(x.condition_photos_out::text, '') || coalesce(x.condition_photos_in::text, ''), f.name) > 0)
     and not exists (select 1 from public.giveaways x where strpos(x.image_urls::text, f.name) > 0)
     and not exists (select 1 from public.blog_posts x where strpos(x.featured_image_url, f.name) > 0)
     and not exists (select 1 from public.testimonials x where strpos(x.avatar_url, f.name) > 0)
     and not exists (select 1 from public.promote_images x where x.storage_path = f.name);

  return jsonb_build_object(
    'email', v_email,
    'auth_user_id', v_uid,
    'profile_deleted', v_profile > 0,
    'geckos_deleted', v_geckos_deleted,
    'geckos_anonymised', v_geckos_kept,
    'photos_deleted', v_images,
    'messages_deleted', v_messages,
    'files', v_files
  );
end;
$function$;

revoke all on function public.admin_erase_account(text) from public;
revoke all on function public.admin_erase_account(text) from anon;
revoke all on function public.admin_erase_account(text) from authenticated;
grant execute on function public.admin_erase_account(text) to service_role;

comment on function public.admin_erase_account(text) is
  'Deletes or anonymises one member''s rows (D16). Service role only; called by the admin-delete-account edge function, which then removes the returned Storage files and the login. Keeps email_suppressions on purpose, so an address that bounced or complained is never mailed again.';

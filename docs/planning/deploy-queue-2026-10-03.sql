-- Geck Inspect: the four migrations the Supabase MCP tool could not run
-- (3 Oct 2026). Paste this whole file into Supabase > SQL Editor and run it.
--
-- It runs in one transaction: if any part fails, nothing changes.
-- Before running: the app version that reads only safe columns is live
-- (it has been since 3 Oct), and the waitlist-signup function is deployed.
--
-- What it does, in order:
--   1. Account erasure: admin_erase_account() (server only) and the admin
--      alert when a member asks to delete their account.
--   2. Signed-out visitors stop seeing owner emails on geckos and photos.
--   3. Signed-out visitors stop seeing emails on 20 more tables.
--   4. Waitlist signups must confirm by email (the old direct signup closes).
--   5. Records all four in the migration history.
--
-- If a signed-out page breaks afterwards, this restores the old access for
-- one table while it is fixed:  grant select on public.<table> to anon;

begin;

-- ===== 20261003220000_account_erasure =====
-- Account erasure (feature-completeness audit step 3, decision D16).
--
-- Two pieces:
--
--   1. public.admin_erase_account(p_email) deletes or anonymises every row
--      that belongs to one member, in one transaction. Only the service role
--      may run it; the admin-delete-account edge function calls it after it
--      has checked that the caller is an admin. The function cannot delete
--      Storage files (Storage blocks direct SQL deletes) or the login (that
--      belongs to the Auth admin API), so it returns the list of the
--      member's files and their login id, and the edge function finishes
--      both.
--
--   2. A trigger on support_messages tells every admin, in the bell and by
--      email, when a member files an "Account deletion request" from the
--      Danger Zone. Before this the ticket sat in the inbox unannounced.
--
-- The rule (D16): records other members depend on are anonymised, everything
-- else is deleted. "Anonymised" means the row stays but every link back to
-- the member is replaced: their email becomes a random address that can
-- never sign in (deleted-<random>@deleted.geckinspect.invalid), their user
-- id becomes null (or the all-zero id where the column cannot be null), and
-- names shown to others become "Former member".
--
-- Per table, what happens and why:
--
-- DELETED (only the member uses it)
--   profiles, geckos (except lineage parents, below), gecko_images and the
--   votes, likes and Gecko of the Day rows on them, other_reptiles,
--   reptile_events, weight_records, feeding_records, shed_records,
--   vet_records, gecko_events, feeding_groups, lineage_placeholders,
--   breeding_plans and their eggs, eggs, future_breeding_plans,
--   pairing_outcome_logs, genetic_outcome_predictions, breeding_projects
--   (and their clutches), clutches, collections the member owns (other
--   members' geckos in them move to their own default collection), the
--   member's collection memberships, pending_sales, marketplace_costs,
--   marketplace_likes, collection_valuations, market_value_daily,
--   price_alerts, price_game_guesses, tasks, projects, shipping_orders,
--   direct_messages (both directions: a message is personal data of both
--   people, and the brief lists messages for deletion), notifications to
--   and from the member, support_messages (except the deletion request
--   itself, see below), user_follows and user_blocks (both directions),
--   forum_likes, question_votes, community_event_reactions,
--   morph_guide_comments, gecko_likes, giveaway_entries, user_badges,
--   user_activity, user_events, expert_actions,
--   expert_verification_requests, mentor_offers, breeder_profiles,
--   breeder_store_pages, breeder_inquiries (sent or received),
--   reviews about the member, gecko_waitlists (and their signups),
--   the member's waitlist signups, newsletter_subscribers,
--   guide_email_sends, push_subscriptions, feature_usage, morph_id_usage,
--   iot_connections, promote_images, social_* tables, user_brand_voice,
--   store_carts, revenuecat_entitlements, revenuecat_sync_requests,
--   unapproved morph_reference_images, geck_data.breeding_pairs,
--   geck_data.alerts, geck_data.user_notification_channels and
--   geck_data.profiles (the last four also cascade from the login).
--
-- ANONYMISED (another member, or the public record, depends on it)
--   geckos that are a parent or ancestor of another member's gecko, or are
--     in another member's breeding plan: kept so multi-generation lineage
--     still works, but archived, private, out of every collection, with
--     notes, prices, photos, listing links, passport code and breeder
--     fields cleared. The child's sire_name/dam_name is filled from the
--     parent first, so the tree keeps a name even if the parent is hidden.
--   ownership_records on animals now owned by someone else: the member's
--     line in the chain of custody stays, as "Former member".
--   transfer_requests that were claimed: the other member's proof of
--     where the animal came from. Pending, expired and cancelled ones are
--     deleted.
--   geckos.breeder_user_id on other members' geckos: unlinked; the
--     breeder_name text the buyer recorded stays (it is their record).
--   breeding_projects and breeder_reviews of other members that point at
--     the member's gecko: the link is cleared, their own text stays.
--   breeding_loans where the member borrowed another member's animal: the
--     lender's record stays, the borrower is unlinked. Loans the member
--     lent are deleted.
--   forum_posts, forum_comments, questions, answers: other members'
--     replies hang off them, so the text stays under "Former member".
--   breeder_reviews written by the member: part of another breeder's
--     reputation.
--   approved morph_reference_images, classification_votes,
--     morph_price_entries: shared reference, training and market data.
--   collection_activity in other members' collections: the history stays,
--     the actor becomes "Former member".
--   collection_members.invited_by_email in other members' collections.
--   referral_rewards, social_referral_bonuses: the other member's reward
--     record.
--   store_orders, store_signup_grants, payment_events: money records we
--     may have to keep for tax and disputes; name, address, notes and the
--     raw Stripe payload are cleared, the amounts stay.
--   giveaways.winner_emails: the member's address is removed from the list.
--   error_logs, user_events (geck_data), model_invocations,
--     listing_images: operational logs; the email or user id is cleared.
--   The "Account deletion request" ticket itself: kept by this function so
--     the edge function can close it and record the erasure. The edge
--     function anonymises it as its last step.
--
-- KEPT AS IS
--   revenuecat_webhook_events and stripe_webhook_logs: raw billing logs
--     keyed by an id that no longer points at anyone.
--   Admin-only tables (blog_*, admin_tasks, app_settings, runtime config):
--     the admin account cannot be erased with this function.
--
-- Storage: the function returns every file in geck-inspect-media,
-- promote-images and raw-uploads that the member uploaded (by Storage
-- owner, by their user id folder, or by URL in a deleted row), minus any
-- file still referenced by a row that survives (for example a photo on a
-- gecko the member sold, which now belongs to the buyer). listing-images
-- holds scraped market photos and is never touched.
--
-- Run by hand in the SQL editor (the MCP tool cannot run statements that
-- contain delete or revoke). Includes a server-only guard and the tables
-- added on 3 Oct.

-- 1. The erasure function ----------------------------------------------------

create or replace function public.admin_erase_account(p_email text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
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

  -- 1f. Husbandry records the member logged (on any animal).
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
  'Deletes or anonymises one member''s rows (D16). Service role only; called by the admin-delete-account edge function, which then removes the returned Storage files and the login.';

-- 2. Admin alert when a member asks for deletion -----------------------------

create or replace function public.notify_admins_of_deletion_request()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if new.subject is distinct from 'Account deletion request' then
    return new;
  end if;
  insert into public.notifications (user_email, type, content, link, metadata)
  select p.email,
         'account_deletion_request',
         'A member asked to delete their account (' || coalesce(new.user_email, 'unknown email')
           || '). Open the Support inbox to review it and run the erasure. The privacy policy promises deletion within 30 days.',
         '/AdminPanel?section=support',
         jsonb_build_object('support_message_id', new.id)
    from public.profiles p
   where p.role = 'admin'
     and nullif(btrim(p.email), '') is not null;
  return new;
end;
$function$;

create or replace trigger support_messages_deletion_request_alert
  after insert on public.support_messages
  for each row execute function public.notify_admins_of_deletion_request();

-- 3. A title for the new notification type in the push and email dispatcher.
--    Same body as 20260930060855_market_watchlist_alerts.sql plus one line.

create or replace function public.notify_dispatch_on_insert()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'extensions', 'vault'
as $function$
declare
  v_push_url  constant text :=
    'https://mmuglfphhwlaluyfyxsp.supabase.co/functions/v1/send-push';
  v_email_url constant text :=
    'https://mmuglfphhwlaluyfyxsp.supabase.co/functions/v1/send-email';
  v_key       text;
  v_title     text;
  v_body      text;
  v_link      text;
  v_payload   jsonb;
  v_headers   jsonb;
begin
  -- Pull the service-role key from Vault. If it's not configured,
  -- skip both channels cleanly so the notifications INSERT itself
  -- still succeeds.
  select decrypted_secret
    into v_key
    from vault.decrypted_secrets
   where name = 'notification_service_role_key'
   limit 1;

  if v_key is null or v_key = '' then
    return NEW;
  end if;

  v_title := case NEW.type
    when 'new_message'            then 'New message'
    when 'marketplace_inquiry'    then 'Marketplace inquiry'
    when 'hatch_alert'            then 'Hatch alert'
    when 'feeding_due'            then 'Feeding due'
    when 'weighin_reminder'       then 'Weigh-in reminder'
    when 'new_comment'            then 'New comment'
    when 'new_reply'              then 'New reply'
    when 'new_follower'           then 'New follower'
    when 'new_gecko_listing'      then 'New gecko listed'
    when 'new_breeding_plan'      then 'New breeding plan'
    when 'future_breeding_ready'  then 'Breeding window ready'
    when 'gecko_of_the_day'       then 'Gecko of the Day'
    when 'level_up'               then 'Level up!'
    when 'expert_status'          then 'Expert status update'
    when 'submission_approved'    then 'Submission approved'
    when 'submission_rejected'    then 'Photo not added to the Morph Guide'
    when 'announcement'           then 'Geck Inspect announcement'
    when 'role_change'            then 'Role updated'
    when 'referral_reward'        then 'Your referral paid off'
    when 'referral_grant_ended'   then 'Your free month of Keeper has ended'
    when 'weekly_digest'          then 'Your week on Geck Inspect'
    when 'waitlist_signup'        then 'New waitlist signup'
    when 'market_alert'           then 'Watchlist match'
    when 'market_brief'           then 'Your crested gecko market today'
    when 'vet_followup'           then 'Vet follow-up'
    when 'account_deletion_request' then 'Account deletion request'
    when 'task_reminder'          then 'Task reminder'
    when 'support_reply'          then 'Reply from Geck Inspect support'
    else 'Geck Inspect'
  end;
  v_body := coalesce(NEW.content, '');
  v_link := coalesce(NEW.link, '/');

  v_headers := jsonb_build_object(
    'Content-Type',  'application/json',
    'Authorization', 'Bearer ' || v_key
  );

  v_payload := jsonb_build_object(
    'user_email', NEW.user_email,
    'type',       NEW.type,
    'title',      v_title,
    'body',       v_body,
    'url',        v_link,
    'tag',        NEW.type
  );

  begin
    perform net.http_post(url := v_push_url, headers := v_headers, body := v_payload);
  exception when others then
    raise warning 'notify_dispatch_on_insert: send-push pg_net call failed: %', sqlerrm;
  end;

  begin
    perform net.http_post(url := v_email_url, headers := v_headers, body := v_payload);
  exception when others then
    raise warning 'notify_dispatch_on_insert: send-email pg_net call failed: %', sqlerrm;
  end;

  return NEW;
end;
$function$;

-- ===== 20261003220100_anon_hide_owner_email_columns =====
-- Owner emails off public gecko rows, step 2 of 2. NOT YET APPLIED.
--
-- BREAKING for any client that still reads geckos or gecko_images with
-- `select *` while signed out: Postgres refuses the whole query once a
-- column in it is not granted. Apply this only after the client that reads
-- explicit column lists (src/lib/publicColumns.js) is live in production.
-- Step 1 is 20261002220914_owner_profile_id_for_public_rows.sql.
--
-- After this, a signed-out visitor can read every column of a public gecko
-- or a gecko photo except:
--   geckos.created_by          (the owner's email)
--   gecko_images.created_by    (the uploader's email)
--   gecko_images.user_id       (some rows hold an email here too)
--   gecko_images.training_meta (the reviewer's email sits inside it)
--   gecko_images.image_embedding (large, and no public page uses it)
-- Signed-in members keep full access; their row rules are unchanged.
-- Columns added to these tables later are not readable when signed out
-- until they are granted here and listed in src/lib/publicColumns.js.
--
-- The column lists below must match src/lib/publicColumns.js. A unit test
-- (src/lib/__tests__/publicColumns.test.js) checks that they do.

revoke select on public.geckos from anon;
revoke select (created_by) on public.geckos from anon;
grant select (
  id, name, species, hatch_date, sex, sire_id, dam_id,
  sire_name, dam_name, morphs_traits, morph_tags, notes, status,
  image_urls, gecko_id_code, display_order, asking_price,
  weight_grams, market_price_estimate, morphmarket_id, morphmarket_url,
  palm_street_id, palm_street_url, marketplace_description, is_public,
  gallery_display, image_crop_data, incubation_days, archived,
  archived_date, archive_reason, feeding_group_id, is_gravid,
  gravid_since, egg_drop_date, created_date, updated_date,
  passport_code, pattern_grade, genetics_notes, breeder_name,
  breeder_user_id, hatch_facility, listing_price, estimated_hatch_year,
  collection_id, quality_score, last_meaningful_change_at, tail_status,
  growth_slideshow_enabled, sold_price, sale_category, owner_profile_id
) on public.geckos to anon;

revoke select on public.gecko_images from anon;
revoke select (created_by, user_id, training_meta, image_embedding) on public.gecko_images from anon;
grant select (
  id, image_url, perceptual_hash, primary_morph, secondary_morph,
  secondary_traits, base_color, pattern_intensity, white_amount,
  confidence_score, notes, verified, age_estimate, fired_state,
  annotations, created_date, updated_date,
  embedding_model, embedding_date, embedding_status,
  embedding_attempts, embedding_error, owner_profile_id
) on public.gecko_images to anon;

-- ===== 20261003220200_anon_hide_email_columns_more =====
-- Owner emails off signed-out pages, part 2, step 2 of 2. NOT YET APPLIED.
--
-- BREAKING for any client that still reads these tables with `select *`
-- while signed out: Postgres refuses the whole query once a column in it
-- is not granted. Apply this only after the client that reads explicit
-- column lists (src/lib/publicColumns.js) is live in production, and after
-- 20261003220100_anon_hide_owner_email_columns.sql (geckos and photos).
-- Step 1 is 20261003022738_owner_profile_id_forum_store_welcome.sql.
--
-- A scan as the anon role on 3 Oct 2026 found email addresses readable by
-- signed-out visitors in 16 tables and in welcome_shelf(). After this:
--
-- 1. Signed-out visitors cannot read these tables at all. No signed-out
--    page reads them: user_activity, gecko_likes, questions, answers,
--    morph_traits, morph_price_cache.
-- 2. On the tables signed-out pages do read, they get every column except
--    the ones holding an email (created_by, owner_email, user_email,
--    uploader_email). Pages say who wrote a post or owns a store page with
--    owner_profile_id instead.
-- 3. Signed-in members lose other members' emails where nothing in the app
--    needs them: user_activity and gecko_likes rows are limited to the
--    member's own, and the email columns of gecko_of_the_day, questions
--    and answers are not readable by members either.
-- 4. welcome_shelf() stops returning the email key to signed-in callers
--    too. The new client looks follows up by profile id.
--
-- Columns added to these tables later are not readable when signed out
-- until they are granted here and listed in src/lib/publicColumns.js.
-- The column lists below must match src/lib/publicColumns.js. A unit test
-- (src/lib/__tests__/publicColumns.test.js) checks that they do.

-- ---------------------------------------------------------------------------
-- 1. Tables signed-out visitors do not need
-- ---------------------------------------------------------------------------
revoke select on public.user_activity from anon;
revoke select on public.gecko_likes from anon;
revoke select on public.questions from anon;
revoke select on public.answers from anon;
revoke select on public.morph_traits from anon;
revoke select on public.morph_price_cache from anon;

-- ---------------------------------------------------------------------------
-- 2. Signed-out column grants
-- ---------------------------------------------------------------------------
revoke select on public.forum_posts from anon;
grant select (
  id, title, content, category_id, author_name, image_urls,
  is_pinned, is_locked, view_count, created_date, updated_date,
  owner_profile_id
) on public.forum_posts to anon;

revoke select on public.forum_comments from anon;
grant select (
  id, post_id, content, author_name, image_urls, parent_comment_id,
  created_date, updated_date, owner_profile_id
) on public.forum_comments to anon;

revoke select on public.forum_likes from anon;
grant select (
  id, target_id, target_type, created_date, updated_date
) on public.forum_likes to anon;

revoke select on public.forum_categories from anon;
grant select (
  id, name, description, order_position, is_active, created_date,
  updated_date
) on public.forum_categories to anon;

revoke select on public.care_guide_sections from anon;
grant select (
  id, title, content, order_position, category, image_urls,
  is_published, source_url, last_updated, created_date, updated_date
) on public.care_guide_sections to anon;

revoke select on public.morph_guides from anon;
grant select (
  id, morph_name, description, key_features, example_image_url,
  rarity, breeding_info, created_date, updated_date
) on public.morph_guides to anon;

revoke select on public.page_config from anon;
grant select (
  id, page_name, display_name, category, icon, is_enabled,
  requires_auth, order_position, created_date, updated_date, section
) on public.page_config to anon;

revoke select on public.gecko_of_the_day from anon;
grant select (
  id, date, gecko_image_id, appreciative_message, created_date,
  updated_date
) on public.gecko_of_the_day to anon;

revoke select on public.breeder_store_pages from anon;
grant select (
  id, slug, title, tagline, description, header_image_url,
  contact_link, secondary_link, is_published, created_date,
  updated_date, policies, external_links, featured_gecko_ids,
  featured_breeding_plan_ids, slug_changed_at, slug_change_count,
  owner_profile_id
) on public.breeder_store_pages to anon;

revoke select on public.breeding_plans from anon;
grant select (
  id, sire_id, dam_id, breeding_id, pairing_date, copulation_events,
  egg_check_day, egg_check_count, first_egg_lay_date,
  expected_lay_interval, laying_active, dormant_since, status, notes,
  archived, archived_date, breeding_season, is_public, created_date,
  updated_date
) on public.breeding_plans to anon;

revoke select on public.feeding_records from anon;
grant select (
  id, animal_id, date, food_type, accepted, notes,
  created_date, updated_date
) on public.feeding_records to anon;

revoke select on public.shed_records from anon;
grant select (
  id, animal_id, date, quality, notes, created_date,
  updated_date
) on public.shed_records to anon;

revoke select on public.vet_records from anon;
grant select (
  id, animal_id, date, vet_name, reason, findings, treatment,
  follow_up, attachments, created_date, updated_date
) on public.vet_records to anon;

revoke select on public.ownership_records from anon;
grant select (
  id, animal_id, owner_user_id, owner_name, owner_avatar_url,
  acquired_date, transfer_method, sale_price, contributed_to_market_data,
  notes, created_date, updated_date
) on public.ownership_records to anon;

-- ---------------------------------------------------------------------------
-- 3. Signed-in members
-- ---------------------------------------------------------------------------

-- Activity points: a member reads their own rows; admins read all (the
-- admin user page). GeckoForm's insert reads back its own row, which this
-- still allows.
drop policy if exists "user_activity_read_all" on public.user_activity;
drop policy if exists "user_activity_read_own" on public.user_activity;
create policy "user_activity_read_own" on public.user_activity
  for select to authenticated
  using (
    user_email = (select auth.email())
    or created_by = (select auth.email())
    or public.is_admin()
  );

-- Photo likes: nothing in the app reads them today. A member sees the
-- likes they gave and the likes on their own photos.
drop policy if exists "gecko_likes_read_all" on public.gecko_likes;
drop policy if exists "gecko_likes_read_own" on public.gecko_likes;
create policy "gecko_likes_read_own" on public.gecko_likes
  for select to authenticated
  using (
    user_email = (select auth.email())
    or owner_email = (select auth.email())
    or created_by = (select auth.email())
    or public.is_admin()
  );

-- Gecko of the Day: nobody in the app needs the uploader's email (the
-- Dashboard reads GECKO_OF_THE_DAY_COLUMNS for everyone). Rows are written
-- by the server, not by members.
revoke select on public.gecko_of_the_day from authenticated;
grant select (
  id, date, gecko_image_id, appreciative_message, created_date,
  updated_date
) on public.gecko_of_the_day to authenticated;

-- Questions and answers: no page reads these tables yet.
revoke select on public.questions from authenticated;
grant select (
  id, author_id, title, body, tags, status, best_answer_id, view_count,
  upvote_count, is_featured, created_date, updated_date
) on public.questions to authenticated;

revoke select on public.answers from authenticated;
grant select (
  id, question_id, author_id, body, upvote_count, is_best_answer,
  created_date, updated_date
) on public.answers to authenticated;

-- ---------------------------------------------------------------------------
-- 4. New keepers rail without email addresses
-- ---------------------------------------------------------------------------
create or replace function public.welcome_shelf(p_limit integer default 6)
returns json
language sql
stable
security definer
set search_path to 'public'
as $$
SELECT coalesce(json_agg(row_to_json(rows) ORDER BY rows.created_date DESC), '[]'::json)
FROM (
  SELECT
    p.id::text AS id,
    coalesce(nullif(p.full_name, ''), nullif(p.business_name, ''), 'Geck Inspect keeper') AS display_name,
    p.profile_image_url,
    p.created_date
  FROM public.profiles p
  WHERE p.created_date IS NOT NULL
    AND coalesce(p.is_public_profile, true) = true
    AND p.created_date > now() - interval '7 days'
  ORDER BY p.created_date DESC
  LIMIT p_limit
) rows;
$$;

-- ===== 20261003220300_waitlist_require_confirmation =====
-- NOT APPLIED YET. Apply only after the client with the waitlist-signup
-- edge function is live and that function is deployed (audit step 33).
--
-- Closes the old signup path. join_waitlist() lets anyone put any email
-- address on a list with no confirmation. The new page signs up through
-- the waitlist-signup edge function instead, which emails a confirmation
-- link. Until this runs, the old deployed page (and anyone calling the
-- function directly) can still skip confirmation.
--
-- Applying it before the new client ships would break signups on the
-- deployed page, which still calls join_waitlist().

revoke execute on function public.join_waitlist(text, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.join_waitlist(text, text, text, text, text, boolean) to service_role;

insert into supabase_migrations.schema_migrations (version, name) values
  ('20261003220000', 'account_erasure'),
  ('20261003220100', 'anon_hide_owner_email_columns'),
  ('20261003220200', 'anon_hide_email_columns_more'),
  ('20261003220300', 'waitlist_require_confirmation')
on conflict (version) do nothing;

commit;

-- Checks. Each row should say true.
select 'erase function exists' as check, exists (select 1 from pg_proc where proname = 'admin_erase_account') as ok
union all
select 'signed-out visitors cannot run it', not has_function_privilege('anon', 'public.admin_erase_account(text)', 'execute')
union all
select 'members cannot run it', not has_function_privilege('authenticated', 'public.admin_erase_account(text)', 'execute')
union all
select 'signed-out cannot read gecko owner email', not has_column_privilege('anon', 'public.geckos', 'created_by', 'select')
union all
select 'signed-out cannot read forum author email', not has_column_privilege('anon', 'public.forum_posts', 'created_by', 'select');

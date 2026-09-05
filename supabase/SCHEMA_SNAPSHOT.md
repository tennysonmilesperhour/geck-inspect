# Production schema snapshot (documentation only)

> Writing a migration or a new entity? Read
> [SCHEMA_CONVENTIONS.md](./SCHEMA_CONVENTIONS.md) first: legacy tables use
> TEXT ids and `created_date` / `created_by`, and merging a migration does
> not apply it to production. How migrations are actually managed is in
> [docs/MIGRATIONS.md](../docs/MIGRATIONS.md).

Snapshot date: 2026-09-05 (baseline and summary refreshed; detailed table
inventory below remains the 4 September catalog).
Project: `mmuglfphhwlaluyfyxsp` (Geck Inspect). Previous snapshot: 2026-07-07.

This file is DOCUMENTATION, not a migration. Do not apply it. It was
generated from the live catalog with the queries under "How to
regenerate", through the Supabase MCP (no database password needed).

> The runnable schema baseline is
> `migrations/20260410025954_remote_schema.sql`. It contains the live
> `public` and `geck_data` schemas; later root-level migrations carry the
> changes made after that dump.

## At a glance

| Item | Value |
|---|---|
| Tables in `public` | 112 (45 with TEXT ids, 63 with UUID ids, 4 keyed some other way) |
| Tables in `geck_data` | 54 tables plus 27 views (the market data platform, consolidated 4 Sep 2026) |
| Every `public` table has RLS enabled | yes (one, `revenuecat_webhook_events`, has RLS on with no policy, so only the service role can touch it) |
| Functions in `public` | 66 |
| Views in `public` | external_reference_images, listing_images, market_listings, morph_taxonomy (compatibility views over `geck_data`), promote_image_usage, v_daily_activity |
| Enum types | blog_post_status, store_fulfillment_mode, store_fulfillment_status, store_order_status, store_pricing_constraint, store_product_status, store_shipping_class |
| Extensions | pg_cron 1.6.4, pg_net 0.20.0, pg_stat_statements 1.11, pgcrypto 1.3, supabase_vault 0.3.1, uuid-ossp 1.1, vector 0.8.0 |
| Storage buckets | geck-inspect-media (public), listing-images (public), promote-images (public), archive-listing-images (private), raw-uploads (private) |
| Migration history entries | 131 (latest version 20260905151309) |

### Scheduled jobs (pg_cron)

| Job | Schedule (UTC) | What it does |
|---|---|---|
| process-scheduled-blog-posts | every minute | publishes blog posts whose scheduled_at has passed |
| promote_drain_scheduled | every minute | publishes due social posts |
| prune-stale-push-subscriptions | 03:17 daily | drops dead web-push endpoints |
| expire-referral-grants | 04:30 daily | returns lapsed referral Keeper months to free |
| hatch-alerts-daily | 13:00 daily | writes hatch-window notifications |
| weighin-reminders-weekly | 15:00 Sundays | writes weigh-in reminders |
| monthly-overage-billing | 02:00 on the 1st | calls report-social-overage for Social Media Manager overage |
| weekly-digest-sunday | 16:00 Sundays | writes one weekly collection summary notification per active keeper |

### Triggers

| Table | Trigger | Function | Purpose |
|---|---|---|---|
| auth.users | on_auth_user_created | handle_new_auth_user | creates the profiles row for a new account |
| profiles | profiles_protect_privileged_columns | protect_profile_privileged_columns | regular users cannot change role, tier, billing columns |
| profiles | profiles_protect_referral_columns | protect_profile_referral_columns | regular users cannot change referral columns |
| profiles | profiles_set_referral_code | set_default_referral_code | every new profile gets a referral code |
| notifications | notifications_guard_user_insert | guard_notification_insert | user inserts are attributed to the caller, links sanitised |
| notifications | notifications_send_dispatch | notify_dispatch_on_insert | fans a notification out to email and push through the Vault secret |
| error_logs | error_logs_throttle | throttle_error_logs | 20 per reporter and 200 overall per minute |
| geckos | geckos_bump_change_ts, geckos_set_default_collection_trg, trg_cleanup_transfer_requests | (same names) | last_meaningful_change_at, default collection, transfer cleanup on delete |
| gecko_images, weight_records | *_bump_parent | trg_bump_gecko_from_* | bump the parent gecko's change timestamp |
| other_reptiles | trg_cleanup_transfer_requests | cleanup_transfer_requests_on_animal_delete | transfer cleanup on delete |
| collection_members | collection_members_bump_parent | bump_collection_updated_at | |
| store_products | store_products_search_trg | store_products_update_search_vector | full-text search vector |
| admin_tasks, app_settings, blog_*, testimonials | *_touch / set_*_updated_at | | updated_at maintenance |

### Functions callable without signing in (anon)

community_feed, community_gecko_counts, gecko_image_stats,
gecko_passport_is_public, get_transfer_preview, is_admin, is_blog_admin,
is_collection_editor, is_collection_member, is_collection_owner,
is_expert_reviewer, landing_stats, listing_images, month_key_now,
welcome_shelf. All are intentional (landing page, community pages, RLS
helpers, the public claim page). Audit batch A (4 Sep) revoked the rest.

## Core tables (public schema)

Column lists are complete as of the snapshot date. `id TEXT` tables are
Base44-era legacy tables; see SCHEMA_CONVENTIONS.md.

### geckos (id TEXT) 51 columns, about 330 rows
name, species, hatch_date, sex, sire_id, dam_id, sire_name, dam_name,
morphs_traits (legacy text), morph_tags (jsonb), notes, status,
image_urls (jsonb), gecko_id_code, display_order, asking_price,
weight_grams, market_price_estimate (jsonb), morphmarket_id,
morphmarket_url, palm_street_id, palm_street_url, marketplace_description,
is_public, gallery_display, image_crop_data (jsonb), incubation_days,
archived, archived_date, archive_reason, feeding_group_id, is_gravid,
gravid_since, egg_drop_date, passport_code, pattern_grade, genetics_notes,
breeder_name, breeder_user_id (uuid), hatch_facility, listing_price,
estimated_hatch_year, collection_id (uuid), quality_score numeric(3,1),
last_meaningful_change_at, tail_status, growth_slideshow_enabled,
created_by (email), created_date, updated_date

### profiles (id TEXT, keyed by email) 74 columns, 121 rows
email, full_name, role, membership_tier, membership_billing_cycle,
membership_expires_at, profile_image_url, cover_image_url, bio, location,
city, state_province, country, region, business_name, website_url,
instagram_handle, facebook_url, youtube_url, tiktok_handle, is_expert,
is_public_profile, sidebar_badge_preference, looking_for (jsonb),
privacy_show_collection, privacy_show_activity, notifications_email,
notifications_follows, notifications_messages, notifications_marketplace,
notifications_following_activity, email_on_new_follower,
email_on_new_message, email_on_following_activity, morphmarket_username,
morphmarket_sync_enabled, palm_street_username, palm_street_sync_enabled,
stripe_customer_id, stripe_subscription_id, subscription_status,
total_points, hatch_alert_days, default_breeding_sort, extra_data (jsonb),
is_featured_breeder, store_policy, paid_membership_started_at,
cgd_reorder_reminders_enabled, cgd_reorder_grams_per_gecko_per_week,
cgd_reorder_last_reminder_at, cgd_reorder_last_estimated_runout_at,
push_notifications_enabled, push_notification_types (text[]),
email_notifications_enabled, email_notification_types (text[]), ui_theme,
ui_secondary, social_post_credits, keeper_trial_used,
keeper_trial_started_at, social_brand_voice_default,
morph_id_show_value_estimate, show_breeders_publicly, free_trial_used,
free_trial_started_at, referral_code, referred_by, referral_signup_count,
referral_grant_until, created_by, created_date, updated_date

`profiles.id` does NOT match `auth.users.id` (only one row does). Every
join to a profile goes through `email`.

### gecko_images (id TEXT) 23 columns, about 3,800 rows
image_url, user_id (text), perceptual_hash, primary_morph, secondary_morph,
secondary_traits (jsonb), base_color, pattern_intensity, white_amount,
confidence_score, notes, verified, age_estimate, fired_state,
annotations (jsonb), training_meta (jsonb), image_embedding vector(768),
embedding_model, embedding_date, created_by, created_date, updated_date

### breeding_plans (id TEXT) 21 columns
sire_id, dam_id, breeding_id, pairing_date, copulation_events (jsonb),
egg_check_day, egg_check_count, first_egg_lay_date, expected_lay_interval,
laying_active, dormant_since, status, notes, archived, archived_date,
breeding_season, is_public, created_by, created_date, updated_date

### eggs (id TEXT) 12 columns
breeding_plan_id, lay_date, hatch_date_expected, hatch_date_actual, status,
gecko_id, archived, archived_date, created_by, created_date, updated_date

### weight_records (id TEXT) 8 columns
gecko_id, weight_grams, record_date, notes, created_by, created_date,
updated_date

### shed_records (id UUID)
animal_id (text), logged_by (uuid), date, quality, notes, created_by,
created_date, updated_date

### ownership_records (id UUID)
animal_id (text), owner_user_id (uuid), owner_name, owner_avatar_url,
acquired_date, transfer_method, sale_price, contributed_to_market_data,
notes, created_by, created_date, updated_date

### transfer_requests (id UUID)
animal_id (text), animal_type, from_user_id (uuid), to_email, to_user_id,
token, status, sale_price, message, claimed_at, expires_at, created_by,
created_date, updated_date

### notifications (id TEXT) about 630 rows
user_email, type, content, is_read, link, metadata (jsonb), created_by,
created_date, updated_date. Types in use: hatch_alert, feeding_due,
announcement, level_up, future_breeding_ready, weighin_reminder,
referral_reward, referral_grant_ended.

### referral_rewards (id UUID) added 4 Sep 2026
referrer_email, referred_email (unique), referred_tier,
referrer_tier_at_award, referrer_stripe_customer_id, reward_kind
(keeper_month | stripe_credit | needs_manual), grant_until, amount_cents,
currency, stripe_invoice_id, stripe_balance_transaction_id, applied_at,
note, created_date

## RLS policies on core tables (as deployed, 4 Sep 2026)

All policies now use init-plan wrappers such as `(select auth.email())`
and `(select auth.uid())`, so auth calls run once per query rather than
once per row. The F46 consolidation is complete in both `public` and
`geck_data`; no duplicate permissive policy groups remain from the
audited batches.

| Table | Policy | Cmd | Rule |
|---|---|---|---|
| geckos | geckos_read_all | SELECT | `true` (everyone, including anon) |
| geckos | geckos_insert_own | INSERT | `auth.email() = created_by` |
| geckos | geckos_update_own | UPDATE | owner or `is_collection_editor(collection_id, email)` |
| geckos | geckos_delete_own | DELETE | owner or collection editor |
| profiles | profiles_read_all | SELECT | `true` (everyone, including anon) |
| profiles | profiles_insert_own | INSERT | `auth.email() = email OR created_by` (trigger forces free-tier defaults) |
| profiles | profiles_update_own | UPDATE | same (trigger reverts privileged and referral columns) |
| profiles | profiles_update_admin | UPDATE | admin role |
| profiles | profiles_delete_admin | DELETE | admin role |
| gecko_images | gecko_images public read + gecko_images_read_all | SELECT | `true` (duplicate pair) |
| gecko_images | gecko_images authenticated insert + gecko_images_insert_own | INSERT | `verified IS NOT TRUE` / owner (duplicate pair) |
| gecko_images | owner update, reviewer update, gecko_images_update_own | UPDATE | owner while unverified; admin or expert_reviewer; owner or admin |
| gecko_images | admin delete + gecko_images_delete_own | DELETE | admin / owner or admin |
| breeding_plans | breeding_plans_read | SELECT | owner, `is_public`, or admin |
| breeding_plans | insert / update / delete own | I/U/D | owner (admin may update and delete) |
| eggs | eggs_read, eggs_write_own, eggs_update_own, eggs_delete_own | S/I/U/D | owner (admin may read) |
| weight_records | read, write_own, update_own, delete_own | S/I/U/D | owner (admin may read) |
| shed_records, vet_records, feeding_records | *_read | SELECT | author, logged_by (feeding), admin, or `gecko_passport_is_public(animal_id)` |
| shed_records, vet_records, feeding_records | Users manage own ... | ALL | `created_by = jwt email` |
| ownership_records | ownership_records_read | SELECT | author, owner_user_id, admin, or public passport |
| ownership_records | Users manage own ownership records | ALL | `created_by = jwt email` |
| transfer_requests | Sender and recipient read | SELECT | created_by or to_email (case-insensitive) |
| transfer_requests | Users manage own transfer requests | ALL | `created_by = jwt email` |
| direct_messages | read_own / update_own | SELECT / UPDATE | sender or recipient |
| direct_messages | insert | INSERT | sender (or admin) |
| direct_messages | delete_own (authenticated) + unsend window | DELETE | sender, recipient or admin / sender within 5 minutes |
| notifications | notifications_read_own / update_own | SELECT / UPDATE | `auth.email() = user_email` |
| notifications | notifications_insert_any_authed | INSERT | signed in; guard trigger attributes the row to the caller |
| notifications | notifications_delete_admin | DELETE | admin role |
| referral_rewards | Referrers read their rewards | SELECT | `referrer_email = auth.email()` (authenticated only; writes are server-side) |

## Findings worth knowing

1. `profiles` is readable by everyone (`profiles_read_all`, `USING (true)`).
   The API-key columns were dropped on 2026-06-10. `stripe_customer_id`
   and `stripe_subscription_id` remain readable; they are opaque without
   the Stripe secret key. Standing rule: never store secrets on
   `profiles`. The app selects only display columns for other members
   (F11, 4 Sep).
2. `geckos` is fully public-read at the RLS level; `is_public` and
   `gallery_display` are enforced by app code only.
3. Vet, feeding, shed and ownership records were world-readable until
   audit batch D (4 Sep); reads are now scoped to author, owner, admin, or
   a public passport.
4. Privileged profile columns (role, tier, billing, trial flags, referral
   columns) are protected by BEFORE triggers rather than by column-level
   grants, because PostgREST updates whole rows. The service role, direct
   database sessions and admins bypass the triggers. SECURITY DEFINER
   functions that need to write those columns set the transaction-local
   flag `geck.referral_bypass` (referral functions) because a definer
   function still carries the caller's JWT role.
5. `membership_expires_at` is written by the Stripe webhook and the store
   signup grant but nothing enforces it. Referral grants use their own
   column, `referral_grant_until`, which the daily cron does enforce.
6. `award_referral_signup_bonus` (Social Media Manager) still exists but
   is no longer called by the webhook; it reads columns the referral
   program never had. Safe to drop in a future cleanup.

## Entity/table reconciliation (2026-07-07, still accurate)

Every entity in `TABLE_MAP` (`src/api/supabaseEntities.js`) maps to a
table that exists in production. Timestamp-column exceptions that drive
`parseSort`: `collections` and `testimonials` use `created_at`;
`app_settings`, `collection_members` and `social_post_photo_usage` have no
timestamp column. Tables added since that audit and accessed directly
(no entity wrapper): `genetics_trait_overrides`, `pairing_outcome_logs`,
`referral_rewards`, `feature_credit_allotments`, `store_*` custom sticker
columns. `SocialReferralBonus` is mapped but the table is unused.

## Migration history versus repo files

See docs/MIGRATIONS.md. All 131 live history entries have matching
root-level files. The runnable baseline replaces the previously broken
chain; original SQL is retained under `_pre_rebaseline_history/`.

## How to regenerate

All of these run through the Supabase MCP `execute_sql` tool.

Tables with RLS state, policy count, column count and row estimate:
```sql
select c.relname as tbl,
       coalesce((select format_type(a.atttypid, a.atttypmod) from pg_attribute a
                 where a.attrelid=c.oid and a.attname='id' and not a.attisdropped), '(no id)') as id_type,
       c.relrowsecurity as rls,
       (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policies,
       (select count(*) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) as ncols,
       greatest(c.reltuples::bigint, 0) as est_rows
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p')
order by c.relname;
```

Columns for one table (swap the name):
```sql
select string_agg(a.attname||' '||format_type(a.atttypid, a.atttypmod)
       ||case when a.attnotnull then ' not null' else '' end, ', ' order by a.attnum)
from pg_attribute a where a.attrelid='public.geckos'::regclass and a.attnum>0 and not a.attisdropped;
```

Policies:
```sql
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname='public' order by tablename, cmd, policyname;
```

Functions, triggers, cron, extensions, buckets:
```sql
select p.proname, p.prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1;
select c.relname, t.tgname, p.proname from pg_trigger t join pg_class c on c.oid=t.tgrelid
  join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid
  where n.nspname in ('public','auth') and not t.tgisinternal order by 1,2;
select jobname, schedule, command from cron.job order by 1;
select extname, extversion from pg_extension order by 1;
select id, public from storage.buckets order by 1;
select version, name from supabase_migrations.schema_migrations order by 1;
```

## Appendix: full table inventory (112 tables, 2026-09-04)

Every table has RLS enabled. "Policies" is the number of RLS policies on
the table; "Rows" is the planner's estimate and is blank when the table is
empty or has never been analysed.

| Table | id type | Policies | Columns | Rows |
|---|---|---|---|---|
| admin_tasks | uuid | 2 | 16 |  |
| answers | uuid | 2 | 9 |  |
| app_settings | (no id, key) | 3 | 6 |  |
| blog_categories | uuid | 2 | 9 |  |
| blog_logs | uuid | 2 | 8 |  |
| blog_posts | uuid | 2 | 26 |  |
| blog_settings | uuid | 1 | 17 |  |
| blog_tags | uuid | 2 | 9 |  |
| breeder_inquiries | uuid | 3 | 14 |  |
| breeder_profiles | uuid | 2 | 17 |  |
| breeder_reviews | uuid | 2 | 12 |  |
| breeder_store_pages | uuid | 4 | 18 |  |
| breeding_loans | uuid | 2 | 23 |  |
| breeding_plans | text | 4 | 21 | 26 |
| breeding_projects | uuid | 2 | 26 |  |
| care_guide_sections | text | 2 | 12 |  |
| change_logs | text | 2 | 10 |  |
| classification_votes | text | 6 | 14 | 148 |
| clutches | uuid | 2 | 15 |  |
| collection_members | uuid | 4 | 11 |  |
| collection_valuations | uuid | 2 | 8 |  |
| collections | uuid | 3 | 7 | 26 |
| community_event_reactions | (no id) | 3 | 5 |  |
| direct_messages | text | 5 | 9 | 176 |
| eggs | text | 4 | 12 | 162 |
| error_logs | uuid | 4 | 14 | 51 |
| expert_actions | text | 2 | 7 |  |
| expert_verification_requests | text | 3 | 10 |  |
| feature_credit_allotments | (no id) | 1 | 3 |  |
| feature_usage | uuid | 1 | 9 |  |
| feeding_groups | text | 4 | 14 |  |
| feeding_records | uuid | 2 | 10 |  |
| forum_categories | text | 2 | 8 |  |
| forum_comments | text | 4 | 9 |  |
| forum_likes | text | 3 | 7 |  |
| forum_posts | text | 4 | 12 | 4 |
| future_breeding_plans | text | 4 | 12 |  |
| gecko_events | text | 4 | 9 |  |
| gecko_images | text | 9 | 23 | 3806 |
| gecko_likes | text | 3 | 7 |  |
| gecko_of_the_day | text | 2 | 9 |  |
| gecko_waitlist_signups | uuid | 2 | 6 |  |
| gecko_waitlists | uuid | 2 | 11 |  |
| geckos | text | 4 | 51 | 331 |
| genetic_outcome_predictions | uuid | 2 | 12 |  |
| genetics_trait_overrides | text | 1 | 5 |  |
| giveaway_entries | text | 3 | 5 |  |
| giveaways | text | 4 | 16 |  |
| iot_connections | uuid | 1 | 10 |  |
| lineage_placeholders | text | 4 | 11 |  |
| marketplace_costs | text | 4 | 9 |  |
| marketplace_likes | text | 3 | 6 |  |
| mentor_offers | uuid | 2 | 16 |  |
| morph_guide_comments | text | 3 | 13 |  |
| morph_guides | text | 2 | 10 | 64 |
| morph_id_usage | uuid | 1 | 8 |  |
| morph_price_cache | text | 2 | 10 |  |
| morph_price_entries | uuid | 2 | 16 |  |
| morph_reference_images | text | 3 | 9 |  |
| morph_traits | text | 2 | 11 | 53 |
| newsletter_subscribers | uuid | 2 | 9 |  |
| notifications | text | 4 | 10 | 629 |
| other_reptiles | text | 4 | 18 | 13 |
| ownership_records | uuid | 2 | 13 | 5 |
| page_config | text | 2 | 12 | 21 |
| pairing_outcome_logs | uuid | 1 | 15 |  |
| payment_events | text | 2 | 18 |  |
| pending_sales | uuid | 1 | 19 |  |
| price_alerts | uuid | 2 | 10 |  |
| profiles | text | 5 | 74 | 121 |
| projects | text | 4 | 13 |  |
| promote_images | uuid | 1 | 11 |  |
| push_subscriptions | uuid | 4 | 9 | 2 |
| question_votes | uuid | 2 | 7 |  |
| questions | uuid | 2 | 13 |  |
| referral_rewards | uuid | 1 | 15 |  |
| reptile_events | text | 4 | 9 | 95 |
| revenuecat_entitlements | uuid | 1 | 18 |  |
| revenuecat_webhook_events | (no id, event_id) | 0 | 5 |  |
| scraped_training_data | text | 1 | 16 |  |
| shed_records | uuid | 2 | 9 |  |
| shipping_orders | uuid | 3 | 20 |  |
| social_generation_log | uuid | 1 | 11 |  |
| social_platform_connections | uuid | 2 | 17 |  |
| social_post_photo_usage | uuid | 1 | 7 |  |
| social_post_usage | uuid | 1 | 14 |  |
| social_post_variants | uuid | 1 | 15 |  |
| social_posts | uuid | 1 | 17 |  |
| social_referral_bonuses | uuid | 1 | 13 |  |
| store_affiliate_clicks | uuid | 2 | 9 |  |
| store_cart_items | uuid | 1 | 8 |  |
| store_carts | uuid | 1 | 9 |  |
| store_categories | uuid | 2 | 15 |  |
| store_fulfillments | uuid | 2 | 12 |  |
| store_order_items | uuid | 2 | 14 |  |
| store_orders | uuid | 3 | 23 |  |
| store_products | uuid | 2 | 38 | 101 |
| store_promo_codes | uuid | 2 | 14 |  |
| store_signup_grants | uuid | 1 | 13 |  |
| store_vendors | uuid | 2 | 12 |  |
| stripe_webhook_logs | text | 1 | 10 |  |
| support_messages | text | 4 | 14 |  |
| tasks | text | 4 | 18 |  |
| testimonials | uuid | 3 | 14 |  |
| transfer_requests | uuid | 2 | 15 |  |
| user_activity | text | 2 | 8 | 188 |
| user_badges | text | 2 | 11 |  |
| user_brand_voice | uuid | 1 | 7 |  |
| user_events | uuid | 2 | 8 | 5816 |
| user_follows | text | 3 | 6 |  |
| vet_records | uuid | 2 | 12 |  |
| weight_records | text | 4 | 8 | 393 |

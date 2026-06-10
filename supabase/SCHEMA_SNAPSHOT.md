# Production schema snapshot (documentation only)

Snapshot date: 2026-06-10. Project: `mmuglfphhwlaluyfyxsp` (Geck Inspect).

This file exists because eight early migrations are empty "remote-only
snapshot" placeholders, so the repo could not previously tell you what
schema or RLS the core tables actually have. This is DOCUMENTATION, not
a migration. Do not apply it. Regenerate with the queries at the bottom.

## Tables (public schema)

96 tables. The most-touched core tables and their key columns:

### geckos (id TEXT, Base44 legacy ids)
name, species, hatch_date, sex, sire_id, dam_id, sire_name, dam_name,
morphs_traits (legacy text), morph_tags (jsonb array), notes, status,
image_urls (jsonb), gecko_id_code, display_order, asking_price,
weight_grams, market_price_estimate (jsonb), morphmarket_id/url,
palm_street_id/url, marketplace_description, is_public, gallery_display,
image_crop_data (jsonb), incubation_days, archived, archived_date,
archive_reason, feeding_group_id, is_gravid, gravid_since, egg_drop_date,
passport_code, pattern_grade, genetics_notes, breeder_name,
breeder_user_id (uuid), hatch_facility, listing_price,
estimated_hatch_year, collection_id (uuid), quality_score,
last_meaningful_change_at, tail_status, growth_slideshow_enabled,
created_by (email), created_date, updated_date

### profiles (id TEXT, keyed by email)
email, full_name, role, membership_tier, membership_billing_cycle,
membership_expires_at, profile/cover image urls, bio, location fields,
business_name, social handles, is_expert, is_public_profile,
privacy_* and notifications_* flags, morphmarket_username,
morphmarket_api_key, morphmarket_sync_enabled, palm_street_username,
palm_street_api_key, palm_street_sync_enabled, stripe_customer_id,
stripe_subscription_id, subscription_status, total_points,
hatch_alert_days, default_breeding_sort, extra_data (jsonb),
is_featured_breeder, store_policy, paid_membership_started_at,
cgd_reorder_* fields, push_notifications_enabled,
push_notification_types, email_notifications_enabled,
email_notification_types, ui_theme, ui_secondary, social_post_credits,
keeper_trial_used/started_at, social_brand_voice_default,
morph_id_show_value_estimate, show_breeders_publicly

### gecko_images (id TEXT)
image_url, user_id, perceptual_hash, primary_morph, secondary_morph,
secondary_traits (jsonb), base_color, pattern_intensity, white_amount,
confidence_score, notes, verified, age_estimate, fired_state,
annotations (jsonb), training_meta (jsonb), image_embedding (vector),
embedding_model, embedding_date, created_by

### breeding_plans (id TEXT)
sire_id, dam_id, breeding_id, pairing_date, copulation_events (jsonb),
egg_check_day, egg_check_count, first_egg_lay_date,
expected_lay_interval, laying_active, dormant_since, status, notes,
archived, archived_date, breeding_season, is_public, created_by

### eggs (id TEXT)
breeding_plan_id, lay_date, hatch_date_expected, hatch_date_actual,
status, gecko_id, archived, archived_date, created_by

### weight_records (id TEXT)
gecko_id, weight_grams, record_date, notes, created_by

### shed_records (id UUID)
animal_id (text), logged_by (uuid), date, quality, notes, created_by

### ownership_records (id UUID)
animal_id (text), owner_user_id (uuid), owner_name, owner_avatar_url,
acquired_date, transfer_method, sale_price,
contributed_to_market_data, notes, created_by

Full column list for all 96 tables: run query 1 below.

## RLS policies on core tables (as deployed)

| Table | Policy | Cmd | Rule |
|---|---|---|---|
| geckos | geckos_read_all | SELECT | `true` (everyone, including anon) |
| geckos | geckos_insert_own | INSERT | `auth.email() = created_by` |
| geckos | geckos_update_own | UPDATE | owner or `is_collection_editor(collection_id, auth.email())` |
| geckos | geckos_delete_own | DELETE | owner or collection editor |
| profiles | profiles_read_all | SELECT | `true` (everyone, including anon) |
| profiles | profiles_insert_own / update_own | INSERT/UPDATE | `auth.email() = email OR created_by` |
| profiles | profiles_delete_admin | DELETE | admin role |
| morph_guides | read_all / write_admin | SELECT / ALL | public read; admin write |
| gecko_images | public read | SELECT | `true` |
| gecko_images | authenticated insert | INSERT | `verified IS NOT TRUE` |
| gecko_images | owner update | UPDATE | owner, only while unverified |
| gecko_images | reviewer update | UPDATE | admin or expert_reviewer role |
| breeding_plans | read | SELECT | owner, `is_public`, or admin |
| breeding_plans | insert/update/delete own | C/U/D | owner (admin for U/D) |
| eggs | read / write / update / delete own | all | owner (admin can read) |
| weight_records | read / write / update / delete own | all | owner (admin can read) |
| direct_messages | read/update own | SELECT/UPDATE | sender or recipient |
| direct_messages | insert | INSERT | sender (or admin) |
| direct_messages | unsend window | DELETE | sender, within 5 minutes |
| notifications | read/update own | SELECT/UPDATE | `auth.email() = user_email` |
| error_logs | anyone can report | INSERT | `true` (anon + authenticated) |
| error_logs | admin read/update/delete | S/U/D | admin role |
| user_events | anyone can record | INSERT | `true` |
| user_events | admins can read | SELECT | admin role |
| classification_votes | read | SELECT | authenticated `true` (plus owner/admin policy) |
| morph_price_entries | public read / owner manage | SELECT / ALL | `true` / owner |

## Findings worth knowing

1. SECURITY (RESOLVED 2026-06-10): `profiles` is readable by EVERYONE
   (`profiles_read_all`, `USING (true)`, role `public`) and carried
   Base44-era `morphmarket_api_key` and `palm_street_api_key` columns.
   Verified no code referenced them and all 93 rows held NULL, then
   dropped both columns (migration
   `20260610120000_drop_public_api_key_columns.sql`, applied to prod).
   Standing rule: never store secrets on `profiles`; it is public-read
   by design. `stripe_customer_id` / `stripe_subscription_id` remain
   (opaque identifiers, unusable without the Stripe secret key, and
   billing flows depend on them) but are also public-read; move them
   behind an owner-only view if that ever becomes uncomfortable.
2. `geckos` is fully public-read at RLS level; `is_public` and
   `gallery_display` are enforced by app code only. Acceptable for a
   community gallery, but know that "private" geckos are private by
   convention, not by policy.
3. `gecko_images` insert requires only `verified IS NOT TRUE`; rows are
   not forced to carry the inserter's email at the policy level
   (created_by check exists on the legacy `public`-role policy pair).

## How to regenerate

Query 1 (columns):
```sql
select table_name, string_agg(column_name || ' ' || data_type ||
  case when is_nullable='NO' then ' NOT NULL' else '' end,
  E'\n  ' order by ordinal_position) as cols
from information_schema.columns
where table_schema='public'
group by table_name order by table_name;
```

Query 2 (RLS):
```sql
select tablename, policyname, cmd, qual, with_check, roles
from pg_policies where schemaname='public'
order by tablename, policyname;
```

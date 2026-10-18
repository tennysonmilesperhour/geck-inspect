# Infrastructure that lives in production

What Geck Inspect runs on that the repository cannot rebuild by itself, and how the parts the repository does hold reach production.

How this was checked: read-only queries against the production database (`mmuglfphhwlaluyfyxsp`) and its edge function list on 16 October 2026, plus a file-by-file comparison of each hand-deployed function's live code with the repo copy. Secret values were never read; only names. Re-run the queries in section 8 before relying on a number here.

## 1. How a change reaches production

A merge to `main` sets off three things at once, in no guaranteed order, usually within a minute:

1. **Vercel** builds and deploys the site from that commit.
2. **The Supabase GitHub integration applies new migration files.** Every root-level file in `supabase/migrations/` whose version production's history does not have yet runs, in filename order, and is recorded under the file's own version. On 16 October 2026 the newest recorded version was `20261015233100_guard_switches`.
3. **The same integration deploys the edge functions declared in `supabase/config.toml`**, each with the `verify_jwt` setting written there. A function with no `[functions.<name>]` block is never touched by a merge; it keeps whatever was last deployed by hand.

Members keep old copies of the app open for hours, so every change has to work when the new database meets the old app and when the new app meets the old database (`docs/MIGRATIONS.md` explains how).

A migration file must never be dated earlier than a version production has already recorded. The Supabase tools refuse to apply a file that sorts before something already applied (MIGRATIONS.md, "Never date it in the future"). Check the newest recorded version (query 8.1) before naming a new file.

## 2. Edge functions

Production runs 34 functions. 30 are declared in `supabase/config.toml` (15 since round 1 and 2, and 15 more on 16 October 2026 after their live code was compared with the repo), so a merge deploys them. The repo also holds two functions that have never been deployed.

| Function | verify_jwt | Declared | Who calls it |
|---|---|---|---|
| admin-delete-account | true | yes | A signed-in admin erasing an account |
| admin-end-trial | true | no | Admin tool; not in use. Tennyson is deleting it |
| csp-report | false | yes | Browsers posting Content-Security-Policy reports |
| delete-my-account | true | yes | A member deleting their own account in Settings |
| email-unsubscribe | false | yes | One-click unsubscribe from mail apps (signed link); with `&scope=weekly` it stops only Weekly Gecko Notes; with `&scope=visitor` it stops a visitor's notes (`unsubscribe_weekly_notes_subscriber`) |
| embed-gecko-image | false | **no** | Morph ID photo embeddings (expert reviewers, backfill key). Repo copy is newer, see below |
| export-training-corpus | true | **no** | Admins and expert reviewers exporting the labelled photos. Repo copy is newer, see below |
| generate-social-post | true | yes | Promote drafts (retired in the app) |
| health-screen | true | yes | AI health screen, metered |
| invoke-llm | true | yes | Admin tools and the GeckoGenius assistant, metered |
| iot-poll | true | yes | Enclosure sensor reads (switched off in the app), metered |
| market-value-snapshot | false | yes | Daily job `market-value-daily` (dispatch secret) |
| meta-oauth-callback | false | yes | Meta's redirect after sign-in (signed state) |
| meta-oauth-start | true | yes | Promote: start a Meta sign-in |
| publish-social-post | true | yes | Promote publishing |
| rapid-api | true | no | Not in the repo. Tennyson is deleting it |
| recognize-gecko-morph | false | yes | Morph ID (guests get a limited try; members metered) |
| recognize-import-data | true | yes | AI image import (Breeder and Enterprise), metered |
| reddit-oauth-callback | false | yes | Reddit's redirect after sign-in (signed state) |
| reddit-oauth-start | true | yes | Promote: start a Reddit sign-in |
| report-social-overage | false | yes | Monthly overage job (dispatch secret) or an admin |
| resend-webhook | false | yes | Resend delivery events (Svix signature) |
| revenuecat-sync | true | yes | App purchase and restore |
| revenuecat-webhook | false | yes | RevenueCat (shared Authorization header) |
| send-breeder-inquiry | false | yes | Public breeder inquiry form (rate limited) |
| send-collection-invite | false | yes | Collection invites (reads the session itself) |
| send-email | false | yes | Notifications trigger, lifecycle job and Weekly Gecko Notes job (dispatch secret). Ships the notes catalog `_shared/weekly-notes.generated.ts`, so a merge that only adds a note redeploys it |
| send-push | false | yes | Notifications trigger (dispatch secret) |
| set-platform-connection | true | yes | Promote: save an encrypted Bluesky app password |
| stripe-billing-portal | true | yes | "Manage billing" on the Membership page |
| stripe-checkout | true | yes | Membership checkout |
| stripe-webhook | false | yes | Stripe (signature checked over the raw body) |
| subscribe-and-send-guides | false | yes | Landing page "send me the guides" form |
| subscribe-weekly-notes | false | yes | Weekly Gecko Notes form for visitors on the guide pages (confirmation email; database step `request_weekly_notes_signup`) |
| waitlist-signup | false | yes | Public waitlist sign-ups and confirmations |

In the repo but not deployed: `store-checkout` and `store-stripe-webhook` (the supplies store checkout is off).

**Why two hand-deployed functions are not declared.** Declaring a function makes the next merge deploy the repo copy, whatever production had. These two differ from what runs, so declaring them would change behaviour:

- `embed-gecko-image`: the function's own file matches, but the deployed bundle carries an older `_shared/visual-embedding.ts`. That older helper posts to Replicate's model endpoint first and looks the model's latest version up again on every call. The repo helper looks the version up once per instance (and, since 16 October 2026, runs a pinned version), which avoids the second request Replicate's low-credit limit always throttled. Declaring it would be an improvement, but it is a change, so it waits for a decision.
- `export-training-corpus`: the repo copy adds a `label_weight` and a `verification_tier` to every exported sample. The live copy has neither.

**Code shared with the app.** `market-value-snapshot` is the one function that imports code from outside `supabase/functions`: `src/lib/traitValuation.js` (and the `src/lib/quality.js` it imports), so the daily valuation and the app's value estimate use the same rules. The deploy bundles those files from the repo. A change to either file changes the next deploy of the function, so check the next `market-value-daily` run still writes `market_value_daily` rows.

**How server callers sign in.** Database triggers and cron jobs that call a function send the notifications dispatch secret from the Vault (or the service-role key) as `Authorization: Bearer <secret>`. Functions on the shared helper (`_shared/caller.ts`) accept only that form.

**Library versions.** Functions changed since October 2026 import supabase-js from `supabase/functions/_shared/supabase.ts`, pinned to `jsr:@supabase/supabase-js@2.103.0`. Older functions still import it from esm.sh (at `@2` or `@2.43.4`) or JSR (at `@2`); an unpinned `@2` takes whatever 2.x is newest when the function is deployed.

**The Replicate model.** Morph ID's photo matching runs `krthr/clip-embeddings` at a pinned version (see `PINNED_VISUAL_EMBEDDING_VERSIONS` in `supabase/functions/_shared/visual-embedding.ts`, which also says how to change it). The `SIGLIP_MODEL` secret, if set, overrides the model.

Edge function secrets (names only) are listed in `docs/OPERATIONS.md`, section 2.

## 3. Storage

### Buckets

| Bucket | Public | Size limit | File types | Objects | Size |
|---|---|---|---|---|---|
| geck-inspect-media | yes | 50 MB | jpeg, png, webp, gif, avif | 817 | 1.4 GB |
| listing-images | yes | none | any | 10,903 | 6.6 GB |
| promote-images | yes | none | any | 0 | 0 |
| archive-listing-images | no | none | any | 0 | 0 |
| raw-uploads | no | none | any | 1 | 6 bytes |

Since 16 October 2026 each member photo in `geck-inspect-media` also has a small copy at `thumbs/<the photo's path>` (`src/lib/photoThumbnails.js`); the counts above are from before the thumbnail backfill. `listing-images` holds the market listing photos the scraper collects. A public bucket serves any file to anyone with its address, whatever the policies say about listing.

### Policies on storage.objects

| Policy | For | Roles | Rule |
|---|---|---|---|
| geck-inspect-media owner or admin read | read (lists files) | authenticated | the file's uploader, or an admin (`20261016220000_media_listing_closed.sql`; until 16 Oct 2026 two rules let anyone list every file name) |
| Sticker uploads readable by anyone | read | everyone | geck-inspect-media, folder `sticker-uploads` |
| geck-inspect-media authenticated insert | upload | authenticated | bucket is geck-inspect-media |
| geck_inspect_media_authed_insert | upload | authenticated | bucket is geck-inspect-media |
| geck-inspect-media thumbnails follow their photo (insert) | upload (restrictive, 16 Oct 2026) | authenticated | a name under `thumbs/` only for the owner of the photo at the same name without `thumbs/`, or an admin (`20261016090900_thumbnail_rules.sql`) |
| geck-inspect-media thumbnails follow their photo (update) | update (restrictive, 16 Oct 2026) | authenticated | the same rule for a rename into `thumbs/` |
| geck-inspect-media owner update | update | authenticated | the uploader (`owner = auth.uid()`) |
| geck_inspect_media_owner_update | update | authenticated | the uploader |
| geck-inspect-media owner delete | delete | authenticated | the uploader |
| geck_inspect_media_owner_delete | delete | authenticated | the uploader |
| geck-inspect-media admin update | update | authenticated | an admin profile |
| geck-inspect-media admin delete | delete | authenticated | an admin profile |
| public read listing-images | read | everyone | bucket is listing-images |
| Users upload to their own promote folder | upload | everyone | first folder is the caller's auth id |
| Users read their own promote images | read | everyone | anyone (as the bucket's public flag already allows) |
| Users update their own promote images | update | everyone | first folder is the caller's auth id |
| Users delete their own promote images | delete | everyone | first folder is the caller's auth id |

Notes: geck-inspect-media has each of its read, upload, update and delete rules twice under two naming styles; the copies are identical in effect. Only the uploader or an admin can change or delete a file. Tidying these rules (one copy of each, and narrower rules where the app's folder layout allows) is a follow-up, to be written as a migration so the repo holds them.

The repo's migrations do not create these buckets or policies. The local test mirror recreates them by hand (`scripts/sql-harness/sql/99_post.sql` once round 3 is merged).

## 4. Scheduled jobs (pg_cron)

Times are UTC. "In the repo" says whether a runnable migration creates the job; the four marked "archive only" exist in production but only in `supabase/migrations/_pre_rebaseline_history/`, because the September schema dump does not carry `cron.job` rows.

| Job | Schedule | Active | Runs | In the repo |
|---|---|---|---|---|
| clear-lapsed-featured-breeders | 04:50 daily | yes | `clear_lapsed_featured_breeders()` | yes |
| expire-referral-grants | 04:30 daily | yes | `expire_referral_grants()` | archive only |
| feeding-reminders-daily | 14:10 daily | yes | `enqueue_feeding_reminders()` | yes |
| hatch-alerts-daily | 13:00 daily | yes | `enqueue_hatch_alerts()` | archive only |
| lifecycle-emails-hourly | :35 every hour | yes | `enqueue_lifecycle_emails()` | yes |
| market-after-scrape-requests | every 5 minutes | yes | `geck_data.run_requested_after_scrape()` | yes |
| market-brief-morning | :35, 13:00 to 20:00 | yes | `enqueue_market_briefs()` | yes |
| market-value-daily | 12:40 daily | yes | `request_market_value_snapshot()` | yes |
| monthly-overage-billing | 02:00 on the 1st | yes | posts to `report-social-overage` | yes |
| personal-weighin-reminders-daily | 14:20 daily | yes | `enqueue_personal_weighin_reminders()` | yes |
| process-scheduled-blog-posts | every 5 minutes | **no** | `process_scheduled_blog_posts()` | yes |
| promote_drain_scheduled | every 5 minutes | **no** | `publish_due_scheduled_posts()` | yes |
| prune-stale-push-subscriptions | 03:17 daily | yes | `prune_stale_push_subscriptions()` | archive only |
| purge-cron-run-details | 03:47 daily | yes | `purge_cron_run_details(7)` | yes |
| refresh-market-matviews | :20 every hour | yes | `geck_data.after_scrape('hourly')` | yes |
| season-planner-reminders-daily | 14:20 daily | yes | `enqueue_season_planner_reminders()` | yes |
| vet-followups-daily | 14:25 daily | yes | `enqueue_vet_followups()` | yes |
| weekly-digest-sunday | 16:00 Sunday | yes | `enqueue_weekly_digest()` | yes |
| weekly-notes-hourly | :50 every hour | yes | `enqueue_weekly_notes()` (members, then confirmed visitors) | yes (`20261018002200_weekly_notes.sql`, `20261018120000_weekly_notes_visitors.sql`) |
| weekly-notes-visitor-cleanup | 04:25 daily | yes | `weekly_notes_visitor_cleanup()` | yes (`20261018120000_weekly_notes_visitors.sql`) |
| weighin-reminders-weekly | 15:00 Sunday | yes | `enqueue_weighin_reminders()` | archive only |

Round 3 of the review fixes (not merged when this was written) adds `privacy-retention-daily` (04:05 daily) and unschedules `monthly-overage-billing`.

Jobs that call an edge function (`monthly-overage-billing`, and the functions behind `market-value-daily`, the notification trigger, the lifecycle emails and Weekly Gecko Notes) send the Vault secret `notification_service_role_key` as a bearer token; the functions check it with `verify_notification_dispatch_secret()`, which only the service role may run.

**Weekly Gecko Notes** (`docs/planning/weekly-notes-2026-10.md`). `weekly-notes-hourly` runs `enqueue_weekly_notes()`, which does one lookup and stops while `app_settings` `weekly_notes_enabled` is false (the default). When it is on, it asks send-email about up to 20 members a run and records each ask in `weekly_notes_polls` (one row per member, at most one ask in 20 hours). send-email claims each note with `claim_weekly_note()`, which writes `weekly_notes_sends` (unique on address and slug). `weekly_notes_candidates()` (read-only) shows who is due; `unsubscribe_weekly_notes_by_token()` (open to signed-out visitors, signature checked) turns off only `profiles.email_weekly_notes_enabled` and records the choice in `profiles.email_weekly_notes_choice_at`, and the trigger `profiles_weekly_notes_follow_email_off` turns it off whenever `email_notifications_enabled` goes from on to off. For the EEA and the UK (decision 58): `handle_new_auth_user` (the `on_auth_user_created` trigger) saves the sign-up box (`weekly_notes_at_signup` in the sign-up metadata) as the member's choice, and `weekly_notes_region_default()`, which signed-in members may run on their own profile only, turns the notes off for a member who never chose; the trigger `profiles_weekly_notes_stamp_choice` puts the database's clock on every choice. All but the unsubscribe and the region rule are service role only; admins can read both tables. The edge function secret `EMAIL_POSTAL_ADDRESS` now gates the notes: while it is empty, send-email skips every weekly note before claiming, so nothing is used up.

**Weekly Gecko Notes for visitors** (section 9 of the plan, `20261018120000_weekly_notes_visitors.sql`). The form on the public guide pages posts to `subscribe-weekly-notes`, which calls `request_weekly_notes_signup()` (service role: rate limits, then a confirmation link whose sha256 is kept in `newsletter_subscribers.confirm_token_hash`; every email the form sends is logged in `weekly_notes_signup_sends`). `/WeeklyNotes?t=...` calls `confirm_weekly_notes_signup()` (open to signed-out visitors) on a button press. Confirmed visitors with no sign-in account are `weekly_notes_subscriber_candidates()`; the hourly job asks send-email about them with `weekly.audience = 'visitor'`, and send-email claims with `claim_weekly_note_subscriber()` (same lock and ledger as members). Their stop link is `weekly_notes_subscriber_token()` / `unsubscribe_weekly_notes_subscriber()`. `newsletter_subscribers` is closed to the public API (admins read it). `weekly-notes-visitor-cleanup` drops unconfirmed requests after 30 days. To erase a visitor on request: `select public.admin_erase_weekly_notes_visitor('name@example.com');` in the SQL console.

## 5. Vault secrets (names only)

| Name | Used for | Created |
|---|---|---|
| notification_service_role_key | The bearer the database's jobs and triggers send to edge functions (also `enqueue_weekly_notes`) | 7 May 2026, updated 4 Sep 2026 |
| email_unsubscribe_secret | Signs the unsubscribe links in notification emails, including the Weekly Gecko Notes stop link (`unsubscribe_weekly_notes_by_token` checks the same signature) | 3 Oct 2026 |

Not yet created: `morph_share_view_key` (Tennyson's step, see `docs/OPERATIONS.md`). Until it exists, shared Morph ID cards count no views.

## 6. Database extensions

pg_cron 1.6.4, pg_net 0.20.0, supabase_vault 0.3.1, vector 0.8.0, pg_trgm 1.6, pgcrypto 1.3, uuid-ossp 1.1, pg_stat_statements 1.11.

## 7. Building a second environment from the repo

The migration chain recreates the `public` and `geck_data` schemas, their functions, policies and grants. It does not recreate:

1. **Storage buckets and their policies** (section 3). Create the five buckets with the same public flags, then the policies.
2. **Four scheduled jobs** that live only in the archive (section 4): expire-referral-grants, hatch-alerts-daily, prune-stale-push-subscriptions, weighin-reminders-weekly.
3. **Vault secrets** (section 5). New random values, never production's.
4. **Edge function secrets** (names in `docs/OPERATIONS.md`, section 2).
5. **Data**: no rows, no stored photos, no auth users. `src/lib/guestMockData.js` is the nearest thing to seed data.
6. **The function URLs written into SQL.** The notification trigger and several jobs post to `https://mmuglfphhwlaluyfyxsp.supabase.co/functions/v1/...`; a second project needs its own address there.

## 8. Re-checking (read-only)

8.1 Newest applied migrations:

```sql
select version, name from supabase_migrations.schema_migrations order by version desc limit 10;
```

8.2 Buckets:

```sql
select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id;
```

8.3 Storage policies:

```sql
select policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'storage' order by policyname;
```

8.4 Scheduled jobs:

```sql
select jobname, schedule, active from cron.job order by jobname;
```

8.5 Vault secret names (never select the decrypted values):

```sql
select name, description, created_at, updated_at from vault.secrets order by name;
```

8.6 Edge functions and their `verify_jwt`: the Supabase dashboard (Edge Functions) or the Supabase MCP `list_edge_functions` tool. To compare a hand-deployed function with the repo before declaring it, read its live files (`supabase functions download <name>`, or the MCP `get_edge_function` tool) and diff them with `supabase/functions/<name>/` and every `_shared` file it imports.

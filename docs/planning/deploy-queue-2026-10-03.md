# Deploy queue, 3 October 2026

The 2 and 3 October ship-ready work is on `main` and live on Vercel. This file records what went to production on 3 October and after.

**Status 15 October: the SQL queue is cleared, and deploys go through merges.** Everything that was waiting on the SQL Editor run reached production on 8 October (details in "Cleared on 8 October" below). Merging to `main` does three things at once, through Vercel and the Supabase GitHub integration: Vercel deploys the site, Supabase applies every new file in `supabase/migrations/`, and Supabase deploys the edge functions declared in `supabase/config.toml`. The integration already did this before 15 October, alongside changes applied by hand; round 1 of the review fixes went out with nothing run by hand (below), and that is the rule now. How to write a migration for this is in `docs/MIGRATIONS.md`.

What is still open in this file: the dashboard steps for rounds 2 and 3 (each round's "what still needs Tennyson"), the leftover functions under "Also for Tennyson", and the real-device checks. Round 3 went live on 16 October.

Project: `mmuglfphhwlaluyfyxsp`.

## How a merge to main deploys

- **Three deploys, no fixed order.** Vercel builds the site, the integration applies new migration files in filename order, and it deploys declared functions. Any of the three can finish first, and members keep old copies of the app open for hours, so every change has to work with the old app and the new one, before and after its migration.
- **Migrations are recorded under the file's own version.** Production's history shows round 1 as `20261015120000_ownership_checks` and so on, with no author, which is how the integration records them (the 8 October files, applied by hand, carry a new timestamp and an author instead).
- **Declared functions deploy from `main`.** 15 were declared in `supabase/config.toml` after round 2; round 3 declares 15 more, so 30 deploy on merge. A declared function's repo copy is what goes live, so it must always be the version you want in production. `docs/INFRASTRUCTURE.md`, section 2, lists every production function and whether it is declared.
- **Before round 3, 18 production functions were deployed by hand, on purpose** (round 3 declares 15 of them after comparing each with production; see "Round 3" below). They were live and had a copy in the repo but were not declared, so a merge never touched them: `invoke-llm`, `stripe-checkout`, `stripe-billing-portal`, `send-push`, `embed-gecko-image`, `export-training-corpus`, `recognize-import-data`, `publish-social-post`, `set-platform-connection`, `report-social-overage`, `meta-oauth-start`, `meta-oauth-callback`, `reddit-oauth-start`, `reddit-oauth-callback`, `iot-poll`, `csp-report`, `market-value-snapshot` and `admin-end-trial`. Each one gets declared only after its live code has been compared with the repo copy, because declaring it would deploy the repo copy on the next merge. (`rapid-api` is also live and has no repo copy; see "Also for Tennyson". `store-checkout` and `store-stripe-webhook` are in the repo but not deployed, and the store's own checkout is switched off in `src/lib/store/checkoutFlags.js`.)

## Round 1: applied 15 October (PRs 128 and 129)

Checked read-only on 15 October 2026 against production's migration history and function list.

**Migrations**, applied by the integration when PR 128 merged (14:48 UTC):

- `20261015120000_ownership_checks`: writes to transfers, care records, eggs, ownership records, collections and profiles check that the caller may act on that animal or account; gecko limits enforced for every plan.
- `20261015130000_comms_and_exposure`: member-to-member notifications use server templates, rate limits and in-app links only; message, follow and deletion-request rules; no member emails from profile functions; new functions get no default EXECUTE grant.
- `20261015140000_social_draft_allotments` and `20261015140100_email_has_login` (the "can this address sign in?" check that reminders, digests and send-email now use).

**Edge functions:**

- `admin-delete-account` v3, deployed by the integration with PR 128 (it was already declared).
- PR 129 (merged 14:59 UTC) declared the eight round 1 functions that had only ever been deployed by hand, each with the gateway setting production already had. The integration then deployed them from the repo at 15:00 UTC: `stripe-webhook` v40, `generate-social-post` v23, `health-screen` v11, `send-email` v26, `send-collection-invite` v22, `subscribe-and-send-guides` v21, `send-breeder-inquiry` v21 and `recognize-gecko-morph` v71. It redeployed `revenuecat-webhook` (v121) and `revenuecat-sync` (v110) at the same time, unchanged.
- `recognize-gecko-morph` v71 includes the 14 October `taxonomy.ts`, so the Sable and Highway redeploy at the end of this file is done.

## Round 2: applied 15 October (PR 137), and the signup hotfix (PR 138)

**Applied:** PR 137 merged at 23:50 UTC on 15 October; the integration applied the seven migrations below and deployed the functions, and a read-only check afterwards found every function body, grant and policy matching the repo, `lifecycle-emails-hourly` scheduled, `lifecycle_emails_enabled` false and `care_reminder_defaults_from` set to 2026-10-16. PR 138 (01:59 UTC on 16 October) shipped `20261015233100_guard_switches`: from about 18:48 UTC on 14 October every new signup had been refused, because two guards added that day did not trust Supabase's own sign-up login; the migration lets it through and makes `apply_referral_code` switch its bypass off after use (regression file `supabase/tests/guard_switch_regressions.sql`).

Plan items E2 15 to 22 and E5 of `docs/planning/comprehensive-review-2026-10-14.md`. Merging to `main` shipped all of it the same way as round 1: no SQL and no function deploy was run by hand. A few dashboard settings wait on Tennyson (the list at the end of this section); until then the parts that need them stay quiet rather than break.

**Migrations** (applied in this order; each one is safe to run twice):

| File | What it does |
|---|---|
| `20261015151000_followups` | The round 1 review's follow-ups: the breeder page's Track record panel works again for signed-out visitors (numbers only, no email), display names with "&", "," or "." in notifications, tighter message rules, member emails hidden from signed-out visitors on seven more tables |
| `20261015151100_reminders_and_offline_logging` | Reminders by life stage for every gecko added from 16 October (or the release day, if later), whichever way it was added: weigh-ins every 14, 21 or 30 days by size and age, feeding every 3 days for a gecko not in a feeding group, and one hatch alert a day per member while an egg is near its date. Reminder links open the one-tap log at `/log`; no reminders or digests for addresses that cannot sign in; a request id on each weight, feeding and shed so an offline log is saved once |
| `20261015151200_lifecycle_emails` | The five getting-started emails (off until `lifecycle_emails_enabled` is true), the job `lifecycle-emails-hourly` (35 past each hour), the delivery log `email_deliveries`, the suppression list `email_suppressions` and the admin's weekly email numbers |
| `20261015151300_morph_id_share_card` | Free gets one Morph ID a month instead of one ever; the shareable result card (`morph_id_shares`), and the `morph_share_created`, `morph_share_viewed` and `morph_share_signup` events |
| `20261015151400_stripe_ledger` | Cancellation and refund columns on `payment_events`, a one-time rebuild of missing rows from the webhook log, and `admin_revenue_summary()` for the Revenue card |
| `20261015151500_scoreboard` | The weekly scoreboard: `scoreboard_entries` (what Tennyson records by hand), `admin_scoreboard()`, and a rule that a `user_events` row from the app always names the member who wrote it |
| `20261015151600_erase_email_logs` | Account deletion also clears the address from `email_deliveries`, deletes the member's `lifecycle_email_sends` rows and clears a typed cancellation comment. `email_suppressions` is kept on purpose |

**Edge functions** (all declared, so the merge deploys them): `send-email` (the lifecycle email copy, the delivery log, skipping suppressed addresses, an optional postal address in the footer), `resend-webhook` (new: records Resend's delivery events, checks Resend's signature), `stripe-webhook` (a ledger row for every paid invoice and every cancellation, refund and dispute amounts), `send-collection-invite` (matches the invite to the token in its link) and `recognize-gecko-morph` (Free at one a month; returns the photos it read, which a share card must use).

**Vercel:** the new route `api/morph-share.js`, reached through the rewrite `/morph-id/r/:id` in `vercel.json`, serves a shared Morph ID card as a real page so Facebook and Messenger show its photo and title. The app gains the one-tap log at `/log`, the Revenue and Weekly scoreboard cards on Admin, Overview, and a reload-once when an open tab reaches a page it does not know yet (this helps from the next deploy on; tabs already open on the old app do not have it).

**Service worker:** the offline shell cache is now `geck-shell-v2`, which drops a shell copy a shared card page could have replaced. The file cache deliberately stays `geck-static-v1`: bumping it would purge the app's files, and the visit that installs the new worker does not fetch them again, so the next offline visit would have the shell but not the code.

**Safe in either order:** the Revenue and Weekly scoreboard cards say their migration is not applied yet until it is; a care log sent before its migration is saved without the request id instead of being refused; Free's one a month works before or after `recognize-gecko-morph` is redeployed (the database uses 1 for Free whatever the function sends); reminder links switch to `/log` only from the day after the defaults start, so tabs left open from before the release get a day to reload.

### Round 2: what still needs Tennyson

1. **Resend webhook** (until then nothing is recorded after "sent", and bounces do not stop mail):
   - In Resend, Webhooks, add the endpoint `https://mmuglfphhwlaluyfyxsp.supabase.co/functions/v1/resend-webhook` with the email events (sent, delivered, delivery delayed, opened, clicked, bounced, complained).
   - Copy its signing secret (it starts with `whsec_`) into the Supabase function secret `RESEND_WEBHOOK_SECRET`. Without it the function refuses every call.
   - Turn on open and click tracking for the sending domain in Resend, or opens and clicks stay at 0.
2. **Email footer:** set the function secret `EMAIL_POSTAL_ADDRESS` (the postal address US law expects in commercial email). Optional: `UNSUBSCRIBE_MAILTO`, an address that handles unsubscribe requests by hand, used only when a signed unsubscribe link cannot be made.
3. **Morph ID card views:** create the Vault secret `morph_share_view_key` (32 or more random characters) and set the same value as the Vercel setting `MORPH_SHARE_VIEW_KEY`. It is a server-only setting: never give it a `VITE_` name, because `VITE_` names are for public values the build may put in the browser's JavaScript. Then redeploy production in Vercel (Deployments, the latest production deployment, Redeploy), because a changed setting reaches only new deployments, and a later merge that touches only docs does not make one. Until both values exist and that redeploy is done, cards work but every card's view count stays at 0.
4. **Lifecycle emails:** approve the copy in `docs/planning/lifecycle-emails-2026-10.md`, then turn them on in the SQL Editor: `update public.app_settings set value = 'true'::jsonb where key = 'lifecycle_emails_enabled';`. Until then the hourly job sends nothing.
5. **Phone checks:**
   - Add a gecko with no weight on or after 16 October UTC (6 pm on 15 October, Denver time), and not before the release day: the next day (the job runs at 14:20 UTC, 8:20 am Denver time) a weigh-in reminder arrives, and its link opens `/log` with that gecko. Do not test sooner. A gecko added before then gets a reminder only if its own reminder switch is on, and on the first day the defaults apply, reminders still link to the older pages, so a sooner test can look broken when nothing is wrong.
   - Airplane mode: log a feeding in Field Mode or on `/log`, go back online, and the feeding is saved once (not zero times, not twice).
   - Share a Morph ID result and paste the card link into Messenger or a Facebook thread: the preview shows the photo and the title.

## Round 3: applied 16 October (PR 139)

**Live 16 October about 22:00 UTC** (merge commit `aabc313`). Checked after the merge: all ten migrations below are applied; the `privacy-retention-daily` job is scheduled and `monthly-overage-billing` is gone; `other_reptile_reminders_enabled` is `false`; both thumbnail rules are in place; `admin_photos_without_thumbnail` is closed to signed-out callers; every function this round changed redeployed (the rest import nothing that changed); Vercel production is READY with no runtime errors in the first hour. Merged with it: Tennyson's same-day Morph Guide work (field guide plates, eye studies, project line plates, the Field Notebook rewrite with new drawings, Pied). Codex raised one follow-up on the merged code, a rare race that could leave two payable checkout pages; it is item 7 below.

Plan items E3 23 to 31 of `docs/planning/comprehensive-review-2026-10-14.md`, plus the round 2 review's money fixes and the engineering clean-up. Merging to `main` ships it the same way: nothing is run by hand. The migrations were first dated 15 October 23:10 to 23:32 UTC. The signup hotfix shipped first with the version `20261015233100`, which falls in between, so they were renamed to sort after it (`docs/MIGRATIONS.md`); otherwise the integration would see files older than one it has already applied.

**Migrations** (applied in this order; each one is safe to run twice):

| File | What it does |
|---|---|
| `20261016090000_privacy` | `apply_privacy_retention()` and the daily job `privacy-retention-daily` (04:05 UTC): error reports and AI crawler hits older than 90 days are deleted (the first run removes about 56 app and 574 Geck Intellect error reports), old Stripe, payment ledger and RevenueCat webhook payloads are emptied and the rows kept. `breeding_projects`, `clutches` and `genetic_outcome_predictions` become readable only by their owner or an admin, and signed-out visitors lose their grants |
| `20261016090100_nav` | `public.my_care_today(date)` for the Today screen: read only, the caller's own rows, using the reminder jobs' rules. Until it runs, Today says its list is being updated and still shows the collection and the Log tab |
| `20261016090200_perf` | `public.recent_weight_records(integer)` and the index `weight_records_owner_gecko_date_idx`, so My Geckos reads recent weights without loading every weigh-in. The app falls back to the old read until it exists |
| `20261016090300_seo` | `public.open_price_index()`: a row needs 30 listings (was 5), monthly medians count only days with 30 or more, rows under 100 are marked thin. Same signature and grants; the build applies the same rule (`src/lib/priceIndexPolicy.js`) |
| `20261016090400_ux` | `geck_data.external_reference_images` shows only photos under public domain, CC0, CC BY or CC BY-SA (rows kept). Undo: restore the read policy with `USING (true)` |
| `20261016090500_revenue_counts` | `admin_revenue_summary()` leaves $0 renewals out of monthly recurring revenue; `admin_scoreboard()` counts a lifetime payer only with a paid lifetime payment |
| `20261016090600_retire_overage_billing` | Unschedules `monthly-overage-billing` (Promote is retired; the job never ran) |
| `20261016090700_reptile_reminders_switch` | Feeding reminders for Other Reptiles wait on the new `app_settings` row `other_reptile_reminders_enabled` (false); gecko reminders unchanged |
| `20261016090800_photo_thumbnails` | `admin_photos_without_thumbnail(p_after, p_limit)`, admin only: the list behind the Photo thumbnails admin tool (photos with no thumbnail, or with one somebody other than the owner or an admin made). Function only; until it runs, the tool says it is not installed yet |
| `20261016090900_thumbnail_rules` | Two restrictive storage rules: only a photo's owner or an admin may create a file at, or rename a file to, its thumbnail name (`thumbs/<path>` in `geck-inspect-media`), so nobody can put a picture on another member's cards. Other uploads and renames are unaffected |

**Edge functions.** Round 3 declares 15 functions that were deployed by hand, after a file-by-file comparison showed each repo copy matched production: `stripe-checkout`, `stripe-billing-portal`, `send-push`, `csp-report`, `market-value-snapshot`, `invoke-llm`, `recognize-import-data`, `iot-poll`, `publish-social-post`, `set-platform-connection`, `meta-oauth-start`, `meta-oauth-callback`, `reddit-oauth-start`, `reddit-oauth-callback` and `report-social-overage`. The merge deploys all 30 declared functions from the repo. What actually changes in production:

- `stripe-checkout`: refuses a second subscription for a member who already pays through the App Store (`already_subscribed_store`), and expires an open Checkout session before starting another, so a second tab cannot charge twice (`checkout_in_progress` if Stripe will not expire it).
- `invoke-llm`: the AI Consultant's rules live on the server and every call is logged with its cost; a smaller model by default (`INVOKE_LLM_MODEL` rolls it back). The Consultant is retired for members, so this mostly affects admin tools. Its rules (`invoke-llm/consultant.ts`) now give both views of Harlequin, Pinstripe and Dalmatian (line-bred for most of the hobby, single-gene in Foundation Genetics' model); that text deploys with the merge, and `pnpm check:genetics` reads it.
- `health-screen`: a newer model (`HEALTH_SCREEN_MODEL` overrides), cost logged.
- `recognize-gecko-morph`: the photo fingerprint model pinned to a version; no model-guessed price in the answer.
- `stripe-billing-portal`, `iot-poll`, `send-push`, `csp-report`: moved to the shared helpers (`_shared/http.ts`, `_shared/caller.ts`, `_shared/supabase.ts`). `send-push`, `iot-poll` and `stripe-billing-portal` now accept only `Authorization: Bearer <token>`, which every production caller already sends.
- `market-value-snapshot`: deployed by the integration for the first time, with its import of `src/lib/traitValuation.js`.
- `delete-my-account` and `admin-delete-account`: also erase each photo's thumbnail (`_shared/erasure-files.ts`).
- Still hand-deployed: `embed-gecko-image` and `export-training-corpus` (their repo copies are newer than production, so declaring them changes behaviour; Tennyson decides), and `rapid-api` and `admin-end-trial` (to delete).

**Vercel:** Today and the new phone tabs, the one gecko record, the retired pages with temporary redirects, self-hosted fonts and the size budget, link-preview cards for passports, breeder pages, stores and waitlists (`middleware.js`), the EEA and UK consent banner, Content Security Policy hashes for inline scripts, the Membership page restructure, the Emerald default theme (held back from the homepage while its A/B test runs, `docs/planning/homepage-ab-test-2026-10.md`), the payment-problem banner, the Price Index relabel (an asking-price snapshot, free to cite with a link), and photo thumbnails: each new photo uploads a small copy that cards load first, and the Admin panel has a Photo thumbnails tool for older photos. Public pages load less up front: the calculator's first load drops from about 295 to 170 kB gzipped (the genetics engine loads when it is needed), the Morph Guide and morph pages from about 297 to 260 kB, the Care Guide from 226 to 198 kB, and the admin panel loads its sections on demand.

**Safe in either order:** Today, My Geckos' recent weights, the scoreboard and the Revenue card fall back until their migration runs; the Price Index rule is applied by the build as well as the database; an old Morph ID page hides the price section when the server stops sending a guess; an old chat page uses the plain path, which now carries the rules.

### Round 3: what still needs Tennyson

1. **Phone checks:** open geckinspect.com cold on a phone: it opens on Today; log a feeding in two taps; open Today in airplane mode after one online visit; on a laptop install, it still opens where it used to. Open a gecko record on an iPhone: it fills the screen below the notch, the parents and value show without scrolling, a weigh-in saves, and Close and swipe-back work.
2. **Sign-in links (PKCE):** in Supabase, Authentication, Email Templates, change each link to the `token_hash` form (Confirm signup: `{{ .SiteURL }}/AuthPortal?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}`; Reset password the same with `type=recovery`; Magic link `type=magiclink`; Invite user `type=invite` with no `next`; Change email `type=email_change` with no `next`). Check the Site URL is `https://geckinspect.com`, send yourself a reset from the iPhone home screen app and open it from Mail. A day later a session flips `WEB_AUTH_FLOW` to `'pkce'` in `src/lib/emailLinkAuth.js`.
3. **PostHog:** delete the persons whose distinct id contains "@" (members identified by email before this change).
4. **Two functions (decided 16 Oct):** `embed-gecko-image` and `export-training-corpus` stay hand-deployed at their production versions.
5. **Link previews:** paste a passport link and a breeder page link into Messenger or iMessage: the preview shows that gecko's or breeder's own title and photo.
6. **Photo thumbnails for older photos:** after the merge, open Admin panel, System, Photo thumbnails and press Make thumbnails, keeping the tab open (about 817 photos on 16 October, 10 to 20 minutes; each original is downloaded once through your browser, about 1.5 GB of Supabase data transfer; the thumbnails add 25 to 40 MB). It is safe to stop and start again. Run it again the next day, because copies of the app opened before the release keep uploading without thumbnails for a few hours. Until a photo has its thumbnail, the app asks for the missing thumbnail once per visit (one failed request), then loads the full photo as before, so run the backfill soon after the merge.
7. **Checkout race (decide):** if one member starts checkout in two tabs or on two devices within about a second, both requests can clear old checkout pages before either creates a new one, leaving two payable Stripe pages (one tap on one page cannot cause it; the button locks). Paying on both would charge twice. The sound fix is a per-member lock around the cleanup and create in `stripe-checkout`; decided 16 Oct: fix it only if it ever happens.
8. **Stripe refund and dispute events (found 17 Oct):** the refund issued that day never reached the app, because the webhook endpoint in Stripe is not subscribed to the events the code already handles. In Stripe: Developers, Webhooks, the `.../functions/v1/stripe-webhook` endpoint, Add events: `charge.refunded`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`, `charge.dispute.funds_withdrawn`, `charge.dispute.funds_reinstated`, `customer.subscription.trial_will_end`, `checkout.session.async_payment_succeeded`. Then open the refund's `charge.refunded` event (Developers, Events) and press Resend to that endpoint, so the Revenue card shows it.

## Added 16 October (evening): photo listing, sign-in landing, size check

**Supabase (migration `20261016220000_media_listing_closed.sql`):** visitors can no longer list the file names in the member photo bucket. Each photo still loads by its address as before; a member can list only their own files and the admin all of them (the thumbnail backfill needs that). Test: `supabase/tests/media_listing_regressions.sql`.

**Vercel:** signing in on a phone lands on Today, on a larger screen on My Geckos (`memberHome` in `src/lib/pwaLaunch.js`). The stored offline copy of My Geckos and Today is now refreshed on every load when online; before, a copy under two minutes old was shown as is, so a gecko added just before closing the app could be missing on reopen. The size check's failure message says what to do, and `pnpm shrink:images` re-saves any picture in `public/` over 200 KB.

**Decided 16 Oct:** the checkout race is fixed only if it happens; the two hand-deployed functions stay as they are; the ReptiDex citations and the Eureka Exotics name on Albino stay; the 115 Blizzard profiles stay as they are; the growth band stays until 50 geckos; no spend on Morph ID grading without Tennyson's OK; the LLC is postponed; 2FA on the admin account in November (a reminder is set). The ten missing Morph Guide field guide plates are painted images, handed to another agent.

**Done by Tennyson, 17 Oct:** the day-one $2.99 refunded (review item 12), and the Supabase service role key rotated (new secret key in Supabase, the `SUPABASE_SERVICE_ROLE_KEY` GitHub Actions secret replaced; the old key revoked the same day, after the daily canary passed on the new one).

## Added 17 October: Morph ID speed

Same model, same instructions, same answer fields; the request the model reads is checked byte for byte by `src/lib/__tests__/morphRequestSnapshot.test.js`. Details in `supabase/functions/recognize-gecko-morph/README.md`.

**Supabase, function (`recognize-gecko-morph`, declared, deploys on merge):** the profile, plan and per-network reads run together, and the photo lookup starts once the scan is reserved (so a repeat, a run still going, a network over its cap or an account with no scans left never reaches Replicate) and runs alongside the scans-left read; one time budget of 105 s from arrival (Claude is started only with 32 s left for one or two photos, 3.5 s more per photo past two, and the embedding must be done by the point that still leaves that plus the reference query: 69.5 s for one or two photos, 59 s for five; past it the call ends in the usual refunded `upstream_timeout` at 59 to 70 s instead of 100 to 130 s); the spend log row is written after the answer; the answer ceiling is 4096 tokens and a cut-off answer is retried with twice the room; every answer has a `Server-Timing` header and one timing line in the log. New: `{ "action": "warm" }` wakes the Replicate model with a project photo, at most once a minute, logged as zero-cost `morph_id_warm` rows in `geck_data.model_invocations`.

**Vercel:** the Morph ID page sends that warm-up when a signed-in member with a scan left opens it, and again on picking the top view after 3 minutes. No photo is sent. The daily canary sends it too and prints each call's embedding and Claude time (its 100 s limit is unchanged).

**Held back: a faster reference-photo query.** The session also built a narrow, exact copy of the reference photos for `morph_visual_neighbors`. Before merging, `supabase/tests/morph_neighbors_production_check.sql` was run on production (read-only, 18 Oct): 20 of 20 sample photos came back with different reference photos from the exact answer, so today's function uses the approximate `idx_gecko_images_embedding` index. The exact query would change which reference photos Morph ID sees, so it was dropped from the merge. It could come back after a graded run shows it does not lower accuracy.

**Live 18 Oct, 00:25 UTC** (`recognize-gecko-morph` v76). The daily canary run by hand right after: both identifications passed, 38 s (embedding 6.9 s, Claude 29.6 s) and 33 s (embedding 0.9 s, Claude 30.3 s), against 101 s on 16 Oct when the embedding model was cold. Claude's own 30 s is unchanged on purpose: it follows the answer's length, and shortening the answer could change which morph is picked.

### Morph ID speed: what still needs Tennyson

1. **Replicate credit at $5 or more** (Replicate dashboard, Billing). Below that Replicate allows one request at a time.
2. **After the deploy:** open Morph ID, wait a minute, tap Identify, and check the `embed` time in the response's `Server-Timing` header (browser network panel) is under 5 s. On the next cold canary day, call 1's embed time should drop.

## Added 18 October: Weekly Gecko Notes

One short email a week after a member's first two weeks, in order, for as long as they stay subscribed. The design, the 16 notes and how a session adds more are in `docs/planning/weekly-notes-2026-10.md`.

**Supabase (applied by the merge):**

- `20261018002200_weekly_notes.sql`: the switch `weekly_notes_enabled` (false, not public), the member's own switch `profiles.email_weekly_notes_enabled` (on for new members unless they untick the sign-up box; existing members who had Platform Announcements or all email off start opted out, once), `profiles.email_weekly_notes_choice_at` (when the member last chose, stamped by the trigger `profiles_weekly_notes_stamp_choice`), the trigger `profiles_weekly_notes_follow_email_off` (stopping all email turns the notes off too, for good), `handle_new_auth_user` restated to save the sign-up box with the profile, the ledger `weekly_notes_sends`, the poll table `weekly_notes_polls`, the functions `weekly_notes_candidates`, `claim_weekly_note`, `enqueue_weekly_notes`, `unsubscribe_weekly_notes_by_token` (records the choice) and `weekly_notes_region_default` (the EEA and UK rule, run by members on their own profile), and the job `weekly-notes-hourly` at 50 past each hour. Additive and safe to run twice. While the switch is off the job is one lookup an hour.
- `20261018002300_erase_weekly_notes.sql`: `admin_erase_account` restated from `20261015151600` with two lines that delete the member's weekly notes rows.
- Test: `supabase/tests/weekly_notes_regressions.sql` (and `lifecycle_regressions.sql` still passes against the restated erasure).

**Edge functions (deployed by the same merge; both already declared in `supabase/config.toml`):** `send-email` (claims and sends the notes, with their own footer and a `&scope=weekly` stop link and one-click header; ships the catalog `_shared/weekly-notes.generated.ts`) and `email-unsubscribe` (a `scope=weekly` POST stops only the weekly notes). send-email's profile lookup is unchanged, so it works whether the migration lands before or after it.

**Vercel:** the Weekly Gecko Notes switch in Settings (its own save, which records the choice); the sign-up box "Send me Weekly Gecko Notes, one short crested gecko tip a week" (ticked except in the EEA and the UK); the region rule after sign-in (`src/lib/weeklyNotesConsent.js`; before the migration lands it does nothing, and the next session tries again); the Unsubscribe page, which now changes nothing until a button is pressed ("Stop Weekly Gecko Notes", "Stop all notification emails" or "Unsubscribe"), because mail scanners open links, for the all-email links in reminder emails too; and the Privacy Policy (updated 18 October). The getting-started footer now says Weekly Gecko Notes may follow and can be turned off in Settings, and two of its facts match the notes (a 0.1 g scale; weigh every 14, 21 and 30 days by stage).

**What still needs Tennyson:** the notes run without waiting on his approval (his request, 18 Oct), and the EEA and UK legal basis is decided (decision 58: off unless turned on there). Both steps are done (18 Oct).

1. Set the edge function secret `EMAIL_POSTAL_ADDRESS` (a street address, or a registered PO box or mail receiving agency; US law expects one). **Done 18 Oct, about 15:20 UTC**, checked with a probe that sends nothing. Without it no weekly note is sent, and the skip uses up nothing.
2. Turn the notes on (done 18 Oct): `update public.app_settings set value = 'true'::jsonb where key = 'weekly_notes_enabled';` With 64 confirmed accounts and 20 a run, the first round takes about four hours; after that each member gets one note about every 7 days.
3. After the first merge that only adds a note, check that the send-email version in the dashboard moved.

## Added 18 October: Weekly Gecko Notes for visitors (live 03:18 UTC)

An email sign-up for people without an account, feeding the same weekly notes. Design in `docs/planning/weekly-notes-2026-10.md`, section 9; decision 59.

**Supabase (applied by the merge, commit 307e8531):** `20261018120000_weekly_notes_visitors.sql` closes `newsletter_subscribers` to the public API (the old `anyone_can_subscribe` insert policy is gone; admins can read it), adds the visitor columns and the form's send log `weekly_notes_signup_sends`, the functions `request_weekly_notes_signup`, `confirm_weekly_notes_signup`, `weekly_notes_subscriber_token`, `unsubscribe_weekly_notes_subscriber`, `weekly_notes_subscriber_candidates`, `claim_weekly_note_subscriber`, `weekly_notes_visitor_cleanup` (job `weekly-notes-visitor-cleanup`, 04:25 daily) and `admin_erase_weekly_notes_visitor`, and restates `enqueue_weekly_notes` to ask about confirmed visitors after members. Test: `supabase/tests/weekly_notes_visitors_regressions.sql`.

**Edge functions:** `subscribe-weekly-notes` is new and declared in `supabase/config.toml` (verify_jwt false); `send-email` gained the visitor branch and `email-unsubscribe` the `scope=visitor` stop. All three deployed with the merge.

**Vercel:** the form under the account prompt on the guide pages, the `/WeeklyNotes` page (sign-up and the confirmation button) and the visitor stop on `/Unsubscribe`; the Privacy Policy describes visitor sign-ups.

**Checked in production on 18 October:** a sign-up to Resend's test inbox returned 200 and left one unconfirmed row and one send-log row with a hashed network; a bad address returned 400; confirm, a second press ("already"), becoming due, the stop link and dropping off the list all worked in a rolled-back transaction; `anon` has no access to `newsletter_subscribers`. The test row was erased with `admin_erase_weekly_notes_visitor`.

**What still needs Tennyson:** nothing. The `EMAIL_POSTAL_ADDRESS` secret (step 1 above) was set on 18 Oct, so confirmed visitors get notes like members.

**Review fixes, 18 October (`20261018150000_weekly_notes_visitor_fixes.sql`):** a visitor's stop now also stops the member notes and holds after they make an account; limits count inboxes (plus tags, Gmail dots); nothing is sent to suppressed addresses or members with email off; the confirm button uses the database's clock (`confirm_weekly_notes_signup(p_token)`, the old two-argument version is dropped); pre-existing "confirmed" rows need a fresh click; only accounts that can sign in count as members; the cleanup counts from the newest link; visitor ledger rows record the catalog step (`claim_weekly_note_subscriber` gained `p_steps`, the three-argument version is dropped); erasure covers the form's send log and the delivery log. `weekly_notes_candidates` and `admin_erase_account` are restated with one change each (both matched production before restating). Functions: `send-email` passes `p_steps`; `subscribe-weekly-notes` handles the quiet status. If send-email deploys before the migration, its visitor claim fails and is retried 20 hours later with nothing used up; if the migration lands first, the old send-email's claim still works (p_steps is optional). Checked in production after the deploy: all twelve functions match the tested definitions, and a rolled-back run showed the inbox limit, the refused address, the quiet reply for a suppressed address, the confirm, and the grants (signed out can only press confirm).

**Second review round, 18 October (`20261018150100_weekly_notes_visitor_fixes_2.sql`):** a stopped visitor's new profile starts with the notes off whatever the sign-up box said (trigger `profiles_weekly_notes_visitor_stop`); the member rule counts only stops on rows that asked for the notes, and future stop dates are cleared; the limits come before the quiet rule and quiet requests are logged (kind `quiet`), so replies cannot tell them apart; the quiet rule checks the inbox against suppressions and only treats sign-in accounts as members; international domains are accepted again; confirmations older than the request are cleared and not counted; unpressed links on stopped rows are dropped after 30 days. `subscribe-weekly-notes` waits a moment on a quiet reply so its timing matches a send. Numbered `150100` because `150000` was dated ahead of its time; see the note in `docs/MIGRATIONS.md`.

**Third review round, 18 October (`20261018150200_weekly_notes_visitor_fixes_3.sql`):** the visitor-stop trigger now records the stop as the member's choice (off, dated at the stop), because a profile with no choice had the ticked sign-up box saved over the stop at the member's first sign-in; a profile the old trigger already left without a choice gets one. The form's quiet rule and the visitor candidates match suppressions with the new `email_inbox_suppressed()` (exact, without the plus tag, and every Gmail spelling), so a plus-tag bounce no longer silences the plain address outside Gmail; a member with all email off is matched by inbox too. Confirmations dated in the future are cleared. `subscribe-and-send-guides` (the homepage guide form) now gives every accepted request the same reply and logs unsubscribed addresses toward the daily limit, so it can no longer show who unsubscribed.

**Fourth review round, 18 October (`20261018150300_weekly_notes_visitor_fixes_4.sql`):** an inbox is one person throughout. One function decides what counts as a visitor stop (`weekly_notes_visitor_stop_at`: any spelling of the inbox, after a request, not followed by a newer sign-up), used by the profile trigger, the first-sign-in rule, the member rule and the visitor candidates. The stop link now records the member's choice on a profile that was already off with no choice (before, the first sign-in could save the ticked box over the stop), and the first-sign-in rule checks for a stop itself. Spam complaints silence every spelling of an inbox again (only bounces keep the narrow match). An inbox with an account is a member on the form, on the confirm button and in the visitor candidates, and a second spelling of an inbox that already gets the notes is answered "already". Erasure removes form-log rows for every spelling. Two expression indexes keep the inbox lookups fast (2,000 visitors and 2,000 suppressions: about 0.6 s, from about 84 s). The daily cleanup also deletes the homepage guide form's log after 30 days, and `subscribe-and-send-guides` checks the do-not-email list before sending. `subscribe-weekly-notes`: the "already" and "member" emails mention another spelling of the address.

**Fifth review round, 18 October (`20261018150400_weekly_notes_visitor_fixes_5.sql`):** the member rule had become slow with many members (it read every profile once per member: about 65 s at 10,000 members, paid again by every member claim); it now reads a member's last choice only when the inbox has a visitor stop (3,000 members: about 0.4 s). "Already signed up" counts only a spelling that gets the notes now (`weekly_notes_inbox_signed_up`), so a bounced spelling cannot lock an inbox out. The stop link stops every spelling of the inbox and kills every pending link for it; the confirm button takes the form's per-inbox lock (two clicks at the same moment: the second answers "already", checked with two connections); visitor candidates pick one spelling per inbox. Both claims and both 7-day rules count the whole inbox, so moving between spellings repeats nothing. `email_is_suppressed` (send-email's check before every member email) and the member candidates match the do-not-email list by inbox. Account erasure removes visitor rows, ledger and polls for every spelling; a visitor erasure is refused when any spelling has an account. The guide form's daily limit counts the inbox (new generated column `guide_email_sends.inbox_key`). One-time data fixes stop spellings left confirmed beside a newer stop and turn off profiles whose last choice is older than a visitor stop. `/WeeklyNotes`: the member answer reads "You have a Geck Inspect account".

**Sixth review round, 18 October, merged 24 October (`20261024182000_weekly_notes_visitor_fixes_6.sql`).** Deployments were paused on 18 Oct, so it waited in a draft PR. It was written as `20261018172000` and re-dated on 24 Oct to sort after `20261020230000_email_relevance_and_outcomes.sql`, which had rewritten `weekly_notes_candidates` in the meantime; the member rule in this file is built on that newer body, so the relevance gate (a gecko on record or a sign-in within 60 days) stays. The same merge fixed two CI failures already red on main: the Weekly Gecko Notes SQL tests (their members had no gecko and no sign-in, so the 20 Oct gate left them out) and the browser test job (pinned to Ubuntu 24.04, because Playwright 1.56 cannot install Chromium on the Ubuntu 26.04 runners). Both claims lock the inbox instead of the spelling (two accounts on one inbox could otherwise claim at the same moment and get the same note twice; production had one such inbox due on 18 Oct, the owner's own test accounts). Account erasure keeps another live account's rows on the same inbox; erasure scrubs every spelling from the delivery log; an index on `profiles (lower(email))` keeps the member rule fast when inboxes have visitor stops; a spelling that never confirmed only loses its link when the inbox stops; a visitor erasure is not blocked by an unconfirmed sign-up; and the 7-day and 20-hour rules allow 10 minutes, so the hourly run 7 days or 20 hours later counts even when it starts a fraction of a second earlier than the last one did (on 18 Oct the 22:50 run skipped 20 members polled at 02:50:00.306 because it started at 22:50:00.098). The erasure fix showed up live the same evening: deleting a test account at 23:10 wiped the poll rows of the owner's two other accounts on the same inbox. Merging it applies the migration; nothing else is needed.

## Done on 3 October

**Edge functions deployed** (all from the repo copy):

| Function | Version | What it unlocked |
|---|---|---|
| `send-email` | v25 | Vet follow-up, task reminder, photo rejection, support reply and deletion-request emails; unsubscribe link and List-Unsubscribe headers |
| `send-push` | v23 | Vet follow-up, task reminder and photo rejection push |
| `email-unsubscribe` | v1 (new) | One-click unsubscribe from mail apps |
| `waitlist-signup` | v1 (new) | Waitlist email confirmation and the "your place in line" email |
| `invoke-llm` | v28 | AI Consultant refunds a failed message |
| `set-platform-connection` | v17 | Bluesky handle and app password checked before saving |
| `publish-social-post` | v27 | Copy-out costs no post credit; two-Pages fix |
| `recognize-gecko-morph` | v63 (v64 on 5 Oct) | Free Morph ID try refunded on "better photos needed" (D19) |
| `admin-delete-account` | v1 (new) | Account erasure; said "not installed yet" until the erasure migration ran on 8 October (now v2) |

**Migrations applied:**
- `20261003204952_morph_photo_credits`: closed the open read rule on `morph_reference_images` (anyone could read pending and rejected submissions with the submitter's email), added `morph_community_photos()`, and every new notification title.
- `20261003205612_morph_community_photos_moderation`: morph pages skip hidden photos and blocked members. Kept the four-column output, so the Report button on morph photos cannot offer "block" (adding the column needs a DROP FUNCTION).
- `20261003210328_reptile_event_weight_backfill`: 14 old reptile weights copied into the number column.
- `20261003210527_scrub_stored_email_names`: emails stored as names and reviewer emails in photo training data replaced (0 left).

## Cleared on 8 October: the SQL script

These were bundled in `docs/planning/deploy-queue-2026-10-03.sql` because the Supabase MCP tool would not run statements containing `delete`, `drop` or `revoke`. They all reached production on 8 October 2026. The versions below are what production's migration history records (the timestamp is the time it ran, in UTC); PR 107 renamed the repo files under `supabase/migrations/` to the same names. Do not run the `.sql` bundle again.

| Was queued as | Applied as (8 Oct, UTC) | Checked 15 Oct |
|---|---|---|
| `20261003220000_account_erasure` | `20261008081305_account_erasure` | `admin_erase_account()` exists; `admin-delete-account` is live (v2) |
| `20261003220100_anon_hide_owner_email_columns` | `20261008081011_anon_hide_owner_email_columns` | signed-out visitors cannot read `geckos.created_by` |
| `20261003220200_anon_hide_email_columns_more` | `20261008081043_anon_hide_email_columns_more` | in the history |
| `20261003220300_waitlist_require_confirmation` | inside `20261008063704_lock_security_definer_execute` (lines 41 and 48 of that file) | signed-out and signed-in callers can no longer run `join_waitlist()`; only the server can, so waitlist signups go through the confirmation email |
| `20261005190000_personal_weighin_reminders` | `20261008081343_personal_weighin_reminders` | the `personal-weighin-reminders-daily` job runs at 14:20 UTC and is active |

The same day also applied `20261008081101_public_gecko_photos` and `20261008083025_pin_function_search_path`.

The signed-out page checks that were meant to follow the run (landing page, a passport, a morph page, a /Breeder page, a /store page and a waitlist page) are still worth doing once on a phone. If one of them breaks, `grant select on public.<table> to anon;` restores that table's old access while it is fixed.

## Also for Tennyson

- Undeploy `rapid-api` (hello-world template, no caller, no copy in the repo). `admin-end-trial` is a disabled stub and can go too (also delete its folder in `supabase/functions/`). Both were still deployed on 15 October (`rapid-api` v19, `admin-end-trial` v9).
- Round 2's and round 3's dashboard steps are listed under each round's "what still needs Tennyson" above.
- Promote, the AI Consultant, Other Reptiles and the store are retired (round 3); `docs/planning/retired-features-2026-10.md` says how to switch each back on.

## Real-device and real-email checks

- Airplane mode: open Field Mode online, go offline, log a feeding, see "waiting to sync", go online, confirm it saved.
- A task due today in the Season Planner and a vet follow-up due today: bell, email and push arrive with the app closed (after 14:20 and 14:25 UTC).
- Transfer a gecko to a brand-new account from the email; the buyer sees weights on the passport.
- Waitlist: sign up, confirm from the email, get the "your place" email, the breeder is notified.
- Report something, then hide it from Admin, Reports; it is gone for another account and signed out.
- Hatch an egg from each entry point on a phone; check the limit message on a Free account with 10 geckos.
- Now that the erasure migration is live (8 Oct): erase a disposable account from the Support inbox. The login is gone, its files are gone, a sold gecko's photo still loads for the buyer, the ticket closes.
- One-click unsubscribe from a real Gmail message.
- Connect a real Bluesky account and publish; a copy-out leaves "Posts this month" unchanged.
- A blurry free-account Morph ID gives the month's free identification back.
- Print the rack label sheet on US Letter.

## Added 5 October: funnel and Morph ID credits

Done on 5 October (details in `instrumentation-2026-10.md`):

- Migration `20261005150008_growth_funnel_admin`: admin Funnel card; the admin account is left out of the Overview tiles.
- Migration `20261005145947_morph_id_request_keys`: Morph ID retry replay table, and the free try no longer counts against the first paid month.
- `recognize-gecko-morph` v64: the analyzer call stops at 90 s so a slow run is refunded, and a retry or double tap with the same photos is not charged twice.

The Breeder member who cancelled on 30 Sep gets a free month instead of the credit back (next section).

## Added 5 October: personal weigh-in reminders (applied 8 October)

- **Applied 8 October** as `20261008081343_personal_weighin_reminders` (see "Cleared on 8 October" above). What follows is the 5 October note, kept for history. Migration `supabase/migrations/20261005190000_personal_weighin_reminders.sql`, written and not applied at the time. It adds `enqueue_personal_weighin_reminders()` (a daily job at 14:20 UTC that reads `profiles.extra_data.care_reminders`), makes the weekly 30-day weigh-in nudge skip geckos the daily job covers and members who turned weigh-in reminders off, and schedules the job. It contains `revoke` lines, so the Supabase MCP tool will wait for a confirmation; it is now included in `deploy-queue-2026-10-03.sql`, so the one SQL Editor run covers it. The app works without it (the switches save and the dates show), but no weigh-in push or email goes out for new geckos until it runs. Details in `activation-2026-10.md`.

## Added 5 October: complimentary plans (applied)

- Migration `20261005185312_membership_comps`, applied. A `membership_comps` table (email, tier, start, end, reason) and both effective tier functions now return the higher of the paid plan and an active comp, so Morph ID credits, the gecko limit and featured breeders all follow it. A Stripe cancellation does not end a comp. Members can read their own rows; only admins and the server can add them. The app reads the comp at sign-in (`src/lib/userProfile.js`) and `resolveTier()` honours it.
- First comp: the Breeder member who cancelled (free Morph ID try counted against the paid allowance) has Breeder free until 1 Dec 2026, so November gets 6 fresh Morph IDs.
- To give someone a comp, in the SQL Editor: `insert into public.membership_comps (email, tier, ends_at, reason) values ('person@example.com', 'breeder', '2027-10-01', 'Founding breeder year');`

## Added 5 October (evening): Morph ID and value estimates

Applied to production on 5 October:

- `20261005210000_listings_species_crested`: value estimates and the Market page had stopped seeing new listings on 1 October. The new detail scraper stores species as `'crested-gecko'` (the column default), and every price reader only counts `'crested'` or unknown, so 5,092 listings were invisible. A trigger now stores the value as `'crested'` and the existing rows were corrected. Lilly White now prices from 1,686 listings instead of 788. The column default was left alone: changing it needs an exclusive lock that timed out under scraper traffic, and the trigger makes it irrelevant.
- `20261005201211_market_data_health`: a read-only, service-role-only function the daily health check uses.

Deployed on 5 October (the live files match the repo byte for byte):

- `recognize-gecko-morph` v65: one automatic retry when Anthropic is overloaded, rate limited or drops the connection; a cut-off answer is retried or refunded instead of reading as "Better photos needed"; an unreadable photo gets its own message.

New on `main`:

- `.github/workflows/daily-canary.yml`: every morning it checks that new listings are reaching the value estimates, prices four reference geckos, and runs two real identifications. A failure emails the repo owner. About 6 cents a day. Run it once by hand (Actions > daily-canary > Run workflow) to confirm the secrets work.

## Added 7 October: Promote drafting

Deployed: `generate-social-post` v22 (matches the repo). Not yet exercised against the live Anthropic API because this session has no key. First check: as an admin, open Promote, pick a gecko with photos and weights, write a line under "What's going on", and press Write 3 drafts. If it errors, the function log line `anthropic failed` shows why.

## Added 14 October: Sable and Highway in Morph ID (deployed 15 October)

**Done 15 October:** `recognize-gecko-morph` v71, deployed from the repo by the Supabase GitHub integration when PR 129 merged (see "Round 1" above), includes this `taxonomy.ts`. The note below is kept for history.

The new `taxonomy.ts` lets the model return `sable`, `highway` and `luwak`, and `index.ts` tells the model to name the look-alikes a photo cannot rule out (line-bred looks, shared genes) in its uncertainty reasons. The rest of the Sable work (tag picker, morph guide page, glossary, marketplace filter, calculator) was already live through Vercel.

## 18 October: public content approval

New forum posts, comments and gallery photos now start pending and hidden from
other members and visitors. Text/photo edits return them to pending. Existing
published rows keep their visibility. Admin Panel > Reports now includes a
Publication approvals queue with full text, all attached photos, approval and
rejection. Approval checks the revision being reviewed so concurrent edits cannot
be published unseen. Existing report/hide/block handling stays in place.

Migration: `20261018152154_public_content_approval.sql`. Verified on a fresh
Postgres 16 database through all 299 migrations, repeated safely, and tested as
owner, another member, anonymous visitor and admin. All 29 SQL regression files
passed after the visual-search fixture explicitly marked its photos approved.
The iOS release build passed all 3,419 unit tests, lint and the 172-route SEO audit.
Physical-device testing of this new admin flow and TestFlight build remains pending.

## 19 October: profile for members who add an email later

Facebook sign-in (still switched off) can produce an account with no email
when the Facebook account was made with a phone number. Profiles are keyed by
email, so the signup trigger skips them. The app now shows an "Add your email"
screen (`src/components/auth/AddEmailGate.jsx`) instead of loading, and a new
trigger runs `handle_new_auth_user` when an account's email goes from empty to
set, so confirming the email creates the profile.

Migration: `20261019214000_profile_when_email_added.sql`. Additive (a new
trigger only). Checked against production inside a rolled-back transaction.
No current account lacks an email (73 of 73 have one), so nobody is affected
until Facebook is switched on.

Same day, the one case left: the email typed already has an account. The
screen now offers "Use my existing account", which calls the new
`discard-empty-account` edge function (declared in `supabase/config.toml`,
verify_jwt true) to delete the caller's login, signs out, and opens sign-in
with the email filled in. The function deletes only the caller, and only when
that login has no email, no phone and nothing but social identities
(`supabase/functions/_shared/empty-account.ts`). Passed `deno check`.
## 19 October: automatic approval for public content

The approval queue from 18 October now only gets the items that need a person.
The database decides on each new post, comment, gallery photo and edit:

- A held word (slurs, explicit words, threats, off-platform contact such as
  WhatsApp or Telegram, scam payment phrases) always waits for an admin.
- A member with rejected content, or approved content a moderator later hid,
  always waits.
- A member with at least 2 approved, visible items is approved at once.
- Anyone else is approved at once for text with no photo or link; a photo or a
  link waits.
- An edit of something live follows the same rules. An edit of something
  pending or rejected waits.

The reason is stored in `approval_hold_reason` and shown in the admin queue.
Held words live in `public.moderation_held_terms` (admin-only), so a word can be
added in the SQL editor without a migration. No third-party service sees the
content. Reports, blocking and moderator hide/remove are unchanged, and a
moderator's hide survives the author's edit.

Migration: `20261019230000_public_content_auto_approval.sql`. Additive, so the
app version open in browsers keeps working. Verified on a fresh Postgres 16
build of all migrations, applied twice safely; all 29 SQL regression files pass,
including the rewritten `public_content_approval.sql`. 3,423 unit tests pass.
The rule runs in the database, so the iOS build already uses it with no rebuild.

## 19 October: Verified MorphMarket seller and the MorphMarket CSV

MorphMarket has no "sign in with MorphMarket" and no public API, so a member
proves they own a store with a code. On My Store, the MorphMarket store card
gives a code like `GI-7K3P9Q`; the member pastes it into their MorphMarket
About text and presses Check my store. The new `verify-morphmarket-store`
function reads the public store page and, when the code is there, their
breeder page shows "Verified MorphMarket seller" linking to the store. If
MorphMarket blocks the automatic read, the store appears at the top of Admin >
Breeder verification for a check by hand ("Code is there" or "Not there").

Migration: `20261019233000_morphmarket_store_links.sql` (a new table and two
admin functions, additive). Checked against production inside a block that
rolled back: the table and grants apply, a second member cannot verify a store
already verified to someone else, and signed-out visitors cannot run the admin
functions. Function: `verify-morphmarket-store`, declared in
`supabase/config.toml` with `verify_jwt = true`, so the merge deploys it. No
secrets needed.

Proven 24 October: MorphMarket returned 403 to both the exact local User-Agent
and the Supabase function. Use the hand-check process below when blocked.

The MorphMarket CSV export now starts with an `Animal_ID` column (the Geck
Inspect ID code, or the record id), which Bulk Import 2.0 requires and uses to
update listings on a second upload instead of adding copies. The original photo
column was `Photo URLs`; the 24 October live check below
corrected it to `Photo_Urls`. The importer reads
MorphMarket's own header spellings (`Animal Id`, `Birth Date`, `Desc`,
`Photo Urls`) and keeps the Animal ID as the gecko's ID code, so a second
import of the same file is refused row by row instead of duplicating geckos.
The original build session could not reach MorphMarket. The live two-row
check below now supplies that proof.

### 24 October safety follow-up: export paused

Tennyson superseded warning-only: do not allow export if it could erase existing
MorphMarket data. Both export screens now disable every CSV download and copy
control, and the shared production CSV builder rejects export even for complete
records. Import is still available. Two regression cases prove rejection before
any download is created; the existing formatter and formula-safety tests remain.
Validation: all 3,484 tests in 296 files pass; lint has 0 errors and 75 existing
warnings.

At the safety pause, the old export had 14 of 33 supported fields. The reference
below records the missing 19, lossy mappings and replacement listing-field
workflow. The later full-field workspace and preservation proof below supersede this pause.
The earlier successful create/update test remains valid historical evidence,
not permission to re-enable a potentially destructive export.

### 24 October: full listing workspace and preservation proof

Added private storage for all 33 supported fields, the original source and draft,
with owner-only access even when the gecko is public. The workspace at
`/MorphMarketExport` loads a complete fresh Animal Records CSV, matches exact
seller IDs, exposes every field, shows explicit changes and resolves conflicts
with saved edits. It blocks erasing populated values, changing identity,
unknown columns, invalid values and spreadsheet formula transformations.
Collection values are optional suggestions, never automatic replacements.
Complete reverse imports atomically save the private fields and create private
animals, or match an existing ID without overwriting collection details.

Migration `20261024204147_morphmarket_listing_details.sql` applied in the local
311-migration PostgreSQL harness. Regression checks passed for owner privacy,
anonymous access denial, stale saves, identity, blanking and atomic rollback.
All 3,544 tests in 301 files pass; lint has 0 errors and 73 existing warnings.
The expanded live preservation test passed with the shared formatter: A changed
126 to 127 and retained its other 32 supported fields; B retained all 33. Private
notes, wholesale details, shipping, diet, length, proven breeder, group ID and
sale preferences were populated and retained. Fixed real export spellings for
diet and length units. The deployed editor saved both full private records and
visibly refused clearing price. Guarded downloads require a fresh source and
review; the old quick-export builder stays blocked. See the reference for proof
scope and the final UI checks.

Final production UI proof on `9d8fb4b`: downloaded the reviewed two-row file
from Geck Inspect, uploaded it unchanged to MorphMarket, then exported the same
pair again. A changed 127 to 128 and retained the other 32 supported fields;
B retained all 33. Listing numbers stayed 4174375 and 4174376, with no duplicates.
Refreshed and saved the returned source with no pending changes. The live return
import reported zero created and two matched. All disposable records remain
archived. Final checks: 3,564 tests in 302 files pass, lint 0 errors and 71
existing warnings, production deployment READY. Active sale/payment,
wholesale-only and populated-video behavior remain outside the live proof.

### 24 October follow-up: badge and CSV round trip proven

Read all 33 Supported Fields on the signed-in MorphMarket Import Animals
page. The full list and allowed values are saved in
[morphmarket-import-reference-2026-10-24.md](morphmarket-import-reference-2026-10-24.md).
Corrected export headers to State, Desc and Photo_Urls, removed Currency
(MorphMarket uses Seller Profile currency), corrected Subadult, used spaces
between traits and rounded weights to whole grams. ISO dates and comma-separated
photos match the published field rules. Empty optional columns are omitted
and the preview matches the file, but
live testing proved omission does not protect existing values. Both export
screens warn that missing values can erase data, including omitted columns,
and explain currency, shipping and keeping Animal_ID unchanged.

A real six-row MorphMarket export exposed starred required headers and
M/D/YYYY birth dates, which the parser now reads. It skips the Leachianus
row with a warning, keeps five crested rows, warns about partial dates and
blank seller IDs, and has a redacted regression fixture. It also reads
State, M/F sex initials and space-separated photos, and
no longer mistakes Not For Sale for For Sale. It keeps private, unlisted,
inactive and expired listings private, and warns when a partial birth date
cannot be stored as a full hatch date.

Validation: `pnpm lint` passed with 0 errors and 75 existing warnings;
`pnpm test` passed all 3,479 tests in 295 files. The real downloaded CSV
also passed assertions for titles, dates, photo counts and species filtering.
Commit `63994ac0` was pushed directly to main and Vercel reported a successful
production deployment. The live Import CSV dialog then showed the five
crested records with correct names, sexes, traits and prices and all eight
expected warnings. Cancelled without creating records. Separate GitHub
member-flow and database checks also failed on the preceding commit: the
browser installer does not support the runner's Ubuntu version, and two
weekly-email SQL fixtures fail. The main checks job was cancelled when a
newer unrelated commit arrived.

Live store proof: Tennyson supplied `tennyson_miles`. Curl with the exact
function User-Agent returned 403 and a Cloudflare challenge page. The real
My Store check saved `pending`, `needs_review=true`, and `MorphMarket answered
403`; edge logs confirm the check ran. After reading the visible About code,
Admin > Breeder verification > Code is there saved `verified by an admin`.
Saved the breeder profile and confirmed the public badge at
https://geckinspect.com/Breeder/thegeckogarden links to the correct store.
The card now explains the hand check and retaining the code until verified.
Tennyson approved removing the code on 24 October. Removed only that paragraph
and confirmed it is absent from the public About text.

Live CSV proof: created two disposable Pet records, exported them through the
production batch builder and uploaded the unchanged CSV with Synchronize/Replace
off. MorphMarket created listings 4174375 and 4174376 with the correct fields
and all three photos. Changed A's price from 125 to 126 in Geck Inspect,
exported and uploaded again: the same two listing numbers remained, with no
duplicates. Exported the pair from MorphMarket and imported through the live
Geck Inspect dialog: two records created, with IDs, dates, sexes, prices,
weights, descriptions as notes and photos retained. Existing seller IDs were
correctly refused first; only the disposable originals were renamed and
archived to permit the return test. All four Geck Inspect records and both
MorphMarket listings are now archived; permanent deletion remains with Tennyson.

Data-loss finding: a separate upload with Price, DOB and Weight columns removed
still cleared both dates and weights and changed both prices to $0. The importer
adds missing fields as blank. Restored all values with the full file. Warnings
now explain this directly. Tennyson initially chose warning-only, then
superseded that choice with the export pause above. See the
reference for exact test values and scope. For Sale shipping, payments and
sold-state flows were not exercised.

Final validation on current main: `pnpm lint` passed with 0 errors and 75
existing warnings; `pnpm test` passed 3,479 tests in 295 files. The exact
lockfile installed successfully. No formula-neutralization behavior changed.

## 20 October: email overhaul (letters, preview lines, relevance gate)

Migration: `20261020230000_email_relevance_and_outcomes.sql`. It replaces
`weekly_notes_candidates` with the same signature (grants kept), adding one
condition: a member needs a gecko on record or a sign-in within 60 days. It
adds the admin-only `email_outcomes(p_days)`. No table or column changes. The
gate was checked against production read-only: next week's list goes from 57
members to 35.

Function: `send-email` (already declared, so the merge deploys it). The
getting-started emails and Weekly Gecko Notes are now plain letters signed by
Tennyson, with a preview line, and use two new optional secrets,
`EMAIL_FROM_PERSONAL` and `EMAIL_REPLY_TO`. Unset, they send from
`EMAIL_FROM` as before and ask no reply question.

Waiting on Tennyson: the Resend webhook (never connected; no open, click,
bounce or complaint has ever been recorded) and the two secrets.
`docs/marketing/email-brain.md`, section 1, has the links and values.

## 24 October: personal and seasonal weekly notes, the re-permission email

Migration: `20261024150000_weekly_notes_personal_and_repermission.sql`. New:
`weekly_note_facts`, `claim_weekly_note_from` (the claim with catalog
steps; `claim_weekly_note` stays for a rollback), the table
`weekly_notes_repermission_sends`, `weekly_notes_repermission_candidates`,
`claim_weekly_notes_repermission`, `keep_weekly_notes_by_token` (anon and
authenticated, checked by the signed token), `enqueue_weekly_notes_repermission`
and the job `weekly-notes-repermission-hourly` (55 past). Replaced with the
same signature: `weekly_notes_candidates` (a yes within a year passes the
gate) and `email_outcomes` (a re-permission row). The switch
`weekly_notes_repermission_enabled` is added off. Checked against production
in a block that rolled back: 24 members qualify, 38 keepers, 26 with a
female, 15 with an adult female, 9 breeders.

Function: `send-email` (already declared). Site: the `/KeepNotes` page.

## 24 October: transfer requests from the passport page

Migration: `20261024181000_passport_transfer_request.sql`. It adds
`request_passport_transfer(passport_code)` (signed-in members only) and
replaces `notify_dispatch_on_insert` with its production body plus one title
line for the new `transfer_request` type. No table or column changes.

Why: the passport's "Ask the seller for a transfer invitation" button only
opened an empty chat, so an owner heard nothing when a buyer scanned the QR
code. The button now sends the owner a chat message and a `transfer_request`
notification (in-app, email and push, following the owner's "new message"
setting). The notification opens the gecko with the transfer form already
open and the buyer's email filled in. One request per buyer per gecko a day,
at most 10 an hour per buyer, and blocking stops it both ways.

Functions: `send-email` and `send-push` (both declared) map
`transfer_request` to the "new message" preference.

Regression file: `supabase/tests/passport_transfer_request_regressions.sql`.
Nothing waits on Tennyson.

## 24 October: getting-started email spacing (written 19 October)

Written on 19 October as `20261019001200` and held while deployments were paused; merged on 24 October as `20261024183300_lifecycle_spacing_allowance.sql`, re-dated to sort after the migrations that went live in between (the last is the Weekly Gecko Notes sixth round, `20261024182000`). Merging it applies the migration; nothing else is needed. It restates `lifecycle_email_candidates` (the body matched production by checksum on 19 and 24 October) with one change: the 20-hour spacing allows 10 minutes for the hourly run's clock. Each `lifecycle_email_sends` row is stamped with its run's start, which moves by a fraction of a second, so an exact 20 hours could leave a member for the next hour (the same pattern skipped 20 Weekly Gecko Notes members in the 22:50 run on 18 Oct). Only day 0 and day 1 can meet the rule, and in production no member had reached it by 19 October. The weekly notes rule against a recent getting-started email needs no change: its stamps are at 35 past and weekly runs at 50 past. Test: section 8 of `supabase/tests/lifecycle_regressions.sql`, which fails with the exact comparison put back.

## 24 October: re-permission email fixes

Migration: `20261024201200_weekly_notes_repermission_fixes.sql`, dated after `20261024183300`, production's newest when it was pushed. Two fixes, found while finishing the sixth Weekly Gecko Notes review:

- `claim_weekly_notes_repermission` locks the inbox, not the spelling, as the weekly notes claims do since `20261024182000`. Two accounts on one inbox are asked about in the same hourly run; with a lock per spelling both claims could pass the once-per-inbox check and the person would get the email twice. (This entry first said the email was still switched off. Tennyson switched `weekly_notes_repermission_enabled` on at 18:26 UTC on 24 Oct; the first hourly run that can send is 23:55 UTC on 25 Oct, 7 days after the 18 Oct weekly notes.)
- `admin_erase_account` deletes the re-permission record (`weekly_notes_repermission_sends`), which `20261024150000` added after the function was last written. The erased address's own row goes, and every spelling of the inbox when no other account that can sign in remains, the same rule as the weekly notes ledger.

## 24 October: last use of the app, the re-permission email, erasure

Migration: `20261024210200_weekly_notes_activity_and_erasure.sql`, dated after `20261024204147`, production's newest when it was pushed. Merging it applies the migration and deploys `send-email` (new wording in the re-permission email); nothing waits on Tennyson. Each function it replaces matched production by checksum before the push. From a review of every email path on 24 Oct:

- "Signed in within 60 days" now means "used the app within 60 days". The gate read `auth.users.last_sign_in_at`, which only a typed sign-in moves, so a member with a saved session (the web app left signed in, the phone apps) looked dormant. The new `weekly_notes_last_active` takes the latest of the sign-in, a saved session's refresh (`auth.sessions`) and the member's own `user_events`. The weekly notes gate and the re-permission email both use it. On 24 Oct this took one member (in the app on 9 Oct) off the re-permission list and back onto the weekly notes: 22 members are due the email from the 25 Oct 23:55 run, not 23.
- The re-permission email skips an inbox where another account passes the gate (that account already gets the notes).
- The re-permission job does nothing while the weekly notes are paused (`weekly_notes_enabled`), so it never offers notes that cannot come.
- Account erasure removes the address and the reason from a free-plan grant (`membership_comps`): the row stays under the tombstone address for the counts, and the plan cannot come back on a new sign-up with the same address. Production had one grant.
- A visitor erasure is refused again when any login (confirmed or not) or any profile is on the inbox, and the reply lists those spellings so `admin_erase_account` can run for each. Round 6 (`20261024182000`) let an unconfirmed sign-up through, which left that login and its profile behind. Production had no unconfirmed logins.
- Not a migration, same push: the re-permission email says "opened Geck Inspect", not "signed in"; `/KeepNotes` says the next note arrives within a week as long as email is on in Settings; the Privacy Policy (dated 24 Oct) describes the pause, the email and its record, and says the form logs keep the address as well as its simplified form.

Tests: sections 6 to 8 of `supabase/tests/weekly_notes_repermission_regressions.sql` and the visitor erasure block in `weekly_notes_visitors_regressions.sql`, each checked by putting the old rule back; `src/lib/__tests__/privacyPolicy.test.js` reads the re-permission table's columns from its migration.

New test file: `supabase/tests/weekly_notes_repermission_regressions.sql` (who is due it, the lock, once per inbox, the keep button, the job and its switch, erasure). Production's copies of both functions matched main's migrations before the push. Nothing waits on Tennyson.

## 28 October: quiet the Morph ID evaluation account, a canary for the stalled US feed

Migrations: `20261028014800_quiet_morph_eval_account.sql` and `20261028015600_market_health_full_pass.sql`, dated after `20261024210200`, production's newest when they were pushed. Merging applies both; nothing waits on Tennyson.

- The Morph ID evaluation account (`app_metadata.morph_eval = true`, used by the accuracy test and the daily canary) had Weekly Gecko Notes and notification emails on. Its address has no mailbox, so the 26 Oct note retried for hours and then bounced: 9 of that day's 13 delayed emails and one of the two bounces. The first file turns both switches off for every evaluation account (data only). `scripts/morph-id-eval/evalAccount.mjs` keeps them off on every run and creates a new account with the sign-up box answer "no".
- The daily canary passed every day while the full US market pass had stalled (last complete pass 19 Oct, US Price Index last full day 6 Oct), because its only freshness check was "some new listings in 3 days". The second file adds `last_complete_pass_at`, `coverage_pct` and `us_last_full_day` to `public.market_data_health()` (the full 5 Oct body plus three keys, service role only as before). The canary's new check "a full US market pass in the last 9 days" (`scripts/canary/marketFreshness.mjs`, tested in `scripts/canary/__tests__/marketFreshness.test.js`) fails while either date is older than 9 days. **It will fail every day until the US feed runs again**, which is Tennyson's call (the proxy question in `docs/planning/market-habit-2026-09-30.md`). The other canary checks still report one by one in the run summary.

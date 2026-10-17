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

## Added 16 October (evening): photo listing, sign-in landing, size check

**Supabase (migration `20261016220000_media_listing_closed.sql`):** visitors can no longer list the file names in the member photo bucket. Each photo still loads by its address as before; a member can list only their own files and the admin all of them (the thumbnail backfill needs that). Test: `supabase/tests/media_listing_regressions.sql`.

**Vercel:** signing in on a phone lands on Today, on a larger screen on My Geckos (`memberHome` in `src/lib/pwaLaunch.js`). The stored offline copy of My Geckos and Today is now refreshed on every load when online; before, a copy under two minutes old was shown as is, so a gecko added just before closing the app could be missing on reopen. The size check's failure message says what to do, and `pnpm shrink:images` re-saves any picture in `public/` over 200 KB.

**Decided 16 Oct:** the checkout race is fixed only if it happens; the two hand-deployed functions stay as they are; the ReptiDex citations and the Eureka Exotics name on Albino stay; the 115 Blizzard profiles stay as they are; the growth band stays until 50 geckos; no spend on Morph ID grading without Tennyson's OK; the LLC is postponed; 2FA on the admin account in November (a reminder is set). The ten missing Morph Guide field guide plates are painted images, handed to another agent.

**Done by Tennyson, 17 Oct:** the day-one $2.99 refunded (review item 12), and the Supabase service role key rotated (new secret key in Supabase, the `SUPABASE_SERVICE_ROLE_KEY` GitHub Actions secret replaced; the old key revoked the same day, after the daily canary passed on the new one).

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

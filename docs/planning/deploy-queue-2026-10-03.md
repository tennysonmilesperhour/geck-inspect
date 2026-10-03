# Deploy queue, 3 October 2026

The 2 and 3 October ship-ready work is all on `main` and live on Vercel. Some of it waits on production database or edge function changes that were held back for approval, because they can break the live app, change member data, or send email. This is the full list, in the order to apply it. Each item says what it unlocks.

Project: `mmuglfphhwlaluyfyxsp`. After applying a migration with the MCP `apply_migration` tool, rename the file to the version it records (docs/MIGRATIONS.md) and update any test or comment that names the file (`src/lib/__tests__/publicColumns.test.js` and `src/lib/publicColumns.js` name the two email migrations).

## 1. Edge functions (safe to deploy first)

Each one is backward compatible with the live app. Deploy from the repo copy.

| Function | JWT check | What it unlocks |
|---|---|---|
| `send-email` | off (as today) | Vet follow-up, task reminder, morph photo rejection, support reply and account-deletion alert emails; unsubscribe link and List-Unsubscribe headers on every email |
| `send-push` | as today | Vet follow-up, task reminder and morph rejection push |
| `email-unsubscribe` (new) | off | One-click unsubscribe from mail apps. Deploy with or after `send-email` |
| `waitlist-signup` (new) | off | Waitlist email confirmation and the "your place in line" email |
| `recognize-gecko-morph` | as today | Free Morph ID try refunded on "better photos needed" (D19) |
| `invoke-llm` | as today | AI Consultant refunds a failed message |
| `publish-social-post` | as today | Copy-out costs no post credit; two-Pages fix; Bluesky only |
| `set-platform-connection` | as today | Bluesky handle and app password checked before saving |
| `admin-delete-account` (new) | on | Account erasure. Deploy after migration 2b below |

Also: undeploy `rapid-api` (hello-world template, no caller). `admin-end-trial` is a disabled stub and can be deleted too.

## 2. Migrations

### 2a. Morph Guide photos (privacy fix plus feature)
1. `20261002220000_morph_photo_credits.sql`: closes the open read rule on `morph_reference_images` (today anyone, signed out, can read pending and rejected rows with the submitter's email), adds `morph_community_photos()`, and redefines `notify_dispatch_on_insert()` with every new title (vet follow-up, photo rejection, account deletion request, task reminder, support reply).
2. `20261003031000_morph_community_photos_moderation.sql`: must come after 1. Hides moderated and blocked photos.

### 2b. Account erasure
3. `20261002230000_account_erasure.sql`: `admin_erase_account()` (service role only), the admin alert trigger, and the same `notify_dispatch_on_insert()` as item 1 (identical, so order between 1 and 3 does not matter). Then deploy `admin-delete-account`.

### 2c. Signed-out email lockdown (breaking for old clients)
The client that reads only safe columns is live. Do a signed-out smoke test right after: landing page, Dashboard as guest, a passport, a morph page, a /Breeder page, a /store page, a waitlist page.

4. `20261002235000_anon_hide_owner_email_columns.sql`: signed-out visitors lose `created_by` on geckos and `created_by`, `user_id`, `image_embedding`, `training_meta` on gecko_images.
5. `20261003120000_anon_hide_email_columns_more.sql`: signed-out visitors lose read access to user_activity, gecko_likes, questions, answers, morph_traits and morph_price_cache, and lose the email columns on 14 more tables (including feeding and shed records); members lose other members' emails on user_activity, gecko_likes, gecko_of_the_day, questions and answers; final `welcome_shelf()`.

Rollback if a signed-out page breaks: `grant select on public.<table> to anon;` restores the old column access for that table while the page is fixed.

### 2d. Data changes
6. `20261003120100_scrub_stored_email_names.sql`: replaces emails stored as names (2 ownership records, 1 forum comment, 2 photo notes) and the reviewer emails in 3,755 `training_meta` rows.
7. `20261003121100_reptile_event_weight_backfill.sql`: copies 14 "Weight: 45g" notes into the number column. The app already reads the notes, so nothing waits on it.

### 2e. Waitlist (after `waitlist-signup` is deployed)
8. `20261003121000_waitlist_require_confirmation.sql`: closes the old `join_waitlist` to the public, so nobody can sign up an address they do not own.

## 3. Switches in the admin Pages tool

Promote and the AI Consultant are both off for members. Turn them on once their functions are deployed; the Membership allowance lines appear on their own.

## 4. Real-device and real-email checks

These are section 8 of the feature audit plus the new ones:
- Airplane mode: open Field Mode online, go offline, log a feeding, see "waiting to sync", go online, confirm it saved.
- A task due today in the Season Planner: bell and push after 14:20 UTC with the app closed.
- A vet follow-up due today: bell after 14:25 UTC, and email and push once the functions are deployed.
- Transfer a gecko to a brand-new account from the email; check the buyer sees weights on the passport.
- Waitlist: sign up, confirm from the email, get the "your place" email, breeder gets notified.
- Report something, then hide it from Admin, Reports; confirm it is gone for another account and signed out.
- Hatch an egg from each entry point on a phone; check the limit message on a Free account with 10 geckos.
- Erase a disposable account from the Support inbox (after 2b): login gone, files gone, a sold gecko's photo still loads for the buyer, the ticket closes.
- One-click unsubscribe from a real Gmail message.
- Connect a real Bluesky account and publish; confirm a copy-out leaves "Posts this month" unchanged.
- Print the rack label sheet on US Letter.

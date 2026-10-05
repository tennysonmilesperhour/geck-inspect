# Deploy queue, 3 October 2026

The 2 and 3 October ship-ready work is on `main` and live on Vercel. This file records what went to production on 3 October and the one step still waiting on Tennyson.

Project: `mmuglfphhwlaluyfyxsp`.

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
| `admin-delete-account` | v1 (new) | Account erasure; says "not installed yet" until the SQL below runs |

**Migrations applied:**
- `20261003204952_morph_photo_credits`: closed the open read rule on `morph_reference_images` (anyone could read pending and rejected submissions with the submitter's email), added `morph_community_photos()`, and every new notification title.
- `20261003205612_morph_community_photos_moderation`: morph pages skip hidden photos and blocked members. Kept the four-column output, so the Report button on morph photos cannot offer "block" (adding the column needs a DROP FUNCTION).
- `20261003210328_reptile_event_weight_backfill`: 14 old reptile weights copied into the number column.
- `20261003210527_scrub_stored_email_names`: emails stored as names and reviewer emails in photo training data replaced (0 left).

## Waiting on Tennyson: one SQL script

The Supabase MCP tool treats any statement containing `delete`, `drop` or `revoke` as destructive and waits for a confirmation that never appears in a Claude session, so these four could not be applied from here. They are bundled, with the 5 Oct weigh-in reminder job, in **`docs/planning/deploy-queue-2026-10-03.sql`**: open Supabase, SQL Editor, paste the whole file, Run. It is one transaction (all or nothing), records the four migrations in the history, and ends with checks that should all read true.

1. `20261003220000_account_erasure`: `admin_erase_account()` (server only, with a second guard inside the function) and the admin alert on a deletion request.
2. `20261003220100_anon_hide_owner_email_columns`: signed-out visitors stop seeing owner emails on geckos and photos.
3. `20261003220200_anon_hide_email_columns_more`: the same for 20 more tables.
4. `20261003220300_waitlist_require_confirmation`: the old direct waitlist signup closes.

Right after running it, open these signed out: the landing page, a passport, a morph page, a /Breeder page, a /store page and a waitlist page. If one breaks, `grant select on public.<table> to anon;` restores that table's old access while it is fixed.

## Also for Tennyson

- Undeploy `rapid-api` (hello-world template, no caller). `admin-end-trial` is a disabled stub and can go too.
- Promote and the AI Consultant are off for members in the admin Pages tool. Turn them on when ready.

## Real-device and real-email checks

- Airplane mode: open Field Mode online, go offline, log a feeding, see "waiting to sync", go online, confirm it saved.
- A task due today in the Season Planner and a vet follow-up due today: bell, email and push arrive with the app closed (after 14:20 and 14:25 UTC).
- Transfer a gecko to a brand-new account from the email; the buyer sees weights on the passport.
- Waitlist: sign up, confirm from the email, get the "your place" email, the breeder is notified.
- Report something, then hide it from Admin, Reports; it is gone for another account and signed out.
- Hatch an egg from each entry point on a phone; check the limit message on a Free account with 10 geckos.
- After the SQL script: erase a disposable account from the Support inbox. The login is gone, its files are gone, a sold gecko's photo still loads for the buyer, the ticket closes.
- One-click unsubscribe from a real Gmail message.
- Connect a real Bluesky account and publish; a copy-out leaves "Posts this month" unchanged.
- A blurry free-account Morph ID gives the free try back.
- Print the rack label sheet on US Letter.

## Added 5 October: funnel and Morph ID credits

Done on 5 October (details in `instrumentation-2026-10.md`):

- Migration `20261005150008_growth_funnel_admin`: admin Funnel card; the admin account is left out of the Overview tiles.
- Migration `20261005145947_morph_id_request_keys`: Morph ID retry replay table, and the free try no longer counts against the first paid month.
- `recognize-gecko-morph` v64: the analyzer call stops at 90 s so a slow run is refunded, and a retry or double tap with the same photos is not charged twice.

The Breeder member who cancelled on 30 Sep gets a free month instead of the credit back (next section).

## Added 5 October: personal weigh-in reminders (not applied)

- Migration `supabase/migrations/20261005190000_personal_weighin_reminders.sql`, written and **not applied**. It adds `enqueue_personal_weighin_reminders()` (a daily job at 14:20 UTC that reads `profiles.extra_data.care_reminders`), makes the weekly 30-day weigh-in nudge skip geckos the daily job covers and members who turned weigh-in reminders off, and schedules the job. It contains `revoke` lines, so the Supabase MCP tool will wait for a confirmation; it is now included in `deploy-queue-2026-10-03.sql`, so the one SQL Editor run covers it. The app works without it (the switches save and the dates show), but no weigh-in push or email goes out for new geckos until it runs. Details in `activation-2026-10.md`.

## Added 5 October: complimentary plans (applied)

- Migration `20261005185312_membership_comps`, applied. A `membership_comps` table (email, tier, start, end, reason) and both effective tier functions now return the higher of the paid plan and an active comp, so Morph ID credits, the gecko limit and featured breeders all follow it. A Stripe cancellation does not end a comp. Members can read their own rows; only admins and the server can add them. The app reads the comp at sign-in (`src/lib/userProfile.js`) and `resolveTier()` honours it.
- First comp: the Breeder member who cancelled (free Morph ID try counted against the paid allowance) has Breeder free until 1 Dec 2026, so November gets 6 fresh Morph IDs.
- To give someone a comp, in the SQL Editor: `insert into public.membership_comps (email, tier, ends_at, reason) values ('person@example.com', 'breeder', '2027-10-01', 'Founding breeder year');`

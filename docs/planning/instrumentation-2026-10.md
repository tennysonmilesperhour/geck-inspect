# Funnel instrumentation and Morph ID credits, October 2026

Written 5 October 2026. Follows `growth-funnel-2026-10.md`, which found that signups had no source, signup itself was not a first-party event, several gecko add paths sent nothing, and the admin account was most of every chart.

Nothing here has been deployed. The app changes go live with the next push to `main`. Two migrations and one edge function deploy are waiting (see "What is pending" below). Everything in the app works without them; the new admin Funnel card says the migration is missing until it is applied.

## How events flow

Every event goes through `captureEvent` (`src/lib/posthog.js`). That writes one row to `public.user_events` (first party, always on) and sends the same event to PostHog when `VITE_POSTHOG_KEY` is set. When the signed-in member is an admin, every event (page views too) now carries `is_admin: true`, set from `AuthContext` through `setAnalyticsContext` in `src/lib/telemetry.js`.

## First-touch attribution

`src/lib/attribution.js`, called at the top of `src/App.jsx` before the referral and store-grant helpers strip their query parameters. Stored once per browser in `localStorage` key `geck_first_touch_v1`:

| Field | What it holds |
|---|---|
| `referrer_host` | Host of `document.referrer` only (no path or query). Empty for direct visits and in-site links. |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` | From the landing URL, 120 characters max. |
| `landing_path` | First path opened. Claim, collection-invite and passport paths are cut to their prefix so tokens and codes are never stored. |
| `entry` | `passport`, `waitlist`, `store`, `invite`, `claim`, `referral` (`?ref=`), `store_grant` (`?grant=`), or empty. |
| `source` | One bucket for grouping: `utm:<source>`, else the entry, else `search`, `social`, `ai_assistant`, `morphmarket`, `other_site` or `direct`. |
| `captured_at` | When it was recorded. |

On a new account's first session it is copied to `profiles.extra_data.first_touch` (an existing, empty jsonb column readable only by the member and admins, so no migration is needed), together with `extra_data.signup_tracked_at`.

## Events

Properties marked "ft_*" are the first-touch fields above, flattened: `ft_source`, `ft_referrer_host`, `ft_utm_source`, `ft_utm_medium`, `ft_utm_campaign`, `ft_utm_content`, `ft_landing_path`, `ft_entry`.

| Event | When | Properties | Needs a pending migration? |
|---|---|---|---|
| `signup_completed` (new) | First authenticated session of an account created in the last 24 hours. Once per account: a per-browser flag plus `profiles.extra_data.signup_tracked_at` stop repeats on a second device. | `method` (email, google, apple), ft_* | No |
| `gecko_added` (now on every path) | Any new gecko. | `source`: `full_form`, `quick_add`, `morph_id_draft`, `demo_draft` (kept in the guest demo, saved after sign-up), `csv_import`, `hatch`, `claim`, `image_import`, `morphmarket_sync`; `count`; on the form paths also `sex`, `status`, `has_image`, `has_lineage` | No |
| `first_gecko_added` (all paths) | The member's geckos in the database (by `created_by`) number no more than the ones just added. Checked once per page load and once per browser. | `source`, `count` | No |
| `weight_logged` (new) | Any `WeightRecord` insert (detail modal, Weigh-in Mode, Field Mode, Batch Husbandry, the assistant, offline sync), plus the weight saved inside the add or edit form and Quick Add. | `via` (page name, or `gecko_form` / `quick_add`), `at_add` on the form paths | No |
| `feeding_logged` (new) | Any `FeedingRecord` insert (`logFeedings` and everything built on it). | `via` | No |
| `egg_logged` (new) | Any `Egg` insert (Add eggs, breeding plan card, CSV, image import). | `via` | No |
| `first_gecko_flow` (new, 5 Oct activation pass) | Each move through the guided first gecko (see `activation-2026-10.md`). | `step`: `add`, `parents`, `payoff`; `action`: `start`, `shown`, `choose_photo`, `choose_type`, `saved`, `skipped`, `closed`, `guest_kept`, `guest_signup_clicked`, `guest_back_to_demo`, `weight_logged`, `reminder_on`, `reminder_off`, `open_lineage`, `open_record`, `add_another`, `done`; plus `surface`, `source`, `has_morph`, `has_weight`, `reminder` where they apply | No |
| `morph_id_result` (new) | Every Morph ID attempt ends. | `outcome`: `success`, `insufficient` (better photos needed) or `error`; `error_code` on errors; `photo_count`, `free_tier`, `tier`, `credit_refunded`, `replayed`, `top_morph` | No (`replayed` is only ever true after the Morph ID migration and function deploy) |
| `morph_id_analysis_failed` (kept) | As before, for older dashboards. | `error_code`, `photo_count` | No |
| `upgrade_prompt_shown` | Plan limit modal opens; Morph ID locked card shows; Morph ID "out of credits" answer. | `limit_type` (`geckos`, `breeding_pairs`, `other_reptiles`, `morph_id`), `surface` (`plan_limit_<type>`, `morph_id_locked`, `morph_id_exhausted`) | No |
| `upgrade_prompt_clicked` | The prompt's plans button. The surface is remembered for the tab for an hour. | `limit_type`, `surface` | No |
| `plan_selected`, `checkout_started` | Membership page plan button (unchanged), now with the prompt that led there. | `tier`, `interval`, `intent`, `from_prompt` | No |
| `checkout_completed` (new) | Back from Stripe and the account really shows a paid plan (polled up to 6 times). Stripe's webhook log stays the record of money; this is the in-app step. | `tier`, `from_prompt`, `attempts` | No |
| `checkout_returned`, `checkout_cancelled` | Unchanged. | | No |

Bulk paths do not flood the table: the telemetry throttle merges identical events inside two seconds, so a 200-row CSV import writes a handful of `weight_logged` rows, not 200.

Not covered on purpose: weights and feedings for other reptiles (`ReptileEvent`), which are outside the crested gecko funnel.

## Admin accounts left out

| Where | How | Needs a pending migration? |
|---|---|---|
| Admin, Product Analytics (Live metrics) | Events from admin emails, events marked `is_admin`, and every event in a browser session that ever carried one are dropped before counting. Admin profiles are left out of signups. | No |
| Admin, Analytics dashboard | Same for events; admin-owned geckos, photos, plans, posts, comments and messages are left out. | No |
| Admin, Overview tiles | `admin_overview_stats()` returns member-only accounts, geckos and photos, plus `admin_excluded` and `admin_geckos`. Until it is applied the tiles say "includes admin". Today that is 55 accounts instead of 56 and 220 geckos instead of 349. | Yes, `20261005150008_growth_funnel_admin.sql` |
| Admin, Funnel card (new, on Overview and Product Analytics) | `admin_growth_funnel()` leaves out admin accounts and the Morph ID evaluation account. | Yes, same file |

## The Funnel card

`src/components/admin/GrowthFunnelCard.jsx`, reading `admin_growth_funnel(p_weeks)` (12 weeks by default). Per signup week (Monday to Sunday, Denver time, matching the Market habit card) and per first-touch source:

- signups (accounts with a login),
- first gecko within 1 day of signup,
- day 1 return: any `user_events` row 24 to 48 hours after signup, out of accounts at least 2 days old,
- week 2 return: any row 7 to 14 days after signup, out of accounts at least 14 days old.

Source comes from `profiles.extra_data.first_touch.source`, then the `signup_completed` event, else "Not recorded". Every account before 5 October will show "Not recorded".

I ran the query body read-only against production: it returns 10 weeks of rows since July, for example the week of 7 September: 6 signups, 3 first geckos, 1 of 6 back on day 1, 0 of 6 in week 2.

## Morph ID credits: what the code and the ledger show

The question was whether a failed analysis still uses a credit (Member 3's ledger showed 6 used against 5 logged calls and a failure).

**The server refund works.** `recognize-gecko-morph` takes the credit before the analysis and refunds it in its catch block for any error after that point (analyzer error, rate limit, bad response, internal error). The per-network cap and the "out of credits" answer run before a credit is taken.

**Member 3's sixth credit was not a failed run.** All 6 October calls on that ledger row are logged as successful (one at Free, five at Breeder). The recorded "failure" was the seventh attempt being refused with `morph_id_credits_exhausted`, which costs nothing. The real loss: the lifetime free try was counted in the same month row as the paid allowance. When the member upgraded the same day, the row's included credits went from 1 to 6, but the free use stayed in the count, so Breeder delivered 5 of its 6 identifications that month.

**The Keeper ledger with 3 credits and no calls** (5 Sep) cannot be checked: `geck_data.model_invocations` has no rows at all from 25 August to 20 September, so the call log was not being written during that period. No sign of a charge for a failure, but no proof either.

**Paths where a member could lose a credit, and the fix:**

| Path | Before | Fix | Live after |
|---|---|---|---|
| Free try then upgrade in the same month | Free use counted against the paid month (5 of 6) | `consume_morph_id_credit` adds the free use to that month's included credits on the first paid call. Allowances unchanged. | Migration `20261005120100` |
| Slow analysis | No deadline on the analyzer call. The browser gives up at 120 s and shows "took too long, not charged", but the server kept going and charged on success. Past the platform limit the worker is stopped before the refund runs. | Analyzer call aborts at 90 s, and earlier if photo matching used part of a 100 s budget, so the function always answers before the browser does and the abort is refunded (`upstream_timeout`, new friendly copy). | Function deploy |
| Dropped connection or browser timeout after the server finished | Charged, answer lost, and a retry charged again | The page sends a request key per set of photos and answers. The server stores the answer for an hour; a retry with the same key gets it back free (`replayed: true`). Changing photos, life stage or fire state, or "Start over", makes a new key. | Migration `20261005120100` plus function deploy. Without them the key is ignored. |
| Double tap on Identify | Two paid analyses possible before the button re-rendered as disabled | A ref guard in `Recognition.jsx` stops the second call; the server also answers a second call with the same key as "still running" (409, `morph_id_in_progress`, no charge). | Guard: next push. Server check: migration plus deploy. |

**Left as is (a pricing decision, not a bug):** on paid plans a "better photos needed" answer still uses a monthly credit (decision D19 refunds it only for the free try). Morph ID copy for paid members says "One credit is charged only when an analysis runs", which is accurate.

**One-off correction for Tennyson to consider:** after the migration, Member 3's October row will still read 6 of 6 used. Raising its `credits_included` by 1 would give back the identification the bug took. That is a data write, so it is not done here.

## What is pending

| Item | Unlocks | How |
|---|---|---|
| `supabase/migrations/20261005150008_growth_funnel_admin.sql` | Funnel card, admin left out of Overview tiles | Applies through the Supabase MCP tool (no destructive keywords). Replaces `admin_overview_stats()` with the same keys plus two new ones. |
| `supabase/migrations/20261005145947_morph_id_request_keys.sql` | Retry replay and the upgrade-month fix | Same. New table with row level security and no policies; replaces `consume_morph_id_credit()`. |
| Deploy `recognize-gecko-morph` | Analyzer deadline, request keys | Deploy after the second migration. It also works if deployed first: it skips the key check when the table is missing. |

After deploying, check: a normal Morph ID still returns a result and shows the right credits left; pressing Identify twice fast runs once; a second Identify on the same photos after a result shows the same answer and the same credits left.

## Files changed

- New: `src/lib/attribution.js`, `src/lib/activation.js`, `src/components/admin/GrowthFunnelCard.jsx`, `src/lib/__tests__/attribution.test.js`, the two migrations above.
- Events: `src/App.jsx`, `src/lib/AuthContext.jsx`, `src/lib/telemetry.js`, `src/lib/posthog.js`, `src/api/supabaseEntities.js`, `src/pages/MyGeckos.jsx`, `src/components/my-geckos/GeckoForm.jsx`, `src/components/my-geckos/QuickAddGecko.jsx`, `src/components/my-geckos/CSVImportModal.jsx`, `src/lib/hatchEgg.js`, `src/pages/ClaimAnimal.jsx`, `src/pages/ImageImport.jsx`, `src/components/marketplace/MorphMarketSync.jsx`, `src/components/subscription/PlanLimitChecker.jsx`, `src/pages/Membership.jsx`, `src/pages/Recognition.jsx`.
- Admin: `src/lib/adminData.js`, `src/components/admin/AdminOverview.jsx`, `src/components/admin/AnalyticsDashboard.jsx`, `src/components/admin/ProductAnalytics.jsx` (also a new Activation funnel: signed up, first gecko, first husbandry log).
- Morph ID: `supabase/functions/recognize-gecko-morph/index.ts`, `src/functions/recognizeGeckoMorph.js`, `src/pages/Recognition.jsx`.

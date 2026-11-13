# Owner steps: everything waiting on Tennyson

One list of every step, check and decision that only Tennyson can do, gathered from all the plans on 11 November 2026. Before this page they were spread over about 20 documents, and `docs/NOW.md`'s top ten carried 10 of roughly 37.

How to use it:

- Each step leads with where to go and what to enter. The source document has the background.
- When a step is done, delete its line and add one dated line under "Done" at the bottom (a session can do this for you: say "mark step A3 done").
- A session that finds a new step for Tennyson adds it here and links to it from its own document. It does not describe the step twice.
- Statuses below were last checked on the date in the line. A session cannot see most dashboards, so "not recorded" means nobody wrote down that it happened.

## A. This week

| # | Step | Where and what | Source |
|---|---|---|---|
| A1 | **Breeder conversations: 15 by 17 November.** 0 recorded on 31 October. Under the Day 30 rule, fewer than 15 means engineering pauses. | Book the calls. After each, Admin panel, Overview, Weekly scoreboard, "Record by hand". The questions and the $120 Founding Breeder offer are in the source. | `planning/breeder-interviews-2026-10.md` |
| A2 | **Hand-import 5 breeder collections.** 0 recorded. | Offer it in each call; record each under "Record by hand". | Part E, item 14 |
| A4 | **Rewrite the top ten in `NOW.md`.** It is still the 31 October draft; the Mondays of 3 and 10 November were missed. | Copy the scoreboard card's numbers into `docs/NOW.md` and rewrite the list. | Part E, rule E0.5 |
| A5 | **Seven decisions from the experience review.** They block most of its remaining work. | Read section 2 of the source and answer each in a sentence. The two that unblock the most: how much to build before decision day, and whether Today replaces the Dashboard as the one home. | `planning/experience-review-2026-11-11.md`, section 2 |

## B. App Store (the iPhone app is in review work)

| # | Step | Where and what | Source |
|---|---|---|---|
| B1 | **Sign in with Apple key and three secrets.** Until then, deleting an account that signed in with Apple cannot revoke its Apple token. | Create the key at https://developer.apple.com/account/resources/authkeys/list, then add `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` at https://supabase.com/dashboard/project/mmuglfphhwlaluyfyxsp/functions/secrets | `planning/deploy-queue-2026-10-03.md`, open item 8 |
| B2 | **Tick "Sign in with Apple" on the app ID** (not recorded as done). | https://developer.apple.com/account/resources/identifiers/list, open `com.geckinspect.app`, tick it, Save. | `planning/app-store-resubmission-2026-10-26.md`, step 1 |
| B3 | **Build and upload build 15**, then the device recording, the sandbox purchase, the screenshots and the submission. | Steps 2 to 6 of the source, with the paste-ready review notes and reply. The project is already at build 15. | Same, steps 2 to 6 |
| B4 | **Look at the launch colour on that build.** The launch background and status bar colour changed to match the default theme (11 November). | Open the app cold: no blue-black flash before the green-black page. | `planning/experience-review-2026-11-11.md`, finding A9 |

## C. Safety and accounts (each is a few minutes)

| # | Step | Where and what | Source |
|---|---|---|---|
| C1 | **Backups have never run.** There is no copy of member records outside Supabase. | Add two secrets at https://github.com/tennysonmilesperhour/geck-inspect/settings/secrets/actions/new : `SUPABASE_DB_URL` (the Session pooler connection string, port 5432, password filled in, from https://supabase.com/dashboard/project/mmuglfphhwlaluyfyxsp?showConnect=true ; not the direct `db.` address) and `BACKUP_PASSPHRASE` (a long random passphrase; keep a copy outside GitHub, because no backup opens without it). Then run the `db-backup` workflow by hand. A real run takes minutes and leaves a `db-backup-<date>` artifact. | `OPERATIONS.md`, sections 2 and 3; `RESTORE.md` |
| C2 | **Admin two-factor sign-in.** None enrolled on 31 October. A reminder routine fires on 16 November. | Check TOTP is allowed at https://supabase.com/dashboard/project/mmuglfphhwlaluyfyxsp/auth/mfa . In the app: Settings, Security, "Set up an authenticator app", scan, save the secret key in a password manager, type the first code. Sign out and in again. Then tell a session, which ships the follow-up migration before the switch is turned on. | `planning/admin-mfa-2026-10.md` |
| C3 | **Make the repository private.** It was still public on 11 November, with the strategy, the security write-ups and a personal address in its history. | https://github.com/tennysonmilesperhour/geck-inspect/settings , bottom of the page, "Change repository visibility". | Part E, item 6 |
| C4 | **Stripe refund and dispute events.** The 17 October refund never reached the app, so the Revenue card reads $0 refunds. | https://dashboard.stripe.com/webhooks , the `.../functions/v1/stripe-webhook` endpoint, Add events: `charge.refunded`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`, `charge.dispute.funds_withdrawn`, `charge.dispute.funds_reinstated`, `customer.subscription.trial_will_end`, `checkout.session.async_payment_succeeded`. Then Developers, Events, the 17 October `charge.refunded` event, Resend. | `planning/deploy-queue-2026-10-03.md`, open item 1 |
| C5 | **Spend alerts and an uptime check.** | Spend alerts in the Anthropic and Replicate consoles; a free uptime check on `/`, `/AuthPortal`, `/Membership`, `/mcp`. Then try restoring one storage bucket once. | Part E, item 11; `OPERATIONS.md` |
| C6 | **A support address on the domain.** Support mail still goes to a Gmail address. | Set up `support@geckinspect.com` forwarding, then tell a session to switch `src/lib/supportContact.js`, the Terms and the privacy policy. Also needed for the Terms: the governing state and the operator's name. | Part E, item 9 |
| C7 | **Branch protection on `main`** (not recorded as done). | https://github.com/tennysonmilesperhour/geck-inspect/settings/branches : require the checks (lint, tests, genetics check, size budget). | Part E, item 18 |
| C8 | **Scheduled routines.** Two were found pointing at things that are no longer true: the daily health check reads `docs/planning/deploy-queue-2026-10.md` (the file is `deploy-queue-2026-10-03.md`) and expects triage pull requests (triage now files issues, by hand only); the Monday agent review says the MCP directory listing is approved (it is on hold until counsel) and runs weekly where the plan says monthly. | https://claude.ai/code , Routines. Fix the two prompts, give both routines the repository and connectors, and choose weekly or monthly for the agent review. | `planning/agent-access-2026-10.md`; `NOW.md` |

## D. Dashboard steps from the deploy queue

| # | Step | Where and what | Source |
|---|---|---|---|
| D1 | **Photo thumbnails for older photos** (817 on 31 October). | Admin panel, System, Photo thumbnails, Make thumbnails. Keep the tab open 10 to 20 minutes; run it again the next day. | `planning/deploy-queue-2026-10-03.md`, open item 4 |
| D2 | **Sign-in link templates (PKCE).** | Supabase, Authentication, Email Templates: change each link to the `token_hash` form given in round 3, item 2 of the source. Do A3 in the same visit. Then tell a session to flip `WEB_AUTH_FLOW` a day later. | Same, open item 2 |
| D3 | **Morph ID card view key.** | Create Vault secret `morph_share_view_key`, set the same value as the Vercel setting `MORPH_SHARE_VIEW_KEY`, redeploy production in Vercel. | Same, open item 3 |
| D4 | **Delete two dead functions**, `rapid-api` and `admin-end-trial`. | Supabase, Edge Functions. Then tell a session to remove `supabase/functions/admin-end-trial/`. | Same, open item 5 |
| D5 | **Delete PostHog persons whose id contains "@".** | PostHog, Persons. | Same, round 3, item 3 |
| D6 | **Paywall headline experiment and App Store product page test** (not recorded as set up). | PostHog experiment on flag `paywall-outcome-v1`; App Store Connect, Product Page Optimization. | `planning/launch-offer-tests-2026-10.md` |

## E. Decisions

| # | Decision | Source |
|---|---|---|
| E1 | **The US market feed:** restore it, or keep the public Price Index as a reference and stop building on the feed. The last complete US pass was 19 October and the daily canary has failed since. | Part E, item 34; `NOW.md` |
| E2 | **Homepage test:** agree the smallest effect worth acting on, then pick the winner. Four changes are queued behind it. | `planning/homepage-ab-test-2026-10.md` |
| E3 | **Pricing suggestions 1, 2, 3 and 5.** No price changes before five breeders have answered the $120 offer. | `planning/launch-offer-tests-2026-10.md` |
| E4 | **Legal basics:** the company (postponed 16 October), a DMCA agent, an hour of counsel on the market data (also gates the MCP registry listing), and the draft Terms additions. | Part E, item 22; `legal/terms-additions-draft.md` |
| E5 | **Morph ID gold set:** recruit three breeders to label 50 animals, and say whether to spend on grading. | Part E, item 29; `morph-id-eval/README.md` |
| E6 | **Whether first-party usage events wait for consent in the EEA and UK.** | `DECISIONS.md` |
| E7 | **Whether "Tenny's Crested Geckos" stays in the list of reference sources in `STRATEGY.md`** (the breeder who shares the first name). | `../STRATEGY.md` |
| E8 | **The genetics engine's source and licence** are not recorded. | Part C15 of the comprehensive review |
| E9 | **The unused `isHatching` mode of the gecko form:** keep or delete. | `planning/experience-review-2026-11-11.md`, section 6 |
| E10 | **Founder hours a week for the plan**, and the founder brand name to publish. | Part C15; `../CLAUDE.md` |
| E11 | **Ball python site, Phase 0 decisions.** Paused until 17 January 2027; nothing to do now. | `planning/ball-python-app-2026-10.md` |
| E12 | **Quick Add and feeding groups.** Since 13 November every new gecko starts in Quick Add. With "Remind me on feeding days" on, it goes into your first feeding group. For a breeder with several groups that may be the wrong one. Choose: keep it, show a group picker when there is more than one group, or leave the gecko ungrouped. | `planning/experience-review-2026-11-11.md`, WP-3 |
| E13 | **A hatch year on its own.** The gecko form saves a hatch date only when year, month and day are all filled in, and says so. Saving the year alone needs a small database change. Say yes and a session will do it. | Same, WP-3 |
| E14 | **Sold prices on public geckos.** Any signed-in member can read the sold price (and the owner's email) of a gecko that is public, through the database's own interface. The app does not show it, but someone with an account and some skill could read it. This is why the new sold sheet does not offer a passport. Fixing it means moving the sold price somewhere only the owner can read (a database change with a careful rollout, about a day). Say yes and a session will plan it. Until then, a gecko that already has a passport shows its sold price this way once it is marked sold with a price. | `planning/instrumentation-2026-10.md`, "The step after Archive as sold"; checked against production on 13 November 2026 |

## F. Checks on a real phone or with real email

None of these is recorded as done. Each takes a minute or two; do them in one sitting and tell a session the results.

1. Open geckinspect.com cold on a phone: it opens on Today. Log a feeding in two taps.
2. Open Today in airplane mode after one visit with signal; log a feeding; it saves once when signal returns.
3. A weigh-in reminder email or push arrives and its link opens the one-tap log.
4. Open a gecko record on an iPhone: it fills the screen below the notch, the parents and the value show without scrolling, a weigh-in saves, Close and swipe-back work.
5. New on 11 November: on that record, Share (top right), Make a passport, then View passport and its Back link. Sign up with a spare address using the 6-digit code (after step A3).
6. Paste a passport link and a breeder page link into Messenger or iMessage: the preview shows that gecko's or breeder's own title and photo. Same for a Morph ID result card.
7. Transfer a gecko to a brand new account and accept it there.
8. A waitlist end to end; report and hide a post; hatch an egg into a gecko.
9. Delete a disposable account from Settings; the Gmail one-click unsubscribe; rack labels from Printable Worksheets; an iPhone HEIC photo upload; a Stripe upgrade with a test card.
10. PageSpeed on a real phone for the landing page, and capture the product photo slides on production (about an hour).
11. New on 13 November, on an iPhone: open Log, Weigh-in. Type two weights: the "Save all" bar should sit just above the tab bar and not cover the last row. Type a weight ten times too big: it should ask before saving. In Field Mode, log a feeding and tap "Next". Open More: Log out is beside Settings.

Sources: `planning/deploy-queue-2026-10-03.md` (round 2 item 5, round 3 items 1 and 5, "Real-device and real-email checks"); `planning/feature-completeness-audit-2026-09-29.md`, section 8; `planning/history/landing-speed-2026-10.md`.

## G. Small leftovers

| # | Item | Source |
|---|---|---|
| G1 | Email the member who cancelled Breeder; decide whether members 1 and 2 are supporters or tests; take down the old Base44 page; decide on refunds for paid "better photos" scans. | `planning/history/growth-plan-2026-10.md`, lines 62 to 68 |
| G2 | Keep Replicate credit at $5 or more; fingerprint the 1,890 second photos; retire the `GECK_DATA_*` secrets (none recorded as done). | `planning/history/vip-audit-2026-09-27.md`; `planning/deploy-queue-2026-10-03.md` |
| G3 | Replace the revoked Supabase key in the geck-data Vercel project, or pause it. Enter last month's total cost under "Record by hand". | `NOW.md` |
| G4 | Quality Scale tier photos (the page still says "Reference photo coming"). | `planning/feature-completeness-audit-2026-09-29.md` |
| G5 | Confirm the hosted sign-in confirmation setting and the redirect allowlist. | `planning/qr-transfer-security-2026-10-17.md` |
| G6 | Permanently delete the archived MorphMarket test records. | `planning/deploy-queue-2026-10-03.md` |
| G7 | Other repositories: make geckfunnel and eyeinthesky private; check kiwipop's claims. | `planning/history/agent-access-prompts.md` |

## Done

- 12 November 2026: A3, the 6-digit code in the "Confirm signup" email template (done by Tennyson; not checked from a session, which cannot read the templates. To check: sign up with a spare address and type the code).

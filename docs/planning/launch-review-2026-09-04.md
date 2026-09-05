# Launch review, 4 September 2026

Read-only review of the whole repo and the live Supabase and Vercel setup, done the day before the 5 September launch, followed by five batches of fixes (A to E) pushed straight to main the same night. This file is the handoff copy of the interactive report so any session (desktop app, web, or the terminal CLI) can pick the work up. The interactive version, with the same data, is at https://claude.ai/code/artifact/6136b837-8feb-4df0-806b-f375095dc677.

Totals: 62 findings. 57 closed (fixed, done, or decided), 5 partly fixed, 0 open.

Status vocabulary: "Fixed 4 Sep" means shipped to main and, where it touches the database or an edge function, applied to production and verified. "Partly fixed" and "Mostly fixed" list what is left inside the status text. "Confirmed" means verified real and untouched.

## How to continue

1. Start in the repo on `main` (`git pull` first). CLAUDE.md carries the working rules (main only, no PRs, no em dashes, crested-gecko-first).
2. Work the open list below in order. Each entry names the file or table involved.
3. Database changes go through a timestamped file in `supabase/migrations/` plus a by-hand apply, as described in `docs/MIGRATIONS.md`. Edge functions are deployed from the merged repo source.
4. When a finding closes, update its status here and in ROADMAP.md.

## Recently closed (2)

### F60: Production builds failed on every push from 15 to 29 August and nobody was told

- Severity: high. Area: Ops. Effort: S.
- Where: Vercel deployments dpl_CZYbdRr8 through dpl_EmFGUhLj (8 consecutive ERROR builds); build log: npm ERESOLVE on the knip dev dependency because Vercel ran npm instead of pnpm
- Why it matters: The site kept serving the 14 August build for two weeks while main moved on. CI was green the whole time because CI uses pnpm. There is no deploy-failure notification.
- Proposed fix: Turn on Vercel deployment failure notifications (email or Slack) and check the deployment state after every push during launch week. The pnpm lockfile fix on 29 August resolved the immediate cause.
- Status: Fixed 4 Sep: .github/workflows/deploy-watch.yml listens for the deployment status Vercel posts back to GitHub and, on a failed or errored production deployment, opens or updates a ci-failure issue that mentions Tennyson. Vercel's Deployment Failures email notification was verified enabled as the second channel, and GitHub's Participating, @mentions and custom setting was verified delivering to both GitHub and email

### F28: Leaked-password protection is off

- Severity: medium. Area: Security. Effort: S.
- Where: Supabase Auth settings (advisor auth_leaked_password_protection)
- Why it matters: Users can sign up with passwords known to be breached.
- Proposed fix: Toggle it on in Authentication settings.
- Status: Fixed 4 Sep: verified in Authentication, Attack protection that leaked-password protection is enabled

## Partly fixed (4)

### F33: Production schema has drifted from the repo and the deploy scripts would replay stale SQL

- Severity: high. Area: Ops. Effort: M.
- Where: scripts/deploy-morph-id.sh:59 and deploy-push-notifications.sh:52 (db push --include-all); supabase/SCHEMA_SNAPSHOT.md dated 2026-07-07
- Why it matters: 26 live migrations have no repo file, 11 repo files were never applied (referral program, the email trigger). Running the scripts would overwrite the vault-based notification dispatcher and silently stop all email and push.
- Proposed fix: Do not run the scripts this week; baseline with supabase db pull, migration repair, archive orphans, regenerate the snapshot.
- Status: Partly fixed 5 Sep: deploy scripts no longer run db push, unapplied files are archived, the live catalog snapshot is current, the Morph ID repair was recorded, and all 121 rows in `supabase migration list` now show matching local and remote versions. `supabase db pull` was attempted and failed while building its shadow database: the eight earliest remote_snapshot files are empty, so p1_animal_passport runs before `public.geckos` exists. A direct linked schema dump succeeds, but appending it would not repair replay. F33 now needs a reviewed squash/rebaseline that also preserves data, storage and cron setup; keep `db push` disabled until that is complete

### F43: No Content-Security-Policy despite five third-party script origins

- Severity: medium. Area: Security. Effort: M.
- Where: vercel.json headers
- Why it matters: Any injected script runs unrestricted. The blog renders HTML from markdown.
- Proposed fix: Start with Content-Security-Policy-Report-Only listing Google, PostHog, Supabase, RevenueCat, and Stripe, then enforce.
- Status: Mostly fixed (batch C plus late session 4 Sep): Content-Security-Policy-Report-Only shipped with the real origin list. Late session: report-only mode was reporting to nobody (no report-uri), so violations only ever appeared in visitors' own consoles. A csp-report edge function now receives them (report-uri plus report-to and a Reporting-Endpoints header) and writes one row per distinct violation per page per hour to error_logs with created_by = 'csp-report', throttled by the audit batch A trigger. verify_jwt is off because browsers send these reports with no session; the function accepts only geckinspect.com documents and never returns data. Decide on enforcing from about 11 Sep with: select message, url, count(*) from error_logs where created_by = 'csp-report' and created_date > now() - interval '7 days' group by 1, 2 order by 3 desc

### F46: 208 RLS policies re-evaluate auth functions per row; 271 duplicate permissive policies

- Severity: medium. Area: Data layer. Effort: M.
- Where: Live performance advisors (auth_rls_initplan, multiple_permissive_policies)
- Why it matters: Each is small, together they scale badly as tables grow.
- Proposed fix: Rewrite to (select auth.uid()) and consolidate policies per table and action.
- Status: Partly fixed 4 Sep: 213 policies rewritten to (select auth.uid()) via rls_initplan_rewrite, 0 bare calls remain in public (14 remain in geck_data, owned by the geck-data repo). Duplicate permissive groups: 274 warnings across 53 tables mapped to eight batches with the exact rewrite for each in docs/planning/rls-policy-consolidation.md (late session). Tennyson approved all eight batches one at a time and all eight are applied (rls_batch1_gecko_images through rls_batch8_collections_votes_offers), each smoke-tested as visitor, member and admin inside a rolled-back transaction before the next was applied. gecko_images: nine policies down to four and a member can no longer edit a verified image or insert one pre-verified. is_admin() and is_expert_reviewer() marked STABLE. Four duplicate animal_id indexes dropped. The dead five-minute unsend rule on direct_messages removed. A whole-schema check after batch 8 finds no (table, command) with more than one permissive policy in public. Remaining: the 14 geck_data policies and four geck_data duplicate groups belong to the geck-data repo

### F55: Mobile and accessibility gaps

- Severity: medium. Area: Mobile. Effort: S.
- Where: 24 file inputs with no capture attribute; 18 img tags without alt; reduced-motion honoured in 2 files; safe-area in 6
- Why it matters: Most keepers will use a phone. None of these break the app, together they make it feel less native.
- Proposed fix: capture=environment on photo inputs, alt text pass, reduced-motion guard on framer animations, verify HEIC on a real iPhone.
- Status: Mostly fixed 4 Sep (late session): global prefers-reduced-motion rule, missing alt on MarketplaceSalesStats. Late session: 41 muted text runs moved from slate-600/700 (about 3:1 on the dark ground, below WCAG AA) to slate-500 (about 4.6:1), icons and decorative marks untouched; six 9 px labels raised to 10 px; the eleven sub-36 px buttons (weight delete, egg edit, feeding group edit and delete, payment add, keep offspring) are 36 px on phones and unchanged from md up. capture=environment was deliberately not added: keepers upload existing gecko photos far more often than they shoot new ones, and capture hides the photo library on iOS. Still open: verify HEIC uploads on a real iPhone

## Closed (56)

| ID | Severity | Area | Finding | Effort | Status |
|---|---|---|---|---|---|
| F01 | critical | Security | Any signed-in user can make themselves admin or Enterprise by updating their own profile row | S | Fixed 4 Sep: trigger live, verified with a simulated user |
| F02 | critical | Security | Anyone can claim any pending animal transfer | S | Fixed 4 Sep: policy, claim_transfer and preview RPC live |
| F03 | critical | Security | send-email and send-push accept unauthenticated requests and send from alerts@geckinspect.com | S | Fixed 4 Sep: both functions redeployed, 401 without the secret |
| F04 | critical | Security | Third-party pixel sends every visitor's full URL, including auth tokens and claim links, to another Supabase project | S | Fixed 4 Sep: pixel sends origin + path only (commit 5ba155d) |
| F23 | critical | Monetization | Production runs on the RevenueCat sandbox key: web purchases will not process | S | Fixed (deploy b53b38c): build log shows VITE_REVENUECAT_WEB_API_KEY is a production key |
| F05 | high | Security | invoke-llm is an unmetered Anthropic proxy for any signed-in user with client-chosen model and max_tokens | M | Fixed 4 Sep: session required, model and tokens server-decided, one credit per call |
| F06 | high | Security | consume_feature_credit trusts the client's p_included, so AI metering can be raised to any number | S | Fixed 4 Sep: allotments now server-side |
| F07 | high | Security | Anonymous uploads into the public media bucket, 50 MB per file, any type | S | Fixed 4 Sep: anon policies dropped, bucket image-only |
| F08 | high | Security | send-collection-invite is an open email relay with an attacker-controlled link | S | Fixed 4 Sep: session, ownership and link checks live |
| F09 | high | Security | Any signed-in user can insert a notification for any other user and the trigger emails or pushes it | S | Fixed 4 Sep: guard trigger plus policy, verified with a simulated user |
| F10 | high | Data layer | Layout downloads the entire gecko_images table, embeddings included, on every session to count a badge | S | Fixed 4 Sep: head-only counts |
| F11 | high | Data layer | Gallery and Dashboard download every profile (emails, Stripe ids) to resolve a few display names; profiles is anon-readable | S | Fixed 4 Sep: on-screen profiles only, display columns only |
| F12 | high | Data layer | Dashboard, CommunityConnect, and Lineage fetch the entire geckos table client-side | M | Fixed 4 Sep: community_gecko_counts() plus id-based lineage fetch |
| F13 | high | Data layer | No indexes on the tables every tab polls every 60 seconds | S | Fixed 4 Sep: 16 indexes live |
| F14 | high | Landing page | Two dead calls to action and a login-walled nav link on the landing page | S | Fixed 4 Sep: dead links replaced with Pricing |
| F15 | high | Landing page | No pricing link anywhere on the landing page and the product tour has zero screenshots | S | Done 4 Sep: Tennyson supplied the App Store screenshots to Apple directly |
| F16 | high | Retention | The dashboard's 'add your first gecko' message can never render | S | Fixed 4 Sep: keys on the user count, activation card added |
| F17 | high | Retention | Role modal and long tour fire for guests, then hide the tour from the real account | S | Fixed 4 Sep: guarded on guest, dialog dismissable; tour length unchanged |
| F18 | high | Retention | No sign-up entry point, no password reset, terms not linked | S | Fixed 4 Sep: signup mode, forgot password, reset form, redirect, links |
| F19 | high | SEO | Prerendered /Membership snippet advertises old prices | S | Fixed 4 Sep: built from stripe-config.js |
| F20 | high | SEO | 22 sitemap URLs have no prerendered HTML and canonicalize to the homepage for non-JS crawlers | S | Fixed (round 3): all 167 sitemap URLs prerender with real titles and descriptions; /AuthPortal dropped from the sitemap |
| F21 | high | SEO | Sitemap money pages render a login form for anonymous visitors | S | Fixed 4 Sep: /Membership public in the shell; other three pages unchanged |
| F22 | high | Ops | Store checkout calls a function that is not deployed | S | Fixed 4 Sep: checkout disabled behind STORE_CHECKOUT_ENABLED |
| F24 | high | Monetization | Paid entitlement depends on a deployed stripe-webhook that is not in the repo | M | Fixed and verified live (v24): a signed-in test account got a real checkout.stripe.com session for Keeper annual, and the customer id was saved to the profile. Still yours: complete one test-card checkout so the webhook is exercised |
| F25 | high | Monetization | Membership promises 'cancel anytime' but there is no cancel or billing portal path | M | Fixed and verified live (v3): the same account got a billing.stripe.com portal URL back from the Manage billing call |
| F26 | high | Monetization | Breeder tier sells a shipping integration that does not exist | S | Fixed 4 Sep: bullet removed |
| F27 | high | Landing page | 'Trained on thousands of verified crested geckos' is not what the code does | S | Fixed 4 Sep: copy reworded |
| F29 | high | Performance | About 3 MB of JavaScript on the landing page; billing, charts, and PDF code load for anonymous visitors | M | Fixed (batch B): RevenueCat, PostHog, framer-motion, recharts and the PDF libraries are out of the landing bundle; manualChunks removed; no vendor modulepreloads. Entry chunk 1.0 MB raw, next: measure field Web Vitals after deploy |
| F31 | high | Bugs | Storage quota gate looks up the profile by auth uid, which never matches profiles.id, so paying users get the free quota | S | Fixed (batch A, commit c083e67): profile looked up by email |
| F32 | high | Ops | Nightly error-triage workflow has failed on every recent run, so errors never reach you | S | Fixed (batch C): the npm install step that crashed inside pnpm node_modules is gone from all three scheduled workflows; the SDK is a devDependency; failures now open a ci-failure issue. Confirm on the next nightly run |
| F35 | high | Retention | No re-engagement while the app is closed | M | Fixed (batch D plus 5 Sep): pg_cron writes hatch alerts daily, weigh-in reminders weekly, and a Sunday digest (collection size, eggs incubating and due this week, overdue weigh-ins, community activity) through the existing notification dispatcher. Dry run wrote 29 digests inside a rolled-back transaction with the dispatcher disabled |
| F36 | high | Security | Privileged database functions callable anonymously without guards, plus a SECURITY DEFINER view | S | Fixed (batch A, migration audit_batch_a): 17 internal functions revoked from anon and authenticated, 11 member RPCs revoked from anon, estimate_food_runout scoped to the caller, promote_image_usage is security invoker. 14 functions remain anon-callable on purpose (landing, community, RLS helpers) |
| F37 | high | Security | recognize-import-data has no auth or metering and is currently not deployed | M | Fixed 4 Sep: deployed with JWT verification, Breeder and Enterprise gate, one import_scan credit per batch (20 and 200 a month), 401/402/403 with plain reasons that ImageImport shows |
| F38 | high | Security | Vet, feeding, ownership (with sale prices), and transfer records are world-readable | M | Fixed (batch D, migration audit_batch_d): vet, feeding, shed and ownership reads limited to author, owner, admin, or a public passport |
| F58 | high | Ops | PostHog is switched off in production: no VITE_POSTHOG_KEY in the deployed bundle | S | Fixed (deploy b53b38c): build log shows VITE_POSTHOG_KEY present |
| F62 | high | Correctness | Tier lookup compared uuid to text, so every metered feature returned 500 | S | Fixed 4 Sep: effective_tier_uuid_fix applied and verified (keeper resolves, a health screen credit debits) |
| F30 | high | Performance | Hero image is a 2,400 px external hotlink with no srcset; logo and icons are oversized | S | Fixed (batch B plus late session 4 Sep): hero self-hosted as WebP at three widths with srcset and a landing-only preload; logo and icons resized in batch B |
| F34 | high | SEO | Non-JS crawlers see thin shells and cannot reach 134 child pages | M | Fixed (batch D plus late session 4 Sep): every child page linked from its hub; noscript bodies carry the first three paragraphs, key points and FAQ; page-level JSON-LD per route; Seo.jsx drops the static block on mount |
| F41 | medium | Retention | Referral program was never applied to production | S | Fixed 4 Sep, late session: migration referral_keeper_month applied and verified. The unpayable 10 percent revenue share is gone; the reward is one free month of Keeper per referred member who pays a first invoice (a month credited on Stripe for subscribers, needs_manual for App Store and grandfathered accounts). Attribution moved server-side (apply_referral_code), referral columns write-protected, daily expire-referral-grants cron returns lapsed months to free, stripe-webhook redeployed |
| F61 | medium | Ops | A newer commit on main adds three large unapplied migrations (7,900 lines, 55 tables in a geck_data schema) | S | Closed 4 Sep, late session: all three are in the live migration history and geck_data holds 81 tables, so they were applied after the review. Nothing left to apply |
| F47 | medium | Data layer | Dashboard fans out to about 40 requests with a waterfall; background polling in every tab | M | Fixed (batch B plus 4 to 5 Sep): every poller visibility and idle aware; Dashboard, My Geckos, Gallery and Breeding on react-query with count-only hatchery queries |
| F39 | medium | Performance | Every image first requests a paid transform that returns 403, then falls back | S | Fixed (batch A): transforms off by default, VITE_IMAGE_TRANSFORMS=1 re-enables |
| F40 | medium | Landing page | 'Keepers signed up' counts 94 profiles while 36 accounts can log in | S | Fixed (batch A): landing_stats() counts confirmed accounts (36 today) |
| F42 | medium | Security | Privacy policy does not disclose GA4, PostHog, or the Robauto pixel | S | Fixed (batch C): privacy policy names Supabase, Vercel, Stripe, RevenueCat, Anthropic, Resend, GA4, PostHog and Robauto with what each receives |
| F44 | medium | Security | Base44-era VisualEditAgent ships to production with its origin check commented out | S | Fixed (batch A): dev-only lazy mount, not in the production bundle |
| F45 | medium | Ops | error_logs accepts anonymous inserts with no throttle | S | Fixed (batch A): client dedup and 10/min budget, plus a database trigger capping 20 per reporter and 200 overall per minute |
| F48 | medium | Monetization | Enterprise is 'coming soon' in the UI but purchasable in JSON-LD; lifetime tiers have no price id | S | Mostly moot: JSON-LD offers already excluded Enterprise; Enterprise stays visibly Coming Soon on the pricing page |
| F49 | medium | Retention | Free tier gives one AI morph ID per month and guests cannot try it | S | Decided differently: free tier gets zero credits (server-enforced, upgrade card before upload); paid tiers keep 3, 6 and 15 |
| F50 | medium | Landing page | Hero paragraph lists seven features in gradient text; My Geckos empty state has no button | S | Fixed (batch D): two-sentence hero in plain text; Add your first gecko button in the My Geckos empty state |
| F51 | medium | Strategy | Facades a user can reach: passport claim is a browser alert; Mentorship, Shipping, Giveaways, Business Tools previews | S | Fixed: Mentorship, Shipping, BreederShipping and Giveaways hidden from nav, routes, sitemap, landing and llms.txt; stale links 301 home; partnership copy removed |
| F53 | medium | SEO | Metadata drift: hreflang points to the homepage everywhere, sitemap lastmod is the build date, llms.txt is stale, schema claims a Twitter handle and search action that do not exist, parsers fail silently | S | Fixed (batch C): lastmod from git content dates, llms.txt stamped at build, site-wide hreflang removed, placeholder Twitter handle removed, parsers throw on zero entries |
| F54 | medium | Ops | Vercel deploys every push to main regardless of CI | S | Fixed (batch D): pnpm build runs lint and tests first, so Vercel refuses to ship a red commit |
| F59 | medium | Ops | Web push cannot subscribe in production: no VAPID public key in the deployed bundle | S | Fixed (deploy b53b38c): build log shows VITE_VAPID_PUBLIC_KEY present |
| F52 | low | Security | Blog HTML sanitizer allows attribute injection; CSV exports lack formula neutralisation; profile links accept javascript: URLs | S | Fixed 4 Sep: blog helper escapes quotes in href, src and alt, CSV export prefixes formula-leading cells, PublicProfile links http(s) only and encodes handles |
| F56 | low | Style | Docs drift and root clutter | S | Fixed 4 Sep: README rewritten, CLAUDE.md stack line and file map corrected, planning docs moved to docs/planning, docs/MIGRATIONS.md added |
| F57 | low | Style | Em dashes remain despite the hard rule | S | Fixed 4 Sep: src (batch C) plus 723 in docs, SQL comments, workflows, report placeholders and 23 live store product rows. Left in place: the CLAUDE.md rule text and the sanitizers that strip them |

## Tennyson's checklist (as of the 4 September late session)

This list records the remaining launch checks and their latest state.

1. **F28, Supabase, done 4 Sep.** Leaked-password protection was verified
   enabled in Authentication, Attack protection.
2. **F60, Vercel and GitHub, done 4 Sep.** Vercel Deployment Failures
   email was verified enabled. GitHub Participating, @mentions and custom
   notifications were also verified delivering on GitHub and by email.
3. **F33, migration baseline, blocked.** The CLI is logged in and linked,
   the Morph ID history repair ran, and all 121 rows now match local and
   remote. `supabase db pull` fails because the eight earliest
   remote_snapshot files are empty and cannot recreate `public.geckos` in
   the shadow database. See `docs/MIGRATIONS.md` before attempting the
   required squash/rebaseline.
4. **F43, CSP enforce, from about 11 September.** Ask a session to run
   the csp-report query (under F43 above) and, if the only rows are
   expected origins or none at all, change the header name in
   scripts/build-vercel-json.mjs from Content-Security-Policy-Report-Only
   to Content-Security-Policy. One line.
5. **Referral and billing, live check.** Sign up a second account through
   your own referral link (sidebar card, Copy referral link), pay a first
   invoice with a Stripe test card, then confirm: the referrer got the
   notification, referral_rewards has one row, and (for a free referrer)
   membership_tier is keeper with referral_grant_until 30 days out. This
   also completes the F24 test-card checkout still marked as yours.
6. **F55, real iPhone.** Upload a HEIC photo from the camera roll on
   the Add Gecko form and on Morph ID; both should preview and save.
7. **Local checkout hygiene.** ~/dev/geck-inspect has another session's
   uncommitted edits (Home.jsx, blog helpers, several edge functions)
   and is far behind origin. Decide whether that work is wanted; commit
   it or discard it, then `git pull`. Sessions currently use the clean
   worktree at ~/dev/geck-inspect-launch instead.
8. **geck-data repo.** Four duplicate policy groups and 14 per-row
   auth calls remain in the geck_data schema; same recipe as batches 1
   to 8, but the migrations belong to that repo.

## Production changes applied outside git

Every one of these has a matching file under `supabase/migrations/` so the repo tells the truth, but they were applied by hand through the Supabase MCP rather than by a deploy script:

- `rls_initplan_rewrite`: 213 policies rewritten to `(select auth.uid())`.
- `import_scan_allotments`: image import credits per tier (free 0, keeper 0, breeder 20, enterprise 200).
- `effective_tier_uuid_fix`: the uuid-to-text comparison that broke every metered feature.
- `function_search_path_pins`: five trigger and helper functions.
- `store_copy_no_em_dashes`: 23 live store product rows.
- Earlier the same night: `audit_batch_a`, `audit_batch_d`, `free_tier_no_morph_id`, `launch_security_hardening`.
- 5 Sep: `drop_award_referral_signup_bonus` (dead Social Media Manager bonus function), `weekly_digest` (enqueue_weekly_digest plus the weekly-digest-sunday cron, 16:00 UTC Sundays), `dispatch_titles_for_new_types` (email subjects for weigh-in reminders, referral rewards and the digest).
- Late session: `owner_only_reads_valuations_alerts_loans` (collection valuations, price alerts and breeding loans were readable by visitors; now author, lender or borrower, or admin). The Breeding Loans page was also storing and filtering the lender as an email in a uuid column, which made every loan insert fail; it now uses created_by.
- Late session: `rls_batch1_gecko_images` through `rls_batch8_collections_votes_offers` (F46).
- Late session: `referral_keeper_month` (referral columns, reward ledger, award and expiry functions, pg_cron job) and `referral_function_grants` (explicit revokes, because Supabase default privileges had made the award function callable by any signed-in member).

Edge functions redeployed from repo source: stripe-checkout, stripe-webhook, stripe-billing-portal, recognize-gecko-morph, recognize-import-data (first deployment, JWT verification on). Late session: stripe-webhook again, for the referral reward; csp-report (new, JWT verification off by design, see F43). 5 Sep: send-email v19 (weekly_digest maps to the announcements preference).

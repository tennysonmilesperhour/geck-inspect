# Operations

What Geck Inspect runs on, what it costs, where the secrets live, what is backed up, what runs on a schedule, and the weekly checklist. Written 15 October 2026 for plan item E2 21 (and the costs page that item A12 of the review asked for) in `docs/planning/comprehensive-review-2026-10-14.md`.

How this was checked: the repository (code, workflows, function source) and read-only queries against the production database on 15 October 2026. Nothing in the Stripe, Vercel, Resend, Anthropic, Replicate, PostHog or RevenueCat dashboards was looked at, so plans and bills from those services are marked **unknown** until Tennyson fills them in. Secret values never go in this file; only their names.

Keep it true: when a service, secret, job or price changes, change this file in the same commit.

## 1. Services

| Service | What Geck Inspect uses it for | Plan | Monthly cost |
|---|---|---|---|
| **Supabase** (project `mmuglfphhwlaluyfyxsp`) | The database (members, geckos, records, market data in `geck_data`), sign-in, photo storage, the 33 edge functions, scheduled jobs (pg_cron) and the secret store (Vault) | **Paid, tier unknown.** Storage holds about 8.2 GB, which is above the Free plan's 1 GB, so it cannot be the Free plan | **Unknown.** Check Billing in the Supabase dashboard |
| **Vercel** | Hosts geckinspect.com (the app, prerendered pages, `api/` routes, `middleware.js`). Every push to `main` deploys production. A second Vercel project hosts Geck Intellect (geck-data) | **Unknown** | **Unknown** |
| **Stripe** | Website memberships: checkout, the billing portal, the membership webhook; also the supplies store webhook | Pay as you go | No monthly fee. About 2.9% plus $0.30 a charge (about 12.9% of a $2.99 charge). Stripe Tax is not turned on in checkout |
| **RevenueCat** (project `20585b81`) | Store purchases inside the iPhone app; mirrors App Store entitlements into `revenuecat_entitlements` (`docs/BILLING.md`) | **Unknown** | **Unknown** |
| **Apple Developer Program** | Needed to ship the iPhone app | $99 a year (`docs/native-shell-plan.md`) | About $8 a month, if enrolled (enrolment status not recorded) |
| **Google Play Console** | Needed to ship the Android app | $25 once | None after sign-up (sign-up status not recorded) |
| **Resend** | All email: reminders, digests, invites, inquiries, guide downloads, waitlist, the weekly reports. Senders seen in code: alerts@, invites@, hi@, system@, admin@ geckinspect.com | **Unknown** | **Unknown** |
| **Anthropic** (Claude API) | Morph ID, health screen, AI Consultant, Promote drafting, spreadsheet and photo import, the weekly changelog, the error-triage agent, Morph ID evaluation | Pay as you go (prepaid credit; it has run out once) | Usage based. Recorded: Morph ID about 3 cents a call; a full evaluation run about $6; the daily canary about 6 cents a day. Evaluation runs cost $23.84 in the 30 days before 14 October against $0.59 of member Morph ID use |
| **Replicate** | Photo fingerprints (embeddings) that Morph ID uses to find similar reference photos | Pay as you go | Usage based, small. Under $5 of credit, Replicate allows one request at a time, which slows evaluation runs |
| **PostHog** | Product analytics (the production build requires its key) | **Unknown** | **Unknown** |
| **Google Analytics 4** and **Search Console** | Traffic and search data for the weekly growth report | Free | $0 |
| **Google PageSpeed API** | The twice-monthly SEO audit | Free | $0 |
| **GitHub** (Actions, Dependabot) | Code, CI, the scheduled bots in section 5 | Free for a public repository | $0 today. If the repository is made private (plan item E1 6), Actions minutes become limited on the Free plan; check usage after the switch |
| **Robauto.ai** | A pixel in `index.html` that counts visits from AI assistants | **Unknown** | **Unknown** |
| **Govee API** | Enclosure sensor readings for members who connect a device (`iot-poll`) | Free API | $0 |
| **Meta and Reddit apps** | Promote's social posting connections | Free | $0 |
| **Domain** (geckinspect.com) | The site and email sender domain | **Unknown registrar** | **Unknown** |
| **Claude Code sessions** | Most of the building and the reviews | **Unknown** | **Unknown.** The adversarial review session alone cost over $100 |
| **geck-data scraper** | Collects public crested gecko listings into `geck_data` (a separate repository; the adversarial review says it runs on Tennyson's Mac) | n/a | A residential proxy, if bought to restore the US feed, would add $5 to $15 a month |

**Total:** unknown. The adversarial review estimated $60 to $300 a month, against $8.98 of monthly recurring revenue on 14 October. The plan's day 30 target (Part E5) is a monthly cost under $100, and a tripwire fires at more than $150 a month with revenue under $50 at day 60. **Tennyson: please fill in each "Unknown" from the dashboards; that one table is what the scoreboard's "monthly cost" line needs.**

## 2. Secrets: names and where they live

Never paste a value into the repository, a document, an issue or a chat. If a value is exposed, rotate it at the service first, then update every place listed here.

### Supabase edge function secrets (Dashboard, Edge Functions, Secrets)

These are shared by every function in the project.

| Name | Read by |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | Most functions (Supabase provides these automatically) |
| `STRIPE_SECRET_KEY` | `stripe-checkout`, `stripe-webhook`, `stripe-billing-portal`, `store-checkout`, `store-stripe-webhook`, `report-social-overage`, `delete-my-account` |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` and `store-stripe-webhook`. Both read the same name, so either both Stripe endpoints share one signing secret or one of the two webhooks cannot verify its events. Check in Stripe how many endpoints exist (review, production check 9) |
| `STRIPE_KEEPER_PRICE_ID`, `STRIPE_BREEDER_PRICE_ID`, `STRIPE_ENTERPRISE_PRICE_ID`, `STRIPE_OVERAGE_PRICE_ID`, `STRIPE_OVERAGE_ENABLED` | Optional price overrides and the paused social-post overage |
| `RESEND_API_KEY`, `EMAIL_FROM`, `SITE_URL` | `send-email`, `send-collection-invite`, `send-breeder-inquiry`, `subscribe-and-send-guides`, `waitlist-signup` (and `SITE_URL` also in `email-unsubscribe`, `store-checkout`) |
| `ANTHROPIC_API_KEY`, `CLAUDE_MODEL`, `HEALTH_SCREEN_MODEL` | `recognize-gecko-morph`, `health-screen`, `invoke-llm`, `generate-social-post`, `recognize-import-data` |
| `REPLICATE_API_TOKEN`, `SIGLIP_MODEL` | `recognize-gecko-morph`, `embed-gecko-image` |
| `IP_HASH_SALT`, `EVAL_SHARED_SECRET`, `MORPH_VISUAL_RETRIEVAL`, `MORPH_RETRIEVAL_MIN_SIMILARITY`, `MORPH_RETRIEVAL_MAX_PHOTOS`, `FEW_SHOT_PER_MORPH`, `FEW_SHOT_MAX_TOTAL`, `FEW_SHOT_FILLER_URL_PREFIX` | `recognize-gecko-morph` |
| `MORPH_EMBED_BACKFILL_KEY` | `embed-gecko-image` |
| `REVENUECAT_API_KEY`, `REVENUECAT_WEBHOOK_AUTHORIZATION` | `revenuecat-sync`, `revenuecat-webhook` (the second must match the header set in the RevenueCat dashboard exactly) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `send-push` |
| `PLATFORM_CONNECTIONS_KEY` | Encrypts stored social tokens: `set-platform-connection`, `publish-social-post`, `meta-oauth-callback`, `reddit-oauth-callback` |
| `META_APP_ID`, `META_APP_SECRET`, `META_OAUTH_REDIRECT`, `META_OAUTH_STATE_SECRET`, `META_OAUTH_SUCCESS_URL` | The Meta (Facebook, Instagram) connection |
| `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, `REDDIT_OAUTH_REDIRECT`, `REDDIT_OAUTH_STATE_SECRET`, `REDDIT_OAUTH_SUCCESS_URL`, `REDDIT_USER_AGENT` | The Reddit connection |

### Supabase Vault (read by SQL, for the scheduled jobs)

Present on 15 October 2026: `email_unsubscribe_secret`, `notification_service_role_key`.

### Vercel environment variables (Project, Settings, Environment Variables)

All are `VITE_` variables, which Vite builds into the public JavaScript. They are public by design (the Supabase anon key, the PostHog project key, RevenueCat's public SDK keys); nothing secret may ever be given a `VITE_` name. `scripts/check-env.mjs` fails a production build when a required one is missing.

- Required in production: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_REVENUECAT_WEB_API_KEY`, `VITE_POSTHOG_KEY`, `VITE_VAPID_PUBLIC_KEY`.
- Required for a store build: `VITE_REVENUECAT_IOS_API_KEY` (iPhone) or `VITE_REVENUECAT_ANDROID_API_KEY` (Android).
- Optional: `VITE_POSTHOG_HOST`, `VITE_GECK_DATA_SUPABASE_URL`, `VITE_GECK_DATA_SUPABASE_ANON_KEY`, `VITE_MARKET_SNAPSHOT_URL`, `VITE_MARKET_INTEL_URL`, `VITE_IMAGE_TRANSFORMS`.
- `middleware.js` also reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` on the server to log crawler visits.

### GitHub Actions secrets (Repository, Settings, Secrets and variables, Actions)

| Name | Used by |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | `daily-canary`, `morph-id-eval`, `weekly-changelog`, `agent-traffic`, `error-triage`. The service role key bypasses every database rule; plan item E1 10 is about keeping it away from any job where an AI edits files |
| `ANTHROPIC_API_KEY` | `weekly-changelog`, `error-triage`, `blog-pipeline` (paused) |
| `RESEND_API_KEY`, `BLOG_REPORT_EMAIL`, `BLOG_FROM_EMAIL` | `weekly-changelog`, `blog-pipeline` (paused) |
| `GOOGLE_SERVICE_ACCOUNT_JSON`, `GA4_PROPERTY_ID`, `GSC_SITE_URL` | `growth-report` |
| `PAGESPEED_API_KEY` | `seo-audit` |
| `GITHUB_TOKEN` | Provided automatically by GitHub |

### Outside the repository

- **Stripe dashboard:** the webhook signing secret for each endpoint, the live secret key, and the customer portal settings (whether cancellation ends at the period end or immediately is set there).
- **RevenueCat dashboard:** the webhook authorization header (same value as `REVENUECAT_WEBHOOK_AUTHORIZATION`).
- **Tennyson's machine only:** Android signing (`GECK_ANDROID_KEYSTORE`, `GECK_ANDROID_KEY_ALIAS`, `GECK_ANDROID_KEY_PASSWORD`, `GECK_ANDROID_STORE_PASSWORD`), Apple signing certificates, and the local flags `NATIVE_BILLING_WEBHOOK_VERIFIED` and `NATIVE_AUTH_REDIRECT_VERIFIED` (`docs/BILLING.md`, `docs/RELEASE_READINESS.md`).
- **The geck-data repository and its scraper** hold their own keys; this repository does not list them.

## 3. Backups: what exists and what does not

| What | Backed up? |
|---|---|
| Code, migrations, docs | Yes: git and GitHub. Production can be rebuilt from `main` |
| Database (members, records, `geck_data`) | Supabase's own backups, at whatever the plan includes. **Not confirmed:** the backup tier, how many days are kept, and whether point-in-time recovery is on (review, production check 8). No restore has ever been tried. Database size on 15 October: 361 MB |
| Photos in Storage | **No copy off the platform.** On 15 October: `listing-images` 10,903 files, about 6.7 GB (public); `geck-inspect-media` 817 files, about 1.5 GB (public); `promote-images` empty (public); `archive-listing-images` and `raw-uploads` private and nearly empty. Supabase database backups do not include the files themselves |
| Edge function secrets, Vault, dashboard settings | No copy. Section 2 lists the names so they can be recreated |
| A member's own data | Members can export their collection from the app; it is a collection archive, not a full account backup (`docs/launch-repairs-2026-09-06.md`, A13) |
| Scheduled job history | `purge-cron-run-details` keeps about 7 days, so a job that fails for longer than a week leaves no trace |

Plan item E1 11 asks for: the backup tier confirmed and written into `docs/MIGRATIONS.md`, a weekly copy of the storage buckets off the platform, one restore of one bucket tried, spend alerts in the Anthropic and Replicate consoles, and a free uptime check on `/`, `/AuthPortal`, `/Membership` and `/mcp`. All of these need Tennyson's accounts.

## 4. Support and moderation

- Support address: whatever `SUPPORT_EMAIL` in `src/lib/supportContact.js` says (a Gmail address on 15 October; plan item E1 9 moves it to support@geckinspect.com once Tennyson sets up the forward).
- In-app support form and ticket inbox (admin panel), which records replies.
- Reports on forum posts, gallery items, messages and listings go to the admin reports view, with hide, remove and block. No response-time target is written down yet (release gate 5 in `docs/RELEASE_READINESS.md`).

## 5. Scheduled jobs and bots

### In the database (pg_cron), as found on 15 October 2026

Times are UTC. "Last 7 days" is the run history the database keeps (section 3).

| Job | When | What it does | Last 7 days |
|---|---|---|---|
| `market-after-scrape-requests` | every 5 minutes | Follow-up work after a market scrape | 2,026 ok, 106 failed |
| `refresh-market-matviews` | hourly at :20 | Rebuilds the market summary views | 74 ok, **104 failed** |
| `market-brief-morning` | :35 past each hour, 13:00 to 20:00 | The Market page's daily brief | 58 ok |
| `market-value-daily` | 12:40 | Value estimate snapshot | 8 ok |
| `hatch-alerts-daily` | 13:00 | Hatch window alerts | 8 ok |
| `feeding-reminders-daily` | 14:10 | Feeding reminders | 8 ok |
| `personal-weighin-reminders-daily` | 14:20 | Weigh-in reminders that follow each gecko | 8 ok |
| `season-planner-reminders-daily` | 14:20 | Breeding season reminders | 8 ok |
| `vet-followups-daily` | 14:25 | Vet follow-up reminders | 8 ok |
| `weighin-reminders-weekly` | Sunday 15:00 | The older weekly weigh-in nudge | 1 ok |
| `weekly-digest-sunday` | Sunday 16:00 | The weekly digest email | 1 ok |
| `expire-referral-grants` | 04:30 | Ends referral free months | 8 ok |
| `clear-lapsed-featured-breeders` | 04:50 | Removes expired featured breeder slots | 8 ok |
| `prune-stale-push-subscriptions` | 03:17 | Drops dead web push subscriptions | 7 ok |
| `purge-cron-run-details` | 03:47 | Deletes job history older than about 7 days | 8 ok |
| `monthly-overage-billing` | 02:00 on the 1st | Social post overage billing (overage is paused) | not due |
| `process-scheduled-blog-posts` | every 5 minutes | **Inactive** (blog shelved) | |
| `promote_drain_scheduled` | every 5 minutes | **Inactive** (scheduled social posts) | |

Every reminder fires at a fixed UTC hour (about 7 am Pacific); profiles carry no time zone (review C15 item 3). Round 2 of the plan adds jobs (lifecycle emails, reminder changes); re-run the query in section 6 rather than trusting this table.

### In GitHub Actions (`.github/workflows/`)

| Workflow | When (UTC) | What it does |
|---|---|---|
| `ci` | Every push to `main` and every pull request | Lint, typecheck, tests, genetics drift check, full build |
| `deploy-watch` | When Vercel reports a failed production deploy | Opens or updates a `ci-failure` issue that emails Tennyson |
| `daily-canary` | Daily 14:07 | Signs in as the evaluation account, checks the value estimates, runs two real Morph IDs; a failure emails the repo owner |
| `growth-report` | Monday 11:00 | GA4 and Search Console report, committed to `docs/growth-reports/` |
| `weekly-changelog` | Monday 13:00 | Summarizes the week's commits into the in-app "What's New" (`change_logs`), and emails it when the email secrets are set |
| `seo-audit-weekly` | Monday 13:00 | Strict SEO audit |
| `agent-traffic` | Monday 15:20 | Exports AI crawler traffic to `docs/agent-review/` for the agent review session |
| `seo-audit` | 1st and 15th, 09:00 | SEO audit with PageSpeed, committed to `docs/seo-audits/` |
| `indexnow-submit` | When `public/sitemap.xml` changes on `main` | Tells Bing and others about new pages |
| `morph-id-eval` | By hand only | Grades Morph ID on 220 held-out geckos (about $6) |
| `error-triage` | By hand only since 15 October | AI triage of logged errors; its nightly schedule was switched off |
| `blog-pipeline` | By hand only, paused since 15 July | Blog research and publishing (shelved; do not re-enable) |
| Dependabot (`.github/dependabot.yml`) | Weekly | Opens grouped update pull requests for npm packages and Actions |

### Elsewhere

- A scheduled "Weekly agent review" Claude session on Mondays after `agent-traffic` (`docs/planning/agent-access-2026-10.md`). The review recommends running it monthly.
- The geck-data scraper (separate repository) that fills `geck_data`. The US full sweep has been blocked since early September; the failing `refresh-market-matviews` runs above are part of the same picture.

## 6. Weekly checklist (Mondays, about 30 minutes)

1. **Scoreboard.** Rewrite `docs/NOW.md` (the top ten, Part E5): breeder conversations, collections imported, paying breeders and monthly recurring revenue, passports issued and claimed, weekly active breeders, signups and the day-one first-gecko rate, monthly cost.
2. **Did anything break?** Open GitHub issues labelled `ci-failure`; the last `ci`, `daily-canary` and `growth-report` runs are green.
3. **Scheduled jobs.** In the Supabase SQL editor:
   ```sql
   select j.jobname, j.active,
          count(*) filter (where d.status = 'succeeded') as ok,
          count(*) filter (where d.status <> 'succeeded') as failed,
          max(d.start_time) as last_run
   from cron.job j
   left join cron.job_run_details d on d.jobid = j.jobid
   group by 1, 2 order by 4 desc, 1;
   ```
   Anything with failures, or a daily job with no run in the last day, gets a look. History only goes back about 7 days.
4. **Schema in step.** `supabase migration list` shows the same versions locally and on production (`docs/MIGRATIONS.md`); nothing is waiting in a deploy queue document.
5. **Money.** Stripe: new payments, failed payments, cancellations, disputes and refunds this week, and that the admin revenue tile agrees. RevenueCat: any store purchases.
6. **Credit balances.** Anthropic and Replicate have enough credit for a month (both have run dry once). Note any bill that moved.
7. **Email health.** Resend: bounce and complaint rates for the alerts sender, and any domain warnings.
8. **Errors.** The newest rows in `error_logs`, grouped by message.
9. **Support and moderation.** The support inbox and the in-app tickets are answered; the reports view is empty or handled.
10. **Market feed.** Is the US feed running? If not, the Market page and value estimates are getting stale; note it on the scoreboard.
11. **Dependabot.** Merge the grouped patch updates once CI is green; read anything major before merging.
12. **Docs reconcile.** Spend ten minutes checking `docs/CONTEXT.md`, `ROADMAP.md` and this file against what changed this week (the review's A13 recommendation: one weekly step whose only job is to keep the docs true).

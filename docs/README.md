# The documents, and which ones to trust

This is the map of every hand-written document in the repository. It says what each one is for and how far to trust it. Start here when you do not know where something is written down.

Written 11 November 2026 as part of the documentation review (`docs/planning/docs-review-2026-11-11.md`). Updated 12 November 2026, when that review's packages DOC-1, 2, 3, 5, 7 and 8 and part of DOC-4 were done. Keep it current: when you add, move or retire a document, change its row here in the same commit, then run `node scripts/check-doc-links.mjs`.

## How to read the status column

| Status | Meaning |
|---|---|
| **Live** | Work is being driven from it. Its open items are real. |
| **Reference** | Finished or stable, and still true. Safe to quote. |
| **Dated** | True on the day it was written. It carries a banner saying what has changed. Check before quoting. |
| **History** | Finished or replaced. Nobody should act on it. Kept so the reasons behind old choices can be found. |
| **Shelved** | For work that is switched off (the blog, retired features, paused plans). Do not act on it. |
| **Generated** | Written by a script or a scheduled job. Do not edit by hand. |

When two documents disagree, the order of trust is: the code, then a Live document, then a Reference document, then anything else.

## Read first, in this order

1. `CLAUDE.md` (repo root): how to work here, the rules, the current state of the product.
2. `ROADMAP.md`: points at the active plan.
3. `docs/planning/comprehensive-review-2026-10-14.md`, Part E: the active 90-day plan (to 17 January 2027).
4. `docs/NOW.md`: this week's numbers and top ten.
5. `docs/OWNER-STEPS.md`: everything waiting on Tennyson.
6. `docs/RULES.md`: every rule that binds future work, gathered from all the plans.
7. `docs/GLOSSARY.md`: what the words mean.
8. `docs/ARCHITECTURE.md`: how the code is laid out.

Then the document for the job in hand, from the table below.

## By job

| If the work is about | Read | Then |
|---|---|---|
| What to build next, priorities | Part E of `planning/comprehensive-review-2026-10-14.md`, `NOW.md` | `planning/experience-review-2026-11-11.md` for screens |
| Any screen, flow or copy in the app | `planning/experience-review-2026-11-11.md` (the status table at the top, then sections 2 and 9) | `specs/DESIGN-SYSTEM.md`, `planning/homepage-ab-test-2026-10.md` (what is frozen) |
| The landing page or theme defaults | `planning/homepage-ab-test-2026-10.md` | Nothing changes there while the test runs |
| Sign-up, first gecko, onboarding | `planning/activation-2026-10.md` | `planning/experience-review-2026-11-11.md` WP-12 |
| Database or edge functions | `MIGRATIONS.md`, `INFRASTRUCTURE.md` | `planning/deploy-queue-2026-10-03.md`, `../supabase/SCHEMA_CONVENTIONS.md` |
| Admin access, two-factor | `planning/admin-mfa-2026-10.md` | |
| Money: plans, Stripe, App Store purchases | `BILLING.md` | `planning/launch-offer-tests-2026-10.md` |
| The iPhone app and App Store | `planning/app-store-resubmission-2026-10-26.md` | `APP_STORE_REQUIREMENTS.md` |
| Any email | `marketing/email-brain.md` | `planning/lifecycle-emails-2026-10.md`, `planning/weekly-notes-2026-10.md` |
| Morph ID | `specs/morph-id.md`, `morph-id-eval/README.md` | |
| Market prices, the Price Index | `planning/agent-access-2026-10.md` | Part B9 and item E4 34 of the comprehensive review. `planning/market-habit-2026-09-30.md` is Dated. |
| Passports and transfers | `planning/qr-transfer-security-2026-10-17.md` | `specs/P1-animal-passport.md` (Dated) |
| MorphMarket import and export | `planning/morphmarket-import-reference-2026-10-24.md` | |
| Retired features | `planning/retired-features-2026-10.md` | |
| Breeder conversations | `planning/breeder-interviews-2026-10.md` | |
| AI crawlers, the MCP server | `planning/agent-access-2026-10.md` | |
| Services, costs, scheduled jobs, backups | `OPERATIONS.md` | `RESTORE.md` |
| Search and prerendered pages | `seo.md` (Dated) | |
| Competitors, market, positioning | `../STRATEGY.md` | `planning/competitive-landscape-2026-10.md` (Dated) |
| Why something was decided | `DECISIONS.md` (its status index first) | |
| A script: what runs it, what it writes | `../scripts/README.md` | `OPERATIONS.md` section 5 for workflow schedules |
| An address named in an old spec | `ARCHITECTURE.md`, section 12 | |
| Prices and plan limits | `CONTEXT.md`, section 5 | The code is the source: `../src/lib/stripe-config.js`, `../src/lib/tierLimits.js` |

## Every document

### Repo root

| File | What it is | Status |
|---|---|---|
| `CLAUDE.md` | Working agreement for AI sessions | Live |
| `README.md` | The GitHub front page: stack, commands, repo map | Reference |
| `ROADMAP.md` | Pointer to the active plan; what is shelved | Live |
| `STRATEGY.md` | Market, competitors, positioning | Reference |
| `PRODUCT.md` | Short product summary and voice | Reference |

### docs/ (top level)

| File | What it is | Status |
|---|---|---|
| `README.md` | This map | Live |
| `NOW.md` | Weekly scoreboard and top ten | Live (last refreshed 31 October) |
| `OWNER-STEPS.md` | Every step and decision waiting on Tennyson | Live |
| `RULES.md` | Rules that bind future work | Live |
| `GLOSSARY.md` | Product and crested gecko terms | Reference |
| `ARCHITECTURE.md` | Map of the code; section 12 maps addresses in old specs to the real ones | Reference |
| `CONTEXT.md` | What the product is, facts and state. Section 5 is the one table of prices and plan limits | Reference (sections 1 to 5 and 8 corrected 12 November) |
| `DECISIONS.md` | Decision log, entries 1 to 67, with a status index at the top | Reference (entries are never rewritten; the index says which still hold) |
| `ENGINEERING.md` | Integration boundaries, entry points, verification | Reference |
| `OPERATIONS.md` | Services, costs, secrets by name, jobs, weekly checklist | Reference |
| `INFRASTRUCTURE.md` | What production runs that the repo cannot rebuild. The one home for the edge function counts (section 2) and the database job schedules (section 4) | Reference (production last read 28 and 31 October) |
| `MIGRATIONS.md` | How database changes reach production. The one full account of what a merge to `main` deploys | Reference |
| `BILLING.md` | Billing contract: Stripe (portal setup, webhook events, refunds and disputes) and the App Store | Reference |
| `RESTORE.md` | How to restore from a backup | Reference (the backup has not run yet; see OWNER-STEPS) |
| `APP_STORE_REQUIREMENTS.md` | App Store evidence log | Dated (the newest section is the truth) |
| `seo.md` | Map of the search and prerender layer | Dated |
| `error-triage.md` | The error triage job | Dated (runs by hand only, files issues) |
| `INTENT.md` | April 2026 landing page brief | History |
| `RELEASE_READINESS.md` | 17 October release gates | History (replaced by the App Store documents) |
| `app-store-billing.md` | Old store billing checklist | History (replaced by `BILLING.md`) |
| `native-shell-plan.md` | Pre-build plan for the phone apps | History |
| `launch-repairs-2026-09-06.md` | 6 September repair ledger | History |
| `WEBSITE_BUILDER.md` | The My Store website editor | Shelved (retired 16 October, code kept) |
| `blog-pipeline.md`, `blog-style-guide.md`, `blog-voice-examples.md` | The blog pipeline and its style rules | Shelved (blog work is off) |
| `blog-queue.json`, `blog-budget.json`, `blog-queue.schema.json`, `error-triage-state.json` | State files for jobs | Generated |

### docs/planning/

| File | What it is | Status |
|---|---|---|
| `comprehensive-review-2026-10-14.md` | Full review; **Part E is the active plan** | Live (Part E); Dated (Parts A to D) |
| `experience-review-2026-11-11.md` | Screens, flows, 14 work packages | Live |
| `docs-review-2026-11-11.md` | Review of these documents and what was changed | Reference |
| `deploy-queue-2026-10-03.md` | What each database round changed; dashboard steps | Live (the open list at the top) |
| `homepage-ab-test-2026-10.md` | The running landing page test and what is frozen | Live |
| `app-store-resubmission-2026-10-26.md` | Owner steps and paste-ready text for Apple | Live |
| `breeder-interviews-2026-10.md` | Breeder conversations, the questions, the offer | Live |
| `admin-mfa-2026-10.md` | Admin two-factor sign-in | Live |
| `launch-offer-tests-2026-10.md` | Paywall headline test, compare pages, pricing suggestions | Live |
| `agent-access-2026-10.md` | AI crawlers, open data, MCP, weekly agent review | Live |
| `weekly-notes-2026-10.md` | Weekly Gecko Notes: rules and how notes are added | Live |
| `lifecycle-emails-2026-10.md` | Getting-started emails (live since 17 October) | Reference |
| `retired-features-2026-10.md` | What was retired and how to switch it back | Reference |
| `qr-transfer-security-2026-10-17.md` | The transfer contract and its security review | Reference |
| `private-sale-prices-2026-11.md` | Sale prices kept from other members: why, how, checks, what is left (owner emails) | Reference |
| `owner-emails-2026-11.md` | Owner email addresses kept from other members (E16): the two steps, checks, status | Live |
| `morphmarket-import-reference-2026-10-24.md` | MorphMarket's import fields | Reference |
| `instrumentation-2026-10.md` | Analytics events and the funnel | Reference |
| `activation-2026-10.md` | Guided first gecko, default reminders | Reference |
| `signed-in-home-2026-10.md` | The 17 October Dashboard (called Overview since 13 November 2026) | Reference |
| `feature-completeness-audit-2026-09-29.md` | The plan before 15 October; per-feature status; phone and money checks | Dated |
| `growth-funnel-2026-10.md` | 5 October funnel numbers | Dated |
| `competitive-landscape-2026-10.md` | 5 October competitor research | Dated |
| `market-habit-2026-09-30.md` | Market page work | Dated |
| `ball-python-app-2026-10.md` | Ball python site plan | Shelved (paused until 17 January 2027) |
| `history/` | Sixteen finished audits, plans and test logs, with their screenshots | History |

`planning/history/` holds: `AUDIT_REPORT.md`, `IMPROVEMENT_PLAN.md`, `MORPH_CALCULATOR_PLAN.md`, `launch-review-2026-09-04.md`, `rls-policy-consolidation.md`, `mobile-uiux-audit-2026-09-10.md`, `custom-card-market-scan-2026-09-05.md`, `vip-audit-2026-09-27.md`, `growth-plan-2026-10.md`, `first-impression-2026-10.md`, `qa-2026-10-05.md`, `landing-speed-2026-10.md`, `morph-observation-review-2026-10.md`, `cretti-briefing.md`, `agent-access-prompts.md`, `stripe-plan-switching-2026-10.md` (moved from `docs/` on 12 November; its setup and rules are now in `BILLING.md`).

### docs/specs/

| File | What it is | Status |
|---|---|---|
| `DESIGN-SYSTEM.md` | The one design document | Reference |
| `morph-id.md` | The Morph ID product brief | Reference |
| `P11-quality-rubric.md` | The quality scale (code comments point here) | Reference |
| `P1-animal-passport.md`, `P2-market-pricing.md`, `P6-batch-husbandry.md`, `P7-printable-worksheets.md`, `P8-breeder-storefront.md`, `P10-morph-photos.md` | Specs for features that shipped | Dated (built; the routes and tables in them do not match the code, see `ARCHITECTURE.md` section 12; their paste-ready build prompts were removed on 12 November) |
| `morph-catalogue-consolidation.md` | Proposal to merge the morph lists | Dated (step 0 done, the rest not started) |
| `history/` | Specs for retired, shelved or replaced work | History |

`specs/history/` holds: `FEATURE-PRIORITY-MAP.md`, `P3-breeding-roi.md`, `P4-breeding-loans.md`, `P5-geck-answers.md`, `P9-breeding-journal.md`, `geck-data-market-snapshot.md`, `pricing-decision-2026-07.md`, `storefront-consolidation.md`.

### Other folders under docs/

| Folder | What it is | Status |
|---|---|---|
| `marketing/email-brain.md` | Rules and log for all email | Live |
| `morph-id-eval/README.md` | How Morph ID is graded | Reference |
| `legal/terms-additions-draft.md` | Draft additions to the Terms | Live (decisions are Tennyson's) |
| `security/` | Two security reviews (July and September) | History |
| `research/iherp-competitive-analysis.md` | April 2026 research behind specs P1 to P10 | History |
| `reviews/qr-transfer-detail-2026-10-17/` | Review notes for the QR transfer change (merged 24 October) | History |
| `audits/amazon-product-images-2026-10-17.md` | Fixes in the supplies store | Shelved (the store is retired) |
| `kaleidoscope/` | A second genetics model that was never built | Shelved |
| `drafts/crested-gecko-software-2026.md` | The shelved comparison article | Shelved (do not edit or move) |
| `archive/base44/` | Export from the previous platform | History |
| `growth-reports/`, `seo-audits/`, `blog-reports/`, `agent-review/` | Weekly and fortnightly job output | Generated |

### Outside docs/

| File | What it is | Status |
|---|---|---|
| `supabase/SCHEMA_CONVENTIONS.md` | How the schema is named and changed | Reference |
| `supabase/SCHEMA_SNAPSHOT.md` | Table list as of 5 September | Dated |
| `supabase/migrations/README_*.md`, `_applied_by_hand/`, `_never_applied/`, `_pre_rebaseline_history/` | Notes beside the migrations | Reference and History |
| `supabase/functions/*/README.md` | One per edge function that needs explaining | Reference |
| `supabase/pending/README.md` | Changes waiting for a decision | Live |
| `scripts/README.md` | Index of every script and folder in `scripts/` (what it does, what runs it, what it writes), then the Morph ID operations | Reference |
| `scripts/sql-harness/README.md`, `scripts/morph-id-eval/README.md` | How to run the SQL tests and the Morph ID evaluation | Reference |
| `content/weekly-notes/*.md` | The Weekly Gecko Notes themselves (email content, not documentation) | Live |
| `art/README.md`, `vendor/README.md`, `public/**/README.md` | Notes beside assets | Reference |

## Rules for these documents

1. One fact, one home. Prices and plan limits live in the code (`src/lib/stripe-config.js`, `src/lib/tierLimits.js`), and the one table of them in the documents is `CONTEXT.md`, section 5. Edge function counts and database job schedules live in `INFRASTRUCTURE.md` (sections 2 and 4). How a merge deploys lives in `MIGRATIONS.md`. Other documents point there.
2. A document that stops being true gets a banner on its first lines saying so and naming what replaced it. Then its row here changes.
3. A finished plan moves to a `history/` folder. Use `git mv`, then fix the references (`node scripts/check-doc-links.mjs` finds the broken ones).
4. Steps for Tennyson go in `docs/OWNER-STEPS.md`, with the link and the exact values first. Other documents link to the step; they do not repeat it.
5. Rules that bind future work go in `docs/RULES.md`.
6. No em dashes or en dashes, plain words, dates written as "11 November 2026".
7. Never write a member's or a breeder's email address or phone number in any document. The repository is public.

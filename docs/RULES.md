# Rules that bind future work

Every standing rule that was scattered across the plans, in one place. Each has its source, so the reason can be read. If a rule here and its source disagree, the source wins; fix this page.

Gathered 11 November 2026. The rules for how to work in the repository (git, writing style) are in `CLAUDE.md` and are not repeated here.

## 1. The plan (until 17 January 2027)

Source: Part E of `docs/planning/comprehensive-review-2026-10-14.md`, sections E0, E5 and E6.

1. **The 90 days are a sales experiment.** The question is whether crested gecko breeders will pay for records, passports and transfers. Engineering that does not serve that question, or close a hole that could hurt a member, waits.
2. **Breadth is frozen.** No new pages, species, plan tiers, tools, integrations, games, stores or social features until weekly active breeders have grown four weeks in a row.
3. **A human in the loop for money, sign-in, access and deletion.** No agent holds a live payment key or the database's service role in an interactive session.
4. **Tennyson rewrites the top ten in `docs/NOW.md` every Monday.** A session may draft it and must mark the draft as a draft.
5. **Day 30 rule (17 November):** fewer than 15 breeder conversations means engineering pauses and the time goes to conversations.
6. **A comped account is not evidence** that breeders will pay. Prepayment is.
7. **Tripwires, at any time:** a legal notice about market data stops collection the same day; costs over $150 a month with revenue under $50 at day 60; any billing or privacy incident freezes deploys until it is understood.
8. **Not before decision day:** ball python work, Enterprise sales, price changes (until five breeders have answered the $120 offer), a registry listing for the MCP server (until counsel has looked at the data position), new audits or reviews (unless Tennyson asks for one).
9. **Quote every number with its date and its definition.** Say which "weekly active" is meant: breeders (logging records) or members (signed in).

## 2. Things that are switched off

1. **Blog posts and articles are shelved** (30 September 2026). Do not write, draft, publish or suggest them, and do not switch the blog pipeline back on. Search queries with no matching page are data, not tasks. Source: `ROADMAP.md`.
2. **Retired features keep their code and their tables.** Nothing is deleted without Tennyson's say, and there is no deletion date. The list and how to switch each back on: `docs/planning/retired-features-2026-10.md`. (The comprehensive review's "delete after a month" is overruled by this.)
3. **The menu stays at 12 destinations, and 8 or fewer in Keeper mode (7 today).** `src/lib/navItems.derived.test.js` fails if it grows.
4. **Geck Inspect is crested geckos only.** The website and the phone apps do not take other species. Source: `docs/planning/ball-python-app-2026-10.md`, `CLAUDE.md`.
5. **International expansion and the Korean market plan are not active.** Source: `ROADMAP.md` (old item 15).

## 3. The homepage test

Source: `docs/planning/homepage-ab-test-2026-10.md`.

1. Do not change `src/pages/Home.jsx`, `src/pages/HomeControl.jsx`, `src/components/landing/` or the theme defaults while the test runs. Not even a comment.
2. Do not change the split, the bucketing or either design mid-run.
3. Do not post the preview links as acquisition links.
4. A change that must wait goes in the "Queued until the test ends" section of that document. A site-wide change that reaches both arms equally is logged under "Changes made while the test runs".

## 4. Pricing and the paywall test

Source: `docs/planning/launch-offer-tests-2026-10.md`.

1. Never edit a paywall headline while its test runs.
2. Price display changes wait until the outcome test has picked its arms.
3. Never invent or round up member counts or testimonials.
4. Never contradict the refund terms.
5. The live prices are in `src/lib/stripe-config.js` and the plan limits in `src/lib/tierLimits.js`. Documents point there; they do not restate prices as fact.

## 5. A public repository, and people's details

1. **Never write a breeder's or a member's email address or phone number in any file**, and never commit query results that contain them. Source: `docs/planning/breeder-interviews-2026-10.md`.
2. The business's postal address stays out of the repository. Source: `docs/planning/weekly-notes-2026-10.md`.
3. Secret values never go in a document, a commit or a chat message. Name the secret and say where it is set.
4. `MORPH_SHARE_VIEW_KEY` never gets a `VITE_` name (that would publish it). Source: `docs/planning/deploy-queue-2026-10-03.md`.
5. `tennyscrestedgeckos.com` is not Tennyson's site. It never appears as his brand or as founder credibility. Source: `CLAUDE.md`.

## 6. The database and edge functions

Sources: `docs/MIGRATIONS.md`, `docs/planning/deploy-queue-2026-10-03.md`, `docs/planning/admin-mfa-2026-10.md`.

1. **Merging to `main` applies new migrations and deploys the functions declared in `supabase/config.toml`.** There is no separate apply step.
2. Every change must work with the old app and the new app, before and after its migration, because members keep old copies of the app open.
3. Date a new migration so it sorts after the newest one in production.
4. No custom setting in a function's `SET` clause (a test enforces it).
5. `embed-gecko-image` and `export-training-corpus` stay hand-deployed.
6. `admin_requires_mfa` stays false until the follow-up migration has shipped.
7. Do not run the photo GPS strip until backups are running.
8. No spending on Morph ID grading without Tennyson's OK.
9. Fix the double-checkout race only if it ever happens.

## 7. Transfers and passports

Source: `docs/planning/qr-transfer-security-2026-10-17.md`.

1. A signed-out visitor to a claim link sees no animal or owner details. Do not add a preview.
2. The browser never creates an open QR transfer row itself; only the server function does.
3. Never widen sign-in redirect wildcards or switch off email verification to make a test pass.
4. A sale never makes a gecko public. Only "Make a passport" does, and it says so first.

## 8. Market data and the Price Index

Source: `docs/planning/agent-access-2026-10.md`.

1. The Price Index is asking prices from listings, not sale prices, and is described that way everywhere.
2. It is not published under an open licence and is not called original data. The source sites are not named.
3. A Price Index row needs at least 30 listings. Any statistic made from members' own data needs at least 50 records.
4. If a marketplace objects, stop and delete as that document describes.
5. Do not work around a marketplace's block with a proxy. Whether to restore the US feed at all is Tennyson's decision (plan item E4 34).

## 9. MorphMarket export

Source: `docs/planning/morphmarket-import-reference-2026-10-24.md`.

1. Never switch the old 14-column quick export back on.
2. Keep Synchronize and Replace off for partial batches.

## 10. Email

Sources: `docs/marketing/email-brain.md`, `docs/planning/weekly-notes-2026-10.md`, `docs/planning/lifecycle-emails-2026-10.md`.

1. Read `docs/marketing/email-brain.md` before writing or changing any email.
2. A published Weekly Gecko Note's slug is never renamed or reused. Keep at least 8 written notes ahead of the weeks since launch.
3. Notes obey their own writing rules: no dashes of any kind, "1 to 2" not "1-2", no first person, no blog links, no retired features, no months or seasons.
4. If the `/log` page were ever removed, switch the reminder and getting-started emails off first: their links go there.
5. A copy change to the getting-started emails is a `send-email` deploy plus a preview refresh.

## 11. The App Store

Source: `docs/planning/app-store-resubmission-2026-10-26.md`.

1. Do not resubmit an old build; upload the current one.
2. Screenshots and the review recording must not show retired features.
3. A screen named in the review notes or shown in store screenshots does not change shape without checking that document.
4. A change on the website reaches the iPhone app only with the next uploaded build.

## 12. Work packages from the experience review

Source: `docs/planning/experience-review-2026-11-11.md`, sections 0 and 2.

1. One package per commit. Run `pnpm lint`, `pnpm test` and `pnpm test:e2e` before pushing. CI runs two more checks that those three do not, and each failed on `main` once in November 2026: `pnpm test:clock-drift` (the unit tests with the clock moved 400 days each way; run it when a new test uses a date) and the size check (`pnpm exec vite build`, then `node scripts/check-bundle-size.mjs`; run it when you change what a page imports, including adding or removing an icon).
2. Add a dated status line under the package when it ships.
3. The only new dependencies allowed are `@capacitor/haptics` and `@capacitor/keyboard` (package WP-11).
4. That review is not the plan. Part E is.

## 13. Documents

Source: `docs/README.md`.

1. One fact, one home. Steps for Tennyson go in `docs/OWNER-STEPS.md`; rules go here.
2. A document that stops being true gets a banner on its first lines and its row in `docs/README.md` changes.
3. After moving or renaming a document, run `node scripts/check-doc-links.mjs`.

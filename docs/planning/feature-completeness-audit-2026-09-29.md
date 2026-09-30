# Feature completeness audit and plan, 29 September 2026

Every feature in Geck Inspect was traced end to end: the screen, the button handler, the data call, the table rule or edge function behind it, and back to what the member sees. Production data, the API and database logs, the edge function list and the security advisors were checked alongside the code. About 60 small bugs were fixed on the spot (section 3). This document is the plan for everything else, ordered from the least finished feature to the most, so that working down it top to bottom ends with every feature either finished or deliberately retired.

## 1. How to continue

- Start with Phase 0 (section 6). Those items are small, but they involve money, member data or the domain's email reputation, so they go before feature work even though the rest of the plan runs least finished first.
- Then work the steps in section 7 in order. Each step says what is missing, why it matters, its size, any decision it needs and when it counts as done. Sizes: S is under a day, M is one to three days, L is a week or more.
- Several steps start with a decision only Tennyson can make. They are collected in section 5 with a recommendation each, so they can be answered in one sitting. A step whose decision is "retire" becomes an S: remove it from navigation, the sitemap and marketing, then delete or redirect it.
- When a step ships, add a dated status line under it here. This file is the roadmap now (ROADMAP.md points here and lists what is shelved).
- Section 8 lists the checks that need a real phone or real money (the sandbox cannot reach the live API). Those are Tennyson's, and they are the last gate before calling a feature finished.

## 2. Where things stand

**Usage (production, 29 September):** 135 profiles (about 50 real accounts; the rest are legacy rows from the old platform), 341 geckos, 3,807 gecko photos (3,769 of them are scraped marketplace listing photos used as Morph ID reference data, only 38 are member uploads), 393 weigh-ins, 163 eggs, 27 breeding plans, 823 notifications, 177 direct messages (none in the last 30 days), 13 forum posts.

**Features nobody has used yet** (0 rows ever): feeding records, shed records, vet records, feeding groups, clutches, pairing outcome logs, breeding loans, waitlists, breeder reviews, breeder inquiries, support messages, testimonials, giveaways, mentor offers, sensor connections, shipping orders, store orders, social platform connections, referral rewards. Some of those are unused because they were broken (vet records cannot be created at all; message notifications never saved), which section 3 and section 7 cover.

**Health:** no Vercel runtime errors in 7 days; the production build, 890 unit tests and lint pass; the SEO audit went from 68 warnings to 0 today. Morph ID returned 49 errors on 28 September, all in the hour the Anthropic credit ran out (already fixed). The API errors in the last day are the Geck Intellect companion site's market functions under crawler load (fixed in the geck-data repo on 29 September) plus two small client bugs fixed today.

## 3. Fixed during the audit (commit 3349056, deployed)

Two database changes were applied with it: `20260929162253_allow_unsexed_price_entries` and `20260929165434_notification_delete_own_and_admin_unpublish`.

**Broken for signed-in members**
- Care Guide topics and series, the Morph Guide category and inheritance hubs, breeder pages (`/Breeder/<slug>`, including My Store's "View" button), About, Marketplace Verification and the pedigree, breeding-records and price guide pages were all "Page not found" inside the app, as were `/Subscription` and `/GeckAnswers`. They were only registered for signed-out visitors.
- Notifications for another member (new message, forum reply, new follower, admin broadcasts) never saved. The app wrote the row and then read it back, and the read rule only lets you see your own notifications, so the database refused the whole insert. Production has never had a single new-message or reply notification, despite 177 messages. Signed-out support messages failed the same way.
- Field Mode, the Gallery and Training showed "This feature is currently unavailable": hiding a page from the sidebar in the admin Pages tool also blocked its address, and the passport quick log opens Field Mode while the Dashboard links to the Gallery.
- Edit Breeding Plan never saved anything, a second copy of the dialog opened on top of it, and Delete Plan removed the plan and all its eggs with one tap and no confirmation.
- Market Pricing's "Log a sale" failed for unsexed animals (the database only allowed male or female) and gave no message.
- My Listings dropped every sold gecko, and 13 geckos marked Sold without being archived had vanished from My Geckos.

**Dates:** events were saved shifted by the time zone offset (an 8:15 pm feeding in California became 3:15 am the next day). Batch Husbandry, Breeding Pairs, the Season Planner calendar and plan estimates showed or saved the day before for anyone in the Americas. Feeding a group in Batch Husbandry never moved the group's schedule, so its reminders stopped after the first cycle. The in-app hatch alerts never stopped for an egg left at Incubating (the 27 September fix covered only the server job).

**Crashes:** clearing the date in Record Lock, and expanding a plan with an egg that has no expected hatch date.

**Privacy and security:** forum posts and comments published members' email addresses as the author name; member emails went to Google Analytics in page addresses, into error-log addresses, and to a third-party badge poll every two minutes; CSV import matched other breeders' public geckos by ID code; the printed Lineage Card showed the owner's email. Admins can now unpublish another member's listing (Content Moderation failed silently before), and members can delete their own notifications.

**Money and trust:** a pairing's value fell as its eggs hatched; the Membership and landing pages promised things that do not exist (Enterprise "Breeding ROI projections", an Enterprise price on a plan marked Coming soon, "every feature free", "50+ care topics", paid-only certificates that are free, a question the app cannot answer); the Morph Guide's "photos uploaded by keepers" were scraped listing photos (now only reviewed member photos show); Promote's scheduling is hidden because scheduled posts were never published.

**Also:** the calculator no longer files a Content Security Policy report on every load (zod's eval probe is off); store pages recover from stale files after a deploy; "Stay signed in" off no longer signs the member out on every other device; an expired email link now says so; the demo's "view-only" message appears during the guided tour; seven wrong or dead admin screens and settings were fixed or removed; Breeding ROI (retired) redirects to Breeding.

## 4. Completeness by feature

Estimates after today's fixes, least finished first. "Hidden" means not in navigation today.

| Feature | Where | Status | Done | Biggest gap |
|---|---|---|---|---|
| Vet records | Gecko record, passport | Stub | 20% | Nothing in the app can create a vet record |
| Offline records | Service worker | Partial | 25% | Only the app shell works offline |
| Account deletion | Settings, Danger Zone | Partial | 30% | Files a ticket; no admin alert, erasure is by hand |
| Morph Guide photo submissions | /MorphGuideSubmission | Broken | 30% | Approved photos are never shown anywhere |
| Breeding Loans | /BreedingLoans, hidden | Broken | 35% | A new loan never becomes active and has no actions |
| Supplies store checkout | /Store | Partial | 40% | Checkout is off; the sticker and tee builders lead nowhere |
| AI Training Center | /TrainModel, admin | Broken | 40% | Duplicates the Evidence Lab; its AI check never sees the image |
| Promote social posting | /Promote, hidden | Partial | 45% | No platform proven end to end |
| Enclosure sensors | Settings, Govee | Partial | 45% | Manual refresh only; untested with a real device |
| Morph Visualizer | /MorphVisualizer, hidden | Partial | 45% | Placeholder art; its own trait list and prices |
| Breeding Pairs | /BreedingPairs | Partial | 55% | Older duplicate of Breeding |
| Native apps | iOS, Android | Partial | 55% | No push, app links or store release |
| Breeder pages and trust | /Breeder, My Store | Partial | 60% | "Verified" can never be earned; reviews cannot be written |
| Content moderation | Admin | Partial | 60% | No report queue; photos and profiles cannot be moderated |
| Settings | /Settings | Partial | 65% | About a third of the switches do nothing |
| Feeding and reminders | Batch Husbandry, Project Manager | Partial | 65% | Two feeding logs that disagree |
| The gecko record | Record window, /GeckoDetail | Partial | 65% | Split in two; the shed forecast gets no input |
| Season Planner | /ProjectManager | Partial | 70% | Reminders fire only with the page open; notes live in one browser |
| Support | Feedback, Support inbox | Partial | 70% | Replies are not recorded on the ticket |
| Passport and transfers | /passport, /claim | Partial | 70% | Buyers see no weight history; transfers use pop-up prompts |
| Membership and billing | /Membership, Stripe | Partial | 70% | An upgrade starts a second subscription |
| Market (brief, live feed, watchlist, Guess the Price, your listings) | /Market | Partial | 70% | US listings unchecked since early September until the MorphMarket feed is back on; see docs/planning/market-habit-2026-09-30.md |
| MorphMarket export | Business Tools | Polish | 75% | CSV never checked against MorphMarket's importer |
| Forum | /Forum | Polish | 75% | No editing, photos or view counts |
| Messages and notifications | /Messages, /Notifications | Polish | 75% | Buyer inquiries have no inbox; no native push |
| Admin panel | /AdminPanel | Polish | 80% | Delete User leaves the login and data behind |
| Breeding plans and eggs | /Breeding | Polish | 80% | Several hatch paths that behave differently |
| Genetics for your own geckos | Plans, Pairing Planner, waitlists | Polish | 80% | Several tags are silently treated as normal |
| AI Consultant | /BreederConsultant, hidden | Polish | 80% | No refund when the AI call fails; answers not tied to the calculator |
| Quality Scale | /QualityScale | Polish | 80% | Tier reference photos promised since May |
| Lineage and pedigree | /Lineage, /Pedigree | Polish | 80% | Private or claimed parents show as Unknown |
| Collections and collaborators | Settings | Polish | 80% | Deleting a collection hides its geckos |
| My Geckos and adding geckos | /MyGeckos | Polish | 85% | The 10-gecko free limit is only checked in one place |
| Morph ID | /Recognition | Polish | 85% | No public front door; "better photos needed" still uses the credit |
| Morph Guide | /MorphGuide | Polish | 85% | Few member photos yet |
| Marketplace | Buy, Sell, My Listings | Polish | 85% | No report button; Unlist overwrites the gecko's status |
| Business Tools and Market Pricing | /MarketplaceSalesStats | Polish | 85% | About 2,200 lines of dead analytics code |
| Field Mode | /FieldMode | Polish | 85% | No offline queue or backdating |
| Other Reptiles | /OtherReptiles | Polish | 85% | Weights stored as text in notes |
| Printable Worksheets | /PrintableWorksheets | Polish | 85% | One QR code per gecko, no rack label sheet |
| Dashboard | /Dashboard | Polish | 85% | Mark fed writes no record for each gecko |
| Sign in and onboarding | /AuthPortal | Polish | 85% | No display name at sign-up; onboarding is per browser |
| Care Guide | /CareGuide | Polish | 90% | The guide email can be abused |
| Genetics calculator | /calculator | Polish | 90% | Genetics Guide text disagrees with the engine on White Wall |
| Waitlists | /waitlist | Polish | 90% | No confirmation email to the buyer |
| Landing and public pages | /, guides | Polish | 90% | Forum and Gallery in the sitemap sit behind a sign-in wall |
| Blog | /blog | Complete | 95% | Posts written in the admin editor never reach search engines |
| Mentorship, Giveaways, Shipping | Unreachable | Dead code | n/a | Retire (step 5) |

## 5. Decisions only Tennyson can make

Each is referenced by the step that needs it. The recommendation is what the plan assumes if there is no answer.

| # | Question | Recommendation |
|---|---|---|
| D1 | Plan changes: let members switch plans in the Stripe billing portal, or build switching in the app? | Portal switching (turn it on in Stripe settings). Fastest and handles proration. |
| D2 | Offline: build offline logging, or stop claiming it? | Build a small offline queue for Field Mode and quick logs only; reword the rest. |
| D3 | Morph Guide photo submissions: show approved photos on morph pages with credit, or retire the page? | Show them. It grows the member photo set, which is 38 photos today. |
| D4 | Breeding Loans: finish or remove? | Remove for now (0 loans ever); revisit if a breeder asks. |
| D5 | Supplies store: affiliate links only, or open checkout (stickers, tees, store items)? | Affiliate only now; open checkout when there is demand. |
| D6 | Enclosure sensors: keep or hide? | Hide until one real Govee device test passes. |
| D7 | Morph Visualizer: hide or finish? | Hide (take it out of the sitemap and search listings). |
| D8 | Promote: Bluesky plus copy-out only, or go through Meta's App Review for Facebook and Instagram posting? | Bluesky plus copy-out, and do not spend a post credit on a copy. |
| D9 | Breeder trust: how does a breeder become "Verified", and should reviews exist? | Verified by admin review of a short checklist; reviews only from a completed transfer (a verified purchase). Until built, remove the review section. |
| D10 | "Feature me on the Dashboard": self-serve for the Breeder plan, or "Request to be featured"? | Self-serve for Breeder, as Membership promises. |
| D11 | Membership promises with no feature (expert verification eligibility, early access, priority support) and paid features that are free today (Keeper's lineage tree and feeding groups, Breeder's sales stats): deliver or reword? | Reword now; gate nothing that free members already use. |
| D12 | Enforce the 10-gecko free limit everywhere (quick add, CSV import, the database), or accept the gap? | Enforce it, but never block a gecko that already exists. |
| D13 | Genetics wording: does a bare "Phantom" tag mean a visual Phantom? Add "Het Phantom" to the tag picker? Is "White Wall" the engine's Whiteout? | Yes, yes, and yes (to be confirmed against how breeders use the words). |
| D14 | Forum: keep and improve, or fold into something lighter? | Keep; add photos first, since "what morph is this?" threads need them. |
| D15 | Community Connect: merge its breeder directory into a searchable directory, or delete it? | Delete it; breeder pages and the marketplace cover it. |
| D16 | Account deletion: delete or anonymise records other members depend on (transfers, lineage)? | Anonymise those; delete everything else. |
| D17 | Season definition: calendar year everywhere (the timeline uses it; plans and the Hatchery use quarters)? | Calendar year. |
| D18 | New breeding plans notify every follower. Keep, make it opt-in, or only for public plans? | Only for public plans. |
| D19 | Morph ID: refund the credit when the answer is "better photos needed"? Save every identification for review (needs a privacy line in the Terms)? | Refund for the free try; save for review only with consent. |
| D20 | Scraped marketplace listing photos: allowed on public pages at all? | No (they no longer appear as community photos after today's fix). |
| D21 | Does feeding some of the geckos in a group count as feeding the group (moving its schedule)? | Yes when at least one was fed, which is what Batch Husbandry does as of today. |

## 6. Phase 0: safety, money and data (about 3 days in total)

These come first because each one can cost money, leak a member's data or damage the domain's email reputation, and each is small.

**0.1 Close the breeder inquiry email relay (S).** `supabase/functions/send-breeder-inquiry` takes the recipient address from the request and has no rate limit, so anyone can send email from alerts@geckinspect.com to any address, with a reply-to they choose. Look the breeder's address up on the server from the breeder's slug, honour `accepts_inquiries`, and limit inquiries per sender email and per network. Done when an arbitrary recipient is refused and the sixth inquiry in an hour from one sender is refused.

Status 29 Sep: done (send-breeder-inquiry v20, migration 20260929214653). The recipient now comes from the breeder's slug, `accepts_inquiries` is honoured, and sends are limited to 5 per sender and 10 per network per hour and 30 per breeder per day. Checked live: no slug is refused (400), an unknown slug is refused (404). The rate limits were not exercised live, because that means sending real email.

**0.2 Stop double billing on plan changes (S to M, D1).** A paying Keeper who picks Breeder (or switches monthly to annual) gets a second subscription on top of the first (`stripe-checkout/index.ts:242-294`), and the webhook applies events from either subscription, so the tier flips back when the old one renews and drops to Free when it is cancelled (`stripe-webhook/index.ts:337-371`). Refuse checkout while a subscription is active or trialing and send the member to the billing portal; ignore webhook events for any subscription that is not the profile's current one. Done when a test-mode Keeper to Breeder upgrade leaves exactly one subscription.

Status 30 Sep: safeguards deployed and portal switching configured; live application verification pending. Checkout v34 requires `STRIPE_OVERAGE_ENABLED=true` before adding the monthly metered line; setting only its price no longer enables it. Webhook v37 selects the catalog membership item/line regardless of ordering and uses that item's period end. Billing portal v11 documents required switching setup. All three live function files match the repo byte for byte. With Tennyson's approval, removed the zero-usage overage item from the one live Keeper subscription without proration or a billing anchor reset. Its subscription id, Keeper monthly status, and $2.99 October 4 renewal are unchanged; the resulting real subscription.updated webhook is processed. All 915 tests and lint pass (the unrelated local `node_modules 2` copy was excluded). Database `net.http_post` checks returned the expected 400 for an unsigned webhook and 401 for unauthenticated checkout/portal calls. Both default portals now allow Keeper/Breeder monthly and annual changes, with immediate invoiced upgrade prorations and period-end cheaper-plan/shorter-interval changes. Terms, privacy, support and return links are saved. Sandbox testing reproduced the multi-item rejection, removed the metered item, upgraded Keeper to Breeder with exactly one unchanged subscription id, previewed a period-end downgrade, and confirmed a period-end annual schedule. The sandbox subscription was canceled and its customer deleted. The discounted live app test is waiting for its disposable signup email confirmation; no live test subscription has been created. Do not mark 0.2 complete until that flow confirms one subscription and the correct profile. See [portal setup and verification](../stripe-plan-switching.md).

**0.3 Keep Morph ID's model choice on the server (S).** `recognize-gecko-morph/index.ts:1092` uses the `model` sent by any caller, so any member can run the most expensive model (about five times the normal cost). Honour it only for admins and the evaluation account, then deploy. Done when a member request naming another model still runs the default.

Status 29 Sep: done (recognize-gecko-morph v62; the live files match the repo byte for byte).

**0.4 Deleting a collection keeps its geckos visible (S).** The database sets a deleted collection's geckos to no collection, and the app only shows geckos in collections you can access, so they vanish from My Geckos, Field Mode and the Dashboard (the confirm text promises they can be reassigned). Move them to the owner's default collection before deleting. Done when a deleted collection's geckos appear in the default one.

Status 30 Sep: done (migration 20260930061301). A trigger moves each gecko to its owner's default collection before the delete, making the default if needed; a gecko a collaborator added goes back to theirs. Tested in a rolled-back transaction.

**0.5 Throttle the free guide email (S).** `subscribe-and-send-guides` needs no sign-in and has only a honeypot, so a script can send the guide email to any address. Allow one send per address per day and a few per network per hour. Done when a repeat request inside a day is refused.

Status 30 Sep: done (subscribe-and-send-guides v20, table `guide_email_sends`). Tested against Resend's test inbox: a repeat inside a day is skipped and the eleventh send from one network in an hour is refused; the form links the PDFs either way.

**0.6 Check the caller on report-social-overage (S).** Anyone can trigger Stripe usage reporting for a chosen month and read back member ids (`report-social-overage/index.ts:70-84`). Require the service role or an admin.

Status 30 Sep: done (report-social-overage v17, migration 20260930052140). Only the service role, the Vault dispatch secret or an admin gets through. The monthly job sent no credentials and had been refused every month; it now sends the Vault secret.

**0.7 Deploy the three small function fixes found in the audit (S).** (a) `send-email` and `send-push` have no mapping for `waitlist_signup`, `marketplace_inquiry` or the referral notices, so a waitlist signup never reaches the breeder by email or push (only the bell); add the aliases. (b) `csp-report` stores the full blocked address, which put a member email in the error log; keep the path only, and clear the stored query strings. (c) `stripe-checkout` marks the Keeper promo used when the checkout page opens, so closing the tab loses it; the webhook already marks it on completion, so remove the early mark.

Status 30 Sep: done. (a) send-email v24 and send-push v22 route the waitlist, inquiry and referral notices. (b) csp-report v10 keeps paths only, and the 21 stored reports that held an email were scrubbed. (c) stripe-checkout v33 no longer marks the Keeper promo before checkout completes.

**0.8 Stop exposing owner emails on public rows (M).** Public geckos and all gecko photos carry `created_by`, which holds the owner's email address, and both are readable without signing in. Serve a display name instead and stop returning the email column to anonymous readers (a view or a column grant). Done when a signed-out request for a public gecko returns no email.

## 7. The plan, least finished first

**Step 1. Vet records (20%, M).** Nothing in the app creates, edits or deletes a vet record, though the passport's Vet tab and the export read them and ROADMAP item 9 lists them as built. Add a Vet section to the gecko record: date, vet or clinic, reason, findings, treatment, follow-up date and attachments, with a follow-up reminder through the existing notification jobs. First make the entity layer treat a blank `follow_up` date as empty (`supabaseEntities.js:110`), or saving a visit without one fails. Done when a visit logged on a gecko shows on its passport and its follow-up date sends a reminder.

**Step 2. Offline logging (25%, M, D2).** Offline, only the app shell loads; data calls are never cached and the sign-in check needs the network, so My Geckos falls back to the sign-in page (`appClient.js:23-27`, `public/sw.js:22-24`). ROADMAP item 7 and the service worker's comments say records work offline. Keep the last loaded collection in the browser (a persisted query cache), use the stored session when offline, and queue Field Mode and quick-log writes with a visible "waiting to sync" count. Reword ROADMAP item 7 to match. Done when Field Mode logs a feeding in airplane mode and it saves once the phone is back online.

**Step 3. Account deletion (30%, M, D16).** The Danger Zone files a support ticket and nothing else: no admin alert, and the erasure is manual. The privacy policy promises deletion within 30 days, the App Store requires in-app deletion (guideline 5.1.1(v)), and admin "Delete User" removes only the profile row. Build one admin edge function that deletes or anonymises the profile, geckos, photos (including storage), messages and the login, run it from the ticket in the Support inbox and from Delete User, and email the admin when a request arrives. Done when a disposable account is fully erased and the ticket closes itself.

**Step 4. Morph Guide photo submissions (30%, M, D3).** Members can submit morph photos and admins can approve them, but approved photos (`morph_reference_images`) are never shown anywhere public, and the approval notification sends the member to a Morph Guide page where their photo never appears. The rejection notice is titled "Submission approved" (`MorphSubmissionReview.jsx:58-63`). Show approved photos on each morph page with credit to the contributor, fix the rejection title, and have the submission form list the 33 built-in morphs instead of the database rows. Or, if D3 says retire, remove the page, its palette entry and the admin tab. Done when an approved photo appears on its morph page with the member's name.

**Step 5. Retire what will not be finished (S each, D4, D6, D7, D15).** Remove cleanly, so nothing half-built is reachable: Breeding Loans (a new loan is created as proposed and nothing ever makes it active, so it has no actions at all); Mentorship, Giveaways and Shipping (unreachable today, simulated shipping); the AI Training Center at /TrainModel (redirect to /Training; its "Analyze with LLM" sends image links the function drops, and `src/components/recognition/*` is 541 unused lines); Community Connect (orphaned, with a second forum composer); and, per D6 and D7, the sensor settings card and the Morph Visualizer (take it out of the sitemap, the prerendered navigation and its search markup). Each retirement also removes its sidebar, palette, sitemap and Membership mentions. Done when none of them can be reached or is promised anywhere.

**Step 6. Supplies store (40%, S for D5 option A).** Affiliate products work. Store-sold items and the $10 sticker and $28 tee builders add to a cart that ends at a disabled "Checkout opens soon" button, with no warning earlier (the sticker page promises "$10 each plus $5 flat shipping"), and signed-out visitors learn they must sign in only after choosing a photo. Option A: hide the cart and builders and keep affiliate links. Option B (L): fix the guest cart (it is never merged on sign-in and guest checkout would fail), fix the store webhook's log columns (its duplicate check can never match), deploy `store-checkout` and `store-stripe-webhook` with their secrets, add a receipt email, an admin order queue and a print path for stickers and tees, then run one real order. Done when nothing on /Store offers something that cannot be bought.

**Step 7. Promote (45%, D8).** No platform has posted end to end (0 connections). Facebook and Instagram need Meta's App Review; Threads, X, TikTok and YouTube only copy text, and each copy uses a post credit. Scheduled posts never publish (the job has been off since 9 September and would post to one platform only); scheduling is hidden as of today. With a member who has two Facebook Pages, publishing fails as "not connected" (`publish-social-post`, one row per Page read with `maybeSingle`). If members lack the platform secrets they see admin setup text (`ConnectionsModal.jsx:99-113`). Per D8: Bluesky plus copy-out, no credit for copies, the two-Page fix and member-facing error text (S); scheduling returns only with a working job that posts every variant (S). Done when a Bluesky post publishes from the composer and a copy uses no credit.

**Step 8. Breeding Pairs into Breeding (55%, S to M).** /BreedingPairs is an older copy of Breeding with its own hatch flow; it skips the pair limit and asks for confirmation twice when deleting. Move its dated "add egg with grade" into Breeding, then redirect /BreedingPairs to /Breeding. Done when every Breeding Pairs action exists on Breeding and the old page redirects.

**Step 9. Native apps (55%, L).** Already in code: iOS and Android projects, release scripts, the app's sign-in return address, RevenueCat's native purchases with restore, and the store-build gate. Missing: native push (APNs and FCM, a token table, a branch in the notification dispatcher), app links so passport, claim and invite links open the app (`.well-known` files plus an exception in the catch-all rewrite), a CI build, store listings, device checks of sign-in, purchase and restore, and in-app account deletion (step 3). `docs/native-shell-plan.md` still says "No code yet"; update it. Tennyson owns the store accounts; the RevenueCat and store setup checklist is in `docs/app-store-billing.md`. Done when both apps are in the stores and a purchase on one unlocks the plan everywhere.

**Step 10. Breeder pages and trust (60%, M, D9 and D10).** Nothing ever sets a breeder profile to verified, so "Verified" can never be earned; reviews can be read but never written; `accepts_inquiries` is ignored; "Feature me on the Dashboard" is reset by the database for everyone but admins, although Membership sells it with the Breeder plan; buyer inquiries have no inbox (My Listings shows only a count). Build what D9 and D10 choose, plus an Inquiries tab in My Listings. Done when a breeder can earn the badge, a verified buyer can leave a review, and the featured switch sticks.

**Step 11. Content moderation (60%, M).** Forum deletes work, and listing unpublish works as of today. There is no report queue: reports arrive in the Support inbox as plain text with record ids. Gallery photos, profiles, breeder pages and waitlists cannot be moderated, and listings, photos and profiles have no Report button. The morph comment delete always fails (no delete rule; nothing creates those comments any more). Apple guideline 1.2 and release gate 5 need report and block on all member content. Add Report buttons everywhere members publish, a Reports view that links each report to the item with Hide and Remove actions, and hide blocked members' content everywhere. Done when a reported photo can be hidden from the Reports view in two taps.

**Step 12. Settings (65%, S, D11).** These save but nothing reads them: Show Username on Images, Allow Profile Clicks, Sync with PalmStreet, the whole Calendar Alerts card, and the default sorts for My Geckos, Other Reptiles and Gallery (the breeding sort's values do not match the Hatchery's). The CGD reorder reminder can only fire from paid store orders. Location, specialties and the contact fields are hidden from visitors. "Show My Breeders Publicly" off is ignored for visitors because `read_profiles` does not return it (a privacy bug: fix in the same change). Wire or remove each switch; add the privacy field to `read_profiles`. Done when every switch in Settings changes something a member can see.

**Step 13. One feeding and shed log (65%, M, D21).** Batch Husbandry and Field Mode write a record per gecko, while reminders, the Dashboard and Project Manager read the group's "last fed" date; Mark fed on the Dashboard writes no per-gecko record, so passports and buyer packets show no feeding history. The gecko record's "+ Event, Shed" writes a general event, but the shed forecast reads shed records, so it has never had real input. Make every surface write feeding and shed records, advance group schedules from them (D21), and show feeding and shed history plus the forecast on the gecko record. Done when a feeding logged anywhere shows on the gecko, its group and its passport.

**Step 14. One gecko record (65%, M).** Owners open a record window from My Geckos that has no link to the fuller /GeckoDetail page, so the shed forecast, value estimate and health screen are hard to find. "Add weight" has no date. Drafts from Quick Add and Morph ID get no ID code. Merge the two into one record, add a date to weights, and generate ID codes for drafts. Done when every part of a gecko's history is reachable from its card in My Geckos.

**Step 15. Season Planner (70%, M, D17).** Task reminders and "future plan window opens" notices only fire while the page is open; notes are kept in one browser under a fixed key, so they do not sync and another account on the same browser sees them; a future plan cannot become a real breeding plan. Move reminders to the server (like feeding reminders), store notes in the database, add "Start this pairing". Done when a task reminder arrives with the app closed.

**Step 16. Support (70%, S to M).** Signed-in support works end to end and "we reply in-app" is true (replies go out as direct messages). Replies are not recorded on the ticket, members never see a ticket's status (except deletion requests), and content reports have no link or filter. Record replies and status on the ticket and show them to the member. Done when a member can see that their report was answered.

**Step 17. Passport and transfers (70%, M).** A passport's Weight tab is empty for every visitor, because weigh-ins have no public-passport read rule, unlike feeding, shed and vet records; weigh-ins are the only history that exists (393). A gecko switched to private shows "Passport not found", so printed labels break without warning. The claim page shows "Unknown" for private geckos. Claiming sets the status to "Owned", which is not an app status. The seller's transfer uses three browser pop-up prompts, the buyer is never emailed the link, and the Transfers tab cannot re-copy or cancel one. Parent names are dropped after a claim. Add the read rule, a proper transfer dialog with an email to the buyer, name and photo on the claim page, parent names copied on claim, and a warning before making a passport gecko private. Done when a buyer can claim a gecko from an email and see its weights on the passport.

**Step 18. Membership and billing accuracy (70%, S, D11).** After step 0.2: after checkout (`?checkout=success`) the page shows no confirmation. The page reads the raw plan column, so a member who subscribed in the app store sees Free and could buy again. The referral program attributes any existing account, so two subscribers can swap codes for free months, and the 89 grandfathered Breeder accounts are offered a Keeper month that cannot be given. Use one plan resolver everywhere (Settings, Membership, MorphMarket sync, market analytics, the upload quota), show a confirmation after checkout, limit referrals to new accounts, and apply D11 to the promise list. Done when every line on the Membership page is true.

**Step 19. MorphMarket export (75%, S).** The CSV has never been checked against MorphMarket's current importer: whether it needs an animal ID column so re-imports update instead of duplicating, which status and maturity values it accepts, the separator between image links, and the hard-coded USD. Tennyson runs a two-row test import on MorphMarket Bulk Import 2.0; then adjust the columns. Done when a test import creates two correct listings and a re-import updates them (ROADMAP item 10).

**Step 20. Forum (75%, M, D14).** Posts and comments cannot be edited; there are no photos (the column exists); view counts are never counted, so "Most Viewed" always shows 0; there is no pin or lock and no reply count; the Q&A fold lost accepted answers and votes; deleting a comment hides its replies but the count still includes them. /Forum, /Gallery, /CommunityConnect, /Marketplace and /MarketplaceBuy are in the sitemap but signed-out visitors hit a sign-in wall. Add editing, photos, reply counts, real view counts and pin or lock, and either open Forum and Gallery to signed-out readers or take them out of the sitemap. Done when a member can post a photo question and edit it.

**Step 21. Messages and notifications (75%, M).** After today's fix message and reply notifications save. Still missing: an inbox for buyer inquiries (step 10), paging on the Notifications page (it loads every row ever and updates unread rows one at a time), resubscribing when the browser rotates a push subscription (`sw.js:242-247` posts a message nothing listens for), one preferences editor (Settings and My Profile both have one), and an unsubscribe link that works signed out plus a List-Unsubscribe header on every email. Native push is step 9. Done when a new message reaches a member by bell, email and push, and they can unsubscribe from the email without signing in.

**Step 22. Admin panel (80%, S to M).** Overview counts all 135 profiles (including legacy rows) and downloads whole tables, image embeddings included, capped by the API's row limit. "Grant Expert Status" does not grant review rights (reviews need the `expert_reviewer` role, which no screen grants). The Health page shows no deploy version and does not check edge function secrets, scheduled jobs, email or push. Mass messages go to all 135 profiles with no count shown first. Count real accounts, query only what each tile needs, let admins grant the reviewer role, show the recipient count before a broadcast, and add the health checks. Done when the Overview matches the real account count.

**Step 23. Breeding plans and eggs (80%, M, D17 and D18).** Hatching works through several paths that behave differently: marking an egg Hatched in the edit dialog archives it without creating a gecko or saving a hatch date; setting an egg back to Incubating does not un-archive it; hatches are always dated today; there is no Stillbirth button; "Hatched this season" counts by the quarter the pair was created. Build one hatch path that asks for the date, creates the gecko from any screen and asks "what hatched?" for outcome logging (0 outcome logs so far); separate "delete egg" from "archive"; show an error instead of "No Active Breeding Plans" when loading fails. Apply D17 and D18. Done when every way of hatching an egg produces the same gecko, dates and outcome log.

**Step 24. Genetics for your own geckos (80%, S to M, D13).** When the calculator reads geckos from a collection, several tags from the app's own tag picker reach the genetics engine unchanged and are silently treated as normal: Soft Scale, Super Soft Scale and Het Soft Scale (the engine spells it Softscale), White Wall, a bare Phantom, any "Possible Het" tag, Tiger and Moonglow (`predictWeighted.js:101-108`, `pairingValue.js:13-15`). Those geckos compute as wild type in the plan genetics window, the Genetics tab, the Pairing Planner, pairing value and public waitlist odds. Add a translation from app tags to engine names, show "N tags not used" in the calculator, and add a test that runs every tag in the picker through the engine. Fix the Genetics Guide's White Wall and pattern-morph wording per D13 and extend `pnpm check:genetics` to the guide, glossary, project lines and visualizer data. Done when every tag in the picker produces a genotype or a visible warning.

**Step 25. AI Consultant (80%, M).** The credit is used before the AI call and never returned when the call fails; genetics and price answers come from the model's memory rather than the calculator and the value table, so they can contradict both; chats are not saved; Membership never lists the monthly message allowances. Add a refund function for failed calls, pass calculator and value-table results into the prompt, save conversations, and list allowances on Membership. Done when a failed call leaves the member's count unchanged.

**Step 26. Quality Scale (80%, M).** "Reference photos for each tier are being added over the next few weeks" and four "Reference photo coming" tiles per criterion have been live since 8 May. Tennyson supplies photos he has the rights to (his own animals) or the promise and tiles come down (an S). Done when every tier has a photo or no page promises one.

**Step 27. Lineage and collections (80%, S to M).** Parents that are private (the default since 6 September) or deleted show as "Unknown" or an empty box; after a claim the buyer's tree loses both parents (names are not stored when a parent is linked). A collection invite accepts itself on page load with no way to decline. Show parent names from the record when the parent is private, keep names when linking, and add Accept and Decline to invites. Done when a claimed gecko's tree still shows its sire and dam.

**Step 28. My Geckos and adding geckos (85%, S to M, D12).** The 10-gecko free limit is only checked when opening the full add form; Quick Add's "Add another" and CSV import skip it, and the database has no limit. Choosing "Sold" in the form does not ask for a sale price or archive the gecko. The 10 MB photo limit is checked before the photo is resized, so large phone photos are refused even though they would be shrunk (test on a real phone). The list stops at 500 geckos and search is only on what is loaded. Apply D12, open the archive dialog on Sold, move the size check after resizing, and search on the server. Done when a free account cannot reach 11 geckos by any path.

**Step 29. Morph ID (85%, S to M, D19 and D20).** The page is not in the sitemap and the landing page mentions the free identification without linking it; a "better photos needed" answer still uses the credit although the page says credits are used only when an analysis succeeds; identifications are saved only if the member asks for expert review, so real two-photo identifications can never be reviewed; the review queue loads every unverified photo (mostly scraped listings) 100 at a time and filters in the browser, so it can look empty with work left. Add the public front door (sitemap, landing and footer links), apply D19, and filter and page the review queue on the server. Done when a signed-out visitor can find Morph ID from the landing page and the review queue shows only member submissions.

**Step 30. Marketplace and Business Tools (85%, S).** Unlist sets the status to "Pet", overwriting Holdback or Proven; listings have no Report button (step 11); Business Tools lists sales stats and cost tracking under Breeder but does not gate them (D11). Delete the dead analytics code: v1 market analytics and seven section files (about 2,200 lines), `lib/marketAnalytics/queries.js` and `mockFixtures.js`, and the `rapid-api` edge function (a hello-world template with no caller). Done when Unlist leaves the status alone and the dead code is gone.

**Step 31. Field Mode, Other Reptiles, Dashboard and worksheets (85%, S).** Field Mode cannot backdate a log and "Fed" does not move the gecko's group schedule (step 13); an expired session shows a connection error instead of "Sign in". Other Reptiles stores weights as text in event notes ("Weight: 45g"), so they cannot be charted. The Dashboard shows "Add your first gecko" for up to two minutes after the first gecko is added. Worksheets print one QR code per gecko and need a passport; breeders expect a sheet of rack labels. Fix each, and add a printable label sheet. Done when a rack of 20 labels prints from one screen.

**Step 32. Sign in and onboarding (85%, S).** Sign-up never asks for a name, so members appear as "Geck Inspect member" until they add one; the role question and keeper mode are stored per browser, so a second device asks again; after "Make it yours" the role question opens on top of the add-a-gecko form; "Email not confirmed" has no resend button; the tutorial still mentions shipping and Q&A. Ask for a display name at sign-up, store onboarding state on the profile, skip the role question while an add or invite is pending, add the resend button, and update the tutorial. Done when a new member on a second phone is not asked the role question again.

**Step 33. Waitlists, Care Guide and blog (90%, S).** Waitlist buyers get no confirmation email with their place in line and the terms they agreed to, and anyone can sign up any email address (send a confirmation link). Blog posts written in the admin editor never reach the sitemap, the prerendered pages or the llms files (`scripts/seo-routes.mjs:110-116` reads only `src/data/blog-posts.js`). Blog work is shelved until Tennyson says otherwise (ROADMAP.md), so that half waits; the waitlist half does not. Done when a waitlist signup gets a confirmation (and, once the blog is back, an admin-written post appears in the sitemap).

**Step 34. Platform hygiene (S each).**
- The nightly error-triage job pushes `error-triage/*` branches and draft pull requests (preview deploys CLAUDE.md wants to avoid) and commits its state file to main most nights, and each commit triggers a production deploy. Keep its state outside main, or skip deploys for docs-only commits.
- The weekly seo-audit workflow runs on Node 20, but supabase-js needs Node 22 (the same mismatch broke error-triage).
- IndexNow only runs when the sitemap is committed; drive it from the deployed sitemap.
- `admin-end-trial` is deployed with no source in the repo and no caller: commit its source or delete it.
- The admin Pages tool treats "hidden from the sidebar" and "disabled" as one switch; split them (today's fix exempts Field Mode, Gallery and Training). Gallery, Liked Geckos, AI Consultant, Community Connect, Morph Visualizer and Promote are still blocked for signed-in members; decide each in step 5 and D8.
- Section membership in the navigation is uneven (Image Import and Printable Worksheets under Discover, Liked Geckos under Manage); settle it with the navigation test.
- Only one error boundary wraps the whole app, so a crash in any page replaces the shell; add one per page.
- Content Security Policy enforcement (launch review F43): after 0.7(b) and one real web purchase and billing-portal visit under report-only, switch the header to enforcing in `scripts/build-vercel-json.mjs`.
- Delete remaining dead code: `my-geckos/ProfileSettings.jsx`, `my-geckos/ShareProfile.jsx`, `lineage/GeckoIdGuide.jsx`, `breeding/EggCard.jsx`, `public/font-preview.html`.

## 8. Checks that need a real phone or real money (Tennyson)

The sandbox cannot reach the live API, so these can only be confirmed by hand. They are the last gate for the features they touch, and several match docs/RELEASE_READINESS.md.

1. On an iPhone: add a gecko with a HEIC photo straight from the camera roll, and run Morph ID with a top and a side photo.
2. Send a direct message and a forum reply between two accounts and confirm the bell, the email and the push notification (these never worked before today's fix).
3. Stripe test mode: subscribe, upgrade Keeper to Breeder after 0.2, cancel, and confirm one subscription at each point.
4. A waitlist end to end on a phone, with the terms and the breeder's email (after 0.7(a)).
5. Claim a transfer as a brand-new account and confirm it returns to the claim page after the confirmation email.
6. Invite a real second account to a collection and watch the activity feed.
7. One Govee sensor, if D6 keeps sensors.
8. The two-row MorphMarket test import (step 19).
9. Delete a disposable account end to end (step 3).
10. After the MorphMarket feed is back on: save a watch on /Market, wait for a matching listing, and confirm the bell, the email and the push. Switch on the morning brief and confirm it arrives on a morning with news.

## 9. The finish line

The app is finished when every row in section 4 is either Complete or retired (removed from navigation, the sitemap, Membership and the landing page), every item in Phase 0 is done, every check in section 8 has passed, and no known bug is left open at high severity. Adding up the sizes: Phase 0 is about three days, and steps 1 to 34 come to roughly 60 working days of focused work with the recommended decisions (the native apps alone are about two weeks), less if more features are retired or reworded instead of built. Claude sessions can do most of the coding; the decisions in section 5 and the checks in section 8 are what set the pace.

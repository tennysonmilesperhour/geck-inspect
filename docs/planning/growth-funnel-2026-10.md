# Growth and revenue funnel diagnosis, October 2026

Written 5 October 2026 from read-only queries against production (Supabase project `mmuglfphhwlaluyfyxsp`) plus a read of the app's analytics code. Everything here is aggregate. No member emails or names appear, and the three subscribers are called Member 1, 2 and 3 in the order they subscribed.

## 1. Summary in plain words

Geck Inspect has a traffic problem that is smaller than it looks and a "second visit" problem that is bigger than it looks.

- **People find the site.** About 2,000 signed-out browsing sessions in the last 30 days, mostly on the Morph Guide, Care Guide, calculator and existing article pages. Some of that is crawlers, so treat it as an upper bound.
- **Few sign up, and only from two pages.** 20 accounts in 30 days. Almost every signup started on the landing page or the `/pedigree-tracker` page. The content pages that bring most of the traffic produced about one signup.
- **About a third add a gecko, all in the first few minutes.** 7 of 22 accounts created since 1 September added a gecko, every one of them within a day (median about 2 minutes after signup). Nobody who skipped it on day one came back later to do it.
- **Nobody comes back.** Of the 17 September signups old enough to measure, **0 returned 7 or more days after signing up**. Only 2 of 22 returned on any later day. No new member has logged a second weigh-in.
- **Revenue is close to zero and at risk.** Lifetime cash collected is $11.97. Of the "3 paying members", one was on a 100% off coupon and cancelled the same day, one scheduled a cancellation 45 minutes after paying (Stripe reason "unused", right after a Morph ID attempt failed), and one has paid twice but has never added a gecko and has not opened the app since 7 September. Real monthly recurring revenue is $8.98 today and heading to $2.99 on 1 November.
- **The one account that uses the app like a breeder is the admin account.** It holds 37% of all geckos, 74% of weigh-ins, 92% of eggs, 59% of breeding plans and 60% of signed-in analytics events. Every dashboard number that does not exclude it is mostly measuring Tennyson.

The fix is not more features. It is getting a new keeper from "signed up" to "my geckos are in here and the app pings me when something is due", inside the first session, and then making the second visit happen on purpose.

## 2. What data exists and what it can tell us

| Source | What it holds | Usable for |
|---|---|---|
| `auth.users` (56 rows) | Signup time, last sign-in | Signups by week. `last_sign_in_at` does not move on silent session refresh, so it undercounts returning members. |
| `public.user_events` (9,440 rows, 18 Apr to today) | First-party page views and product events from `captureEvent` and `PostHogPageTracker` | Return visits, page usage, the checkout funnel. The best behavioral source we have. |
| `geck_data.user_events` (567 rows) | Old page views from the geck-inspect source | Nothing current: the geck-inspect source stopped writing on 3 September. |
| `public.user_activity` (225 rows) | Gamification points | Not useful for the funnel. |
| `geck_data.model_invocations` (831 rows) | Every Morph ID model call, tier, cost, errors | Morph ID usage and cost. 818 of the rows are the internal evaluation runs, not members. |
| `morph_id_usage`, `feature_usage` | Monthly AI credit ledgers | Free limit hits. |
| `stripe_webhook_logs` (29 rows) | Raw Stripe events | The true payment history. |
| `payment_events` (2 rows) | Meant to be the clean payment ledger | Incomplete (see section 10). |
| `revenuecat_*` | App store purchases | 2 TEST receipts only. No real app store revenue. |
| Referral, waitlist, store, market, price game tables | Feature usage | Almost all empty (section 5). |

**PostHog is not reachable from here.** There is no PostHog connector in this session, and the Vercel connector failed to connect, so it is not possible to check whether `VITE_POSTHOG_KEY` is set in production. The admin System Health page reports whether it is. Every `captureEvent` call is mirrored into `public.user_events` whether or not PostHog is on, so the analysis below does not depend on it. Google Analytics (`src/lib/ga.js`) also runs, and the error log shows the Content Security Policy blocking `www.google.com/g/collect` 4 times in 30 days, so GA may be losing some hits.

**Events the app sends today** (from a search of `src/`): `page_view`, `login_completed`, `landing_cta_clicked`, `guest_mode_entered`, `guest_tour`, `onboarding_role_selected`, `animal_created`, `animal_updated`, `gecko_added`, `gecko_updated`, `first_gecko_added`, `roster_exported`, `membership_viewed`, `plan_selected`, `checkout_started`, `checkout_returned`, `checkout_cancelled`, `checkout_completed`, `billing_portal_opened`, `upgrade_prompt_shown`, `upgrade_prompt_clicked`, `morph_id_gecko_prefilled`, `morph_id_add_to_collection_clicked`, `morph_id_analysis_failed`, `market_view`, `market_today_click`, `price_game_guess`, `price_game_complete`, `price_game_share`, store events (`store_pdp_viewed`, `store_add_to_cart`, `store_checkout_started`, `store_purchase_completed_view`, `store_affiliate_click`, `store_signup_grant_redeemed`), `giveaway_created`, custom sticker and tee uploads. GA separately gets `signup_completed`, `page_view`, `gecko_added` and `click_cta`.

**Not measured at all:** where a visitor came from (no referrer or UTM is stored first-party), signup itself as a first-party event, a successful Morph ID result, weigh-ins, feedings, eggs, breeding plans, lineage views as an action, email opens or clicks, push delivery, and cancellations.

## 3. Signups by week

Weeks start Monday. Accounts before September came over from the old platform or joined during the quiet period; the public launch was the first week of September.

| Week of | New accounts | Notes |
|---|---|---|
| 6 Apr | 1 | |
| 13 Apr | 11 | Migration from the old platform |
| 20 Apr | 2 | |
| 27 Apr | 0 | |
| 4 May | 2 | |
| 11 May | 1 | |
| 18 May | 1 | |
| 25 May | 1 | |
| 1 Jun | 2 | |
| 8 Jun to 13 Jul | 0 | Six weeks with no signups |
| 20 Jul | 2 | |
| 27 Jul | 1 | |
| 3 Aug | 0 | |
| 10 Aug | 2 | |
| 17 Aug | 6 | |
| 24 Aug | 2 | |
| 31 Aug | 2 | Launch week |
| 7 Sep | 6 | |
| 14 Sep | 2 | |
| 21 Sep | 6 | |
| 28 Sep | 6 | |
| 5 Oct | 0 so far | Monday |

Since 1 September: 22 accounts, roughly 5 a week and flat. Signed-out sessions grew over the same period (about 340 a week in early September, 695 in the week of 28 September), so traffic is rising but the signup rate is not.

## 4. Activation and return

Cohort B is everyone who created an account on or after 1 September (22). Cohort A is everyone before (34, including the admin account).

| Step | Cohort B (since 1 Sep) | Cohort A (before 1 Sep) |
|---|---|---|
| Accounts | 22 | 34 |
| Added at least one gecko | 7 (32%) | 8 (24%) |
| Time to first gecko | All 7 within day one, median about 2 minutes | Median about 15 minutes |
| Added 3 or more geckos | 2 (9%) | 5 (15%) |
| Added 10 or more | 0 | 2 |
| Logged any weight | 6 (27%), all at the moment the gecko was added | 5 |
| Logged a second weigh-in on a later day | **0** | 4 (one is admin) |
| Logged any feeding | 0 (the feeding table is empty for everyone) | 0 |
| Created a breeding plan | 1 | 4 |
| Came back on any later day (24h or more after signup) | 2 of 22 | 13 of 34 |
| Came back 7 or more days later | **0 of 17 eligible** | 9 of 34 |
| Came back 30 or more days later | 0 of 2 eligible | 5 of 34 |
| Never produced a single tracked event | 4 | 7 |

Only **2 non-admin members** have been active on 3 or more separate days since 1 September.

**Where the non-activated go.** The 15 September signups who never added a gecko averaged under 5 page views in total. 11 of them opened My Geckos, saw the empty collection and left. The next most visited pages were Home, Morph ID (Recognition) and the Dashboard.

**What activated members do next.** 4 of the 5 activated September members with tracked sessions opened Lineage, which is the most visited page after My Geckos for this group. Quality Scale, Pedigree and Morph ID follow.

**Onboarding question.** 15 members answered "keeper or breeder": 10 breeder, 5 keeper. 4 of 10 breeders added a gecko and 2 subscribed; 1 of 5 keepers added a gecko and none subscribed.

**Guest mode.** The landing hero's "try it as a guest" button is clicked 4 times as often as the signup button (36 to 9). Guests look around (4.8 pages per session) but only 3 of 36 guest sessions became signed-in sessions.

## 5. Which features are used and which are not

Counts are distinct members who ever created a row. "With login" excludes legacy rows whose owner has no account.

| Feature | Members (with login) | Last 30 days | Comment |
|---|---|---|---|
| Geckos | 35 (15) | 18 geckos by 7 members | The only thing new members do |
| Weigh-ins | 14 (11) | 14 by 7, none of them repeat weigh-ins by new members | Habit exists only for admin and 3 legacy breeders |
| Breeding plans | 9 (5) | 1 | Admin made 16 of 27 |
| Eggs | 5 (3) | 1 | Admin made 150 of 163 |
| Member photos | 8 (3) | 1 | |
| Lineage placeholders | 2 | 12 by 1 member | Lineage is viewed far more than it is edited |
| Collection valuations | 4 | 4 by 2 | |
| Morph ID | 8 members ever | 3 members in October | Section 7 |
| Direct messages | 3 | 0 since 21 Apr | |
| Forum | 2 | 0 since 13 Apr | |
| Feeding records, shed records, vet records | 0 | 0 | Never used |
| Market brief opt-in | 0 | 0 | Shipped 30 Sep |
| Guess the Price guesses | 0 | 0 | 5 rounds exist, no guesses stored |
| Watchlists, price alerts | 0 | 0 | |
| Referrals | 0 referred signups | 0 | Every profile has a code; nobody has used one |
| Collaborator invites | 0 sent to anyone else | 0 | The 35 collection_members rows are owners |
| Waitlists | 0 | 0 | |
| Store | 4 carts, 0 orders, 2 affiliate clicks | | Checkout is off |
| Push subscriptions | 1 | | |

**Notifications are being sent but not read.** In the last 30 days: 161 weekly digests to 35 members (4 read, about 2.5%), 31 weigh-in reminders to 8 members (4 read). Most digest recipients have zero geckos, so the digest has nothing personal to say. Each notification also triggers an email through `send-email`, but there is no open or click tracking, so email engagement is unknown.

## 6. The three paying members

| | Member 1 | Member 2 | Member 3 |
|---|---|---|---|
| Account created | 21 Apr (legacy) | 30 Sep | 1 Oct |
| Plan | Keeper monthly, $2.99 | Keeper, then Breeder, 100% off coupon | Breeder monthly, $5.99 |
| Time from (re)visit to paying | About 2 minutes after signing in on 4 Sep, launch day | 3 minutes after signup went to Membership; subscribed about 2 hours later | 18 minutes after signup |
| What they did first | Nothing: went straight to Membership | Nothing: went straight to Membership | Answered "breeder", added 2 geckos, looked at Morph Guide, Quality Scale, Breeding, then Membership |
| Geckos | 0 | 0 | 2 |
| After paying | Used 3 Morph ID credits on 5 Sep, last seen 7 Sep. Renewed $2.99 on 4 Oct | Upgraded to Breeder inside the coupon, cancelled the same evening | Used all 6 Morph ID credits, one attempt failed, cancelled 27 minutes later with Stripe reason **"unused"**. Access runs to about 1 Nov |
| Cash collected | $5.98 | $0 | $5.99 |

What this says:

- **Nobody paid because the app had become part of their routine.** Two bought within minutes of arriving, before using anything. That looks like supporters or people testing the product, not converted keepers.
- **The only real "evaluate, then pay" member left over Morph ID.** Member 3 paid for Breeder, ran through all 6 monthly Morph IDs in about 20 minutes, hit a failed analysis, and cancelled. Morph ID is the thing that sold the plan and the thing that lost it.
- **Member 1's free trial ended 28 minutes after it started.** Stripe shows a 7-day trial created at 18:36 on 4 Sep and ended at 19:04 with an immediate $2.99 charge. The analytics show repeated `checkout_started` clicks in that window, so a second checkout appears to end the trial. Worth checking in `stripe-checkout` and `admin-end-trial`, because charging someone on day one of a promised trial is a trust and chargeback risk.
- **Member 1 is a churn risk.** Paying, zero geckos, no visits in four weeks.

## 7. Free limits and Morph ID

- **Gecko cap (10 on Free):** nobody is near it. The largest free collection has 7 geckos. `upgrade_prompt_shown` has fired once, ever. The cap is not a conversion lever at this size of collection.
- **Morph ID:** every member who has ever used it hit their limit (8 of 8). All 6 free users spent their single lifetime identification on signup day; none of them paid. Production Morph ID calls cost about $0.46 in total, so the free allowance is cheap to widen. The evaluation runs cost $20.98 in September.
- **Credits on failure:** Member 3's ledger shows 6 credits consumed against 5 logged successful calls and one failure, which suggests a failed analysis still burns a credit. The feature audit already lists "no refund when the AI call fails" for the AI Consultant; the same looks true here.
- **Health screen:** used once (August).

## 8. Where signups come from

There is no first-party referrer, UTM or invite tracking, so this is inferred from the first page of the browser session in which the account was created (33 accounts since 1 August):

| Landing page of the signup session | Signups | Signed-out sessions landing there since 1 Sep | Rough conversion |
|---|---|---|---|
| Home (landing page) | 19 | 306 | about 6% |
| `/pedigree-tracker` | 4 | 15 | about 27% |
| My Geckos (already had a session) | 3 | | |
| Morph Guide | 1 | 539 | under 0.2% |
| Membership, Recognition | 1 each | | |
| No matching session (opened from email link in another tab) | 4 | | |

Not a single signup came through a referral code, a collaborator invite, a waitlist, a store signup grant or the newsletter (2 subscribers). Passports: 5 geckos have passport codes and 2 transfers exist, so passports are not yet a channel.

**The content pages bring traffic and lose it.** Since 1 September: existing article pages 561 landing sessions (94% leave after one page), Morph Guide 539 (78%), Care Guide 260 (88%), calculator 151 (85%). These pages answer the visitor's question and offer no reason to sign up.

## 9. Churned and inactive patterns

- **Day-one-only accounts are the norm.** 20 of 22 September signups never returned on a later day.
- **Activation does not predict return yet.** Even the 7 September members who added geckos have not returned 7 days later. The app gives them nothing to come back for: no weigh-in is due, no reminder is scheduled from their own data, and the digest is generic.
- **Legacy members drifted off.** 9 of the 34 pre-September accounts returned after a week at some point, 2 are active in the last 14 days. DMs and the forum, which carried the old community, have been silent since April.
- **Zero-gecko accounts receive the most notifications.** The weekly digest goes to 35 members, most of whom have nothing in their collection.

## 10. Data quality issues

1. **The admin account dominates every metric** (see section 1). Exclude `role = 'admin'` from every analytics view, including the admin Product Analytics tab.
2. **140 profiles for 56 logins.** 89 legacy profiles are marked `breeder` / `grandfathered`; 5 of those have a login (including admin). Counting profiles overstates the member base by 2.5 times.
3. **`payment_events` misses most payments.** It has 2 rows; Stripe sent 6 paid invoices. The 1 Oct $5.99 Breeder invoice is stored with tier `free`.
4. **Pending cancellations are invisible.** Member 3's profile still reads Breeder / active with no sign that the subscription ends on about 1 Nov. Nobody is told when a member cancels.
5. **Trial ended early** for Member 1 (section 6).
6. **Gecko events undercount.** 7 September members added geckos, but only 4 produced `gecko_added` or `animal_created`. Some add paths (CSV import, Morph ID "add to collection", hatching an egg) do not send the same event.
7. **Onboarding answers are not on the profile.** 15 members answered the keeper or breeder question; only 1 profile has `onboarding_role` set and 4 have `onboarding_completed_at`. Most answers predate the profile columns and live only in a browser.
8. **Morph ID ledger and call log disagree.** A Keeper member consumed 3 credits in September with no matching Keeper calls in `model_invocations`; a Breeder member consumed 6 against 5 logged calls.
9. **Records are keyed by email text** (`created_by` on geckos, weights, plans, events), not by user id. An email change orphans a member's history and makes joins fragile.
10. **`geck_data.user_events` stopped** receiving geck-inspect page views on 3 September; the `public` table is the live one. Two tables with the same name invite wrong dashboards.
11. **Signed-out sessions include crawlers.** Sessions are per browser tab, and one-page sessions on content pages are inflated by bots that run JavaScript. Use signed-out numbers as direction, not as exact counts.
12. **Analytics identifies people by email.** `identifyUser` sends the email as the PostHog id and `user_events` stores it in clear text. Fine for a first-party table, but a hashed id would be safer for third parties.

## 11. The three biggest leaks

1. **Signup to first gecko (68% lost, all on day one).** 15 of 22 new members never add a gecko. 11 of them stood on an empty My Geckos page and left. Whoever adds a gecko does it in the first few minutes; nobody comes back later to do it. The first session is the whole game.
2. **First session to second visit (100% lost so far).** 0 of 17 eligible September members came back after a week, including those who added geckos. There is no lifecycle email, no reminder seeded from the member's own data, and the generic weekly digest is read 2.5% of the time. Weigh-ins are only captured at the moment a gecko is added; nobody has logged a second one.
3. **Visitor to signup on content pages (about 0.2%).** The Morph Guide, Care Guide, calculator and existing article pages carry most of the traffic and send almost no one into the app, while `/pedigree-tracker` converts about 27% of a small number of visits. A close fourth is **paid to kept**: the only evaluated purchase cancelled within the hour after Morph ID failed.

## 12. The likely aha moment

For a crested gecko keeper the evidence points to: **"My geckos are in, I can see who their parents are, and the app knows what each one needs next."**

- The highest-converting page is the pedigree tracker page, and Lineage is the first place activated members go.
- The members who stuck around for months (admin and three legacy breeders) are the ones whose weigh-ins, eggs and hatch alerts kept them coming back: 91% of hatch alerts were read (406 sent, almost all to the admin collection), against 2.5% for the digest. Personal, time-based prompts work; generic ones do not.
- Morph ID is the hook that brings people in and gets them to pay, but on its own it is a one-off. It works best as the fastest way to get a gecko into the collection (photo in, Lilly White or Harlequin Pinstripe identified, gecko pre-filled), not as a separate destination.

Proposed working definition to test: **a member who, within 24 hours of signing up, has 3 or more geckos with at least one parent link or one weight recorded.** Then check whether that group returns at a higher rate than the rest once there are 4 to 6 more weeks of signups.

## 13. North-star metric

**Weekly active keepers: members (excluding admin) who logged at least one care or breeding record for one of their own geckos in the last 7 days.** A record is a weigh-in, feeding, shed, egg, pairing, or a new gecko after the first day.

Why this one: it counts real use of the collection (the thing breeders pay for), it rises only if both activation and return improve, it is hard to inflate with page views, and every input is already in the database. Today it is about 1 non-admin member. Supporting numbers to watch weekly: signups, percent adding a first gecko on day one, percent with a second-day visit, Morph ID results that become geckos, and paid members with at least one record in the last 14 days.

## 14. Ten highest-impact changes, ranked

1. **Replace the empty My Geckos page with a guided first gecko (onboarding, M).** One screen: "Add your first gecko" with two big options: snap a photo (Morph ID pre-fills the morph, sex guess and name) or type a name. Then immediately ask "Do you know its sire and dam?" and show the lineage card. Then "Add 2 more" with the CSV and MorphMarket import for breeders. This targets leak 1 and the aha moment directly. Measure: percent of signups adding a gecko on day one (32% today).

2. **A short lifecycle email sequence (lifecycle email, M, needs Tennyson's approval of copy).** Day 0: welcome with one action. Day 1, if no gecko: "Add your first gecko in 60 seconds" with a Morph ID link. Day 3, if geckos: "See your collection's lineage". Day 7 and 14: "Time to weigh [gecko name]". Use the existing `send-email` function and unsubscribe handling. Stop sending the generic weekly digest to members with zero geckos. Targets leak 2.

3. **Seed the second visit from the member's own data (product, S to M).** When a gecko is added with a weight, schedule a personal weigh-in reminder 14 days later (crested gecko juveniles should be weighed every 2 to 4 weeks). When a female is marked gravid, schedule the egg-drop and hatch windows. These are the alerts that already work for the admin's collection. Make the reminder link open a one-tap weigh-in for that gecko.

4. **Fix Morph ID's paid experience before anything else in billing (product and pricing, S).** Refund the credit when an analysis fails; show "this one didn't work, it did not use a credit". Raise Breeder's monthly allowance or add a small top-up pack so a breeder identifying a clutch of hatchlings does not run out in 20 minutes. Tennyson should personally email Member 3 before 1 Nov: they cancelled with "unused" right after a failure.

5. **Give content-page visitors a reason to sign up (marketing surface, S).** On every Morph Guide, Care Guide and calculator page, add one contextual call to action that leads into the tracker, for example on a Lilly White morph page: "Keep track of your Lilly White's lineage and weights, free", and on the calculator: "Save this pairing to your collection". Point it at a page shaped like `/pedigree-tracker`, which converts about 27%. No new articles needed; this is about the pages already getting traffic.

6. **Instrument the funnel properly (analytics, S).** Store first-touch referrer, landing page and UTM tags in the browser and copy them to the profile at signup; add a first-party `signup_completed`; send one `gecko_added` event from every add path; add `weight_logged`, `egg_logged`, `plan_created`, `morph_id_succeeded`, `lineage_viewed`; record `subscription_cancelled` with the Stripe reason; exclude admin in the Product Analytics tab; and fix `payment_events` so it records every invoice with the right tier. Without this, the next diagnosis will be as hand-built as this one.

7. **Fix the trial and move it to the right moment (pricing, S to M).** Find why Member 1's 7-day trial ended after 28 minutes and stop a second checkout from ending a trial. Then offer the Breeder trial when a member reaches the aha moment (3 or more geckos with a parent link, or first egg logged) instead of on the Membership page before they have used anything.

8. **Concierge onboarding for breeders (operations, S, Tennyson's time).** Of 10 members who said "breeder", 4 added a gecko. For each new breeder signup, offer "send me your spreadsheet or MorphMarket store link and I will import your collection". Breeders with 20 to 100 geckos will not type them in one by one, and a full collection is what makes reminders, lineage and valuations useful. The same offer works as a win-back email to the 15 September members who never added a gecko and the legacy accounts that went quiet.

9. **Make guest mode end in a saved collection (onboarding, S).** Guests click "try it" 4 times as often as "sign up", but only 3 of 36 guest sessions turned into accounts. Let a guest add one gecko in demo mode and offer "Create a free account to keep [gecko name]", carrying the gecko across.

10. **Change what Free limits (pricing, M, decision for Tennyson).** The 10-gecko cap has fired once. Paywalls work when they appear at a moment of value. Better candidates: more than one Morph ID per month (Free gets 1 lifetime today), multi-generation pedigree export and certificates, breeding season planning with egg and hatch reminders, and sale and valuation history. Keep the core collection free so the habit can form first. Add a small annual option once anyone has stayed 2 months.

## 15. Open questions for Tennyson

- Are Members 1 and 2 people you know (supporters or a test account)? If so, real organic paid conversion so far is one member, and the paid funnel should be judged on what happens after the fixes above.
- Is `VITE_POSTHOG_KEY` set in production Vercel? If yes, PostHog autocapture may hold referrer data for the last month that the database does not.
- Which lifecycle emails are you comfortable sending, and from which address?

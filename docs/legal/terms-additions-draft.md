# Terms of Service additions: DRAFT, not published

**Status: draft for Tennyson and, ideally, a lawyer. Nothing here is live.** The published Terms are `src/pages/Terms.jsx` (last updated 8 September 2026), and this draft does not change them. This is not legal advice; it is a plain description of how the app behaves today, turned into Terms wording, with every policy choice marked for a decision.

Written 15 October 2026 for plan item E2 22 of `docs/planning/comprehensive-review-2026-10-14.md` (and gaps C15 items 1 and 9: the Terms say nothing about subscriptions, renewals, trials, refunds, lifetime plans, AI output or value estimates).

How to read it:

- **[DECISION n]** marks a choice only Tennyson can make. Each has the options and, where the review gives one, a recommendation. The full list is in section 0.
- Every statement about behaviour cites the code it comes from, so the wording can be rechecked if the code changes. If the code changes, these sections must change with it.
- When the decisions are made, the sections go into `src/pages/Terms.jsx` as new numbered sections (after "Marketplace and transactions"), `LAST_UPDATED` moves to the publish date, and members are told about the change (the existing section 7 promises reasonable notice of changes).

## 0. Decisions needed before publishing

| # | Decision | Options | Recommendation from the reviews |
|---|---|---|---|
| 1 | The operator's legal name and state | Sole proprietor name, or a single-member LLC; the US state | Form the LLC first (E2 item 22), then name it and its state in the opening paragraph and in governing law (today the Terms say "the State in which Geck Inspect is operated", which names no state) |
| 2 | Refund policy for subscriptions | (a) no refunds except where the law requires; (b) a refund on request within 14 days of the first payment; (c) a 30-day money-back guarantee on a first purchase | (c), from the adversarial review's pricing advice; at today's volumes it costs little and removes a reason to hesitate |
| 3 | Refund policy for lifetime plans | Same as 2, or a separate window (for example 30 days), or none | A 30-day window, the same as 2(c), so the rule is one sentence |
| 4 | When a cancellation takes effect | (a) at the end of the paid period (access continues until then); (b) immediately, with or without a prorated refund | (a). This is a Stripe customer portal setting (`supabase/functions/stripe-billing-portal/index.ts` header); check the dashboard matches the choice |
| 5 | What a lifetime plan means if Geck Inspect closes or stops offering the plan | (a) no refund, with a notice period and a data export; (b) a prorated refund for closures within the first N years; (c) both a notice period and a prorated refund | At least (a) with 90 days' notice and an export. Decide (b) knowing it is a real liability on each lifetime sale |
| 6 | Notice before a subscription price change | 30 days by email, or "before your next renewal" | 30 days by email |
| 7 | Trial reminder | Send an email a few days before a trial converts to paid, or rely on the checkout disclosure | Send one. Several US states expect it for automatic renewal. Stripe can send it (Billing settings), or the app can, since Stripe already notifies the webhook three days before a trial ends |
| 8 | Sales tax and VAT | Turn on Stripe Tax and show prices "plus tax where applicable", or keep tax-inclusive prices and absorb it | A one-hour conversation with an accountant; Stripe Tax is not turned on in checkout today |
| 9 | Buyers in the EU and UK | Ask for consent at checkout to start immediately (which ends the 14-day withdrawal right for digital services once used), or honour 14 days for everyone | Honouring 14 days for everyone is simplest and is covered if decision 2 is (b) or (c) |
| 10 | Whether lifetime plans stay on sale | Keep, pause, or limit to a number of seats | The adversarial review recommended deleting the lifetime rows; Part E says no price changes before five breeders have answered the Founding Breeder offer. Whatever is chosen, the Terms below must match |
| 11 | The Price Index licence | Keep CC BY 4.0 for the numbers, or narrow it | Wait for the hour of counsel on the scraped-data position (E2 item 22) before publishing any licence wording |

## 1. Plans and payment (new section)

> **Plans and payment.** Geck Inspect offers a free plan and paid plans (currently Keeper and Breeder). The features and limits of each plan, and their prices, are shown on the Membership page. Prices are in US dollars. [DECISION 8: "Prices do not include sales tax or VAT, which is added at checkout where it applies." or "Prices include any tax we are required to collect."]
>
> Payments made on our website are processed by Stripe. We do not see or store your full card number. Purchases made inside our iPhone or Android app are made through the App Store or Google Play, and that store's terms govern billing, renewal, cancellation and refunds for those purchases. A plan bought in one place gives the same access in the other, but it must be cancelled or refunded where it was bought.
>
> We may offer promotional codes, trials and complimentary plans. Each has the terms shown when it is offered, and none can be exchanged for cash.

Behaviour this describes:

- Prices and plan names: `TIER_PRICING` in `src/lib/stripe-config.js`. Enterprise is off sale (`ENTERPRISE_ON_SALE = false`), so it is not named.
- Stripe Checkout accepts promotion codes (`allow_promotion_codes` in `supabase/functions/stripe-checkout/index.ts`).
- Store purchases: RevenueCat and StoreKit; the website billing button is hidden inside the app (`docs/BILLING.md`, `docs/RELEASE_READINESS.md`).
- Complimentary plans: `membership_comps`.

## 2. Subscriptions and automatic renewal (new section)

> **Subscriptions renew automatically.** A monthly or yearly plan is billed when you subscribe and then again at the start of each new month or year, at the price then in effect, until you cancel. By subscribing you authorise us, through Stripe, to charge your payment method on each renewal date.
>
> **If a payment fails,** we and Stripe will retry it for a period, and your plan stays active while we do. If the payment still cannot be collected, the plan ends and your account returns to the free plan.
>
> **Price changes.** If we change the price of a plan you subscribe to, we will tell you by email at least [DECISION 6: 30 days] before the new price applies to you, and you can cancel before then.

Behaviour this describes:

- A purchase without a trial is billed the same day: the price captions say "Billed monthly, starting today" (`src/lib/stripe-config.js`), and Checkout adds no trial unless one was asked for (`stripe-checkout`, lines 416 to 444).
- During payment retries (`past_due`) the plan keeps access; `canceled`, `unpaid` and `incomplete_expired` end it and set the profile to Free (`GRANTS_ACCESS` and `ENDS_ACCESS` in `supabase/functions/stripe-webhook/index.ts`).
- Auto-renewal disclosure at the point of purchase: the Membership page captions say "Cancel anytime". [DECISION 7 and the checkout wording: several US states require the renewal terms to be stated clearly next to the buy button and confirmed afterwards by email. Stripe's receipt is the confirmation today; check that it states the renewal terms.]

## 3. Free trials (new section)

> **Free trials.** Some paid plans can be started with a free trial, which you choose with its own button. Each account can use one standard trial ([7] days) and, where offered, one Keeper introductory trial ([30] days). You enter a payment method when the trial starts. Unless you cancel before the trial ends, the plan continues as a paid subscription and you are charged on the day the trial ends, and then on each renewal date. [DECISION 7: "We will email you a reminder [3] days before your trial ends."] If you cancel during the trial, you are not charged.

Behaviour this describes:

- Trials are opt-in: `intent = 'trial'` gives `TRIAL_DAYS` (7); `intent = 'keeper_trial'` gives `KEEPER_PROMO_TRIAL_DAYS` (30) on Keeper only; any other purchase has no trial (`src/lib/stripe-config.js`, `stripe-checkout` lines 28 to 38 and 416 to 444).
- One of each per account: `free_trial_used` and `keeper_trial_used` on the profile, set by the webhook when the checkout completes, so closing the checkout tab does not use up a trial.
- Card at the start: Stripe Checkout in subscription mode collects a payment method by default; the code does not change that.
- No reminder is sent by the app today. The webhook receives `customer.subscription.trial_will_end` (about three days before) and only refreshes the plan (the `customer.subscription.trial_will_end` case in `stripe-webhook`).
- A trial that ends without a successful payment moves the subscription to `incomplete_expired` or `unpaid`, which ends access.

## 4. Changing or cancelling a plan (new section)

> **Changing plans.** You can switch between monthly and yearly billing, or between Keeper and Breeder, from the Membership page, which opens Stripe's billing portal. [DECISION, Stripe portal setting: "Upgrades take effect immediately and you are charged the prorated difference. Downgrades take effect at your next renewal."] A plan bought through the App Store or Google Play is changed in that store.
>
> **Cancelling.** You can cancel a website subscription at any time from the Membership page. [DECISION 4(a): "Your plan stays active until the end of the period you have paid for, and is not renewed after that." or 4(b): "Cancellation takes effect immediately."] Cancelling does not refund the current period except as described under Refunds.
>
> **What happens when a paid plan ends.** Your account returns to the free plan. You keep every gecko and record you already have and can still view and edit them. If you have more active geckos than the free plan allows, you cannot add new ones until you are under the limit (archiving a gecko frees a place). Features that the free plan does not include, and monthly allowances such as Morph ID, stop at the end of the plan.
>
> **Deleting your account** cancels a website subscription immediately, before anything is deleted. It does not cancel a subscription bought through the App Store or Google Play; cancel that in the store.

Behaviour this describes:

- Plan changes go through the portal; Checkout refuses a second subscription (409 `already_subscribed`) and sends the member to the portal (`stripe-checkout` lines 40 to 43; `stripe-billing-portal`).
- Proration and the timing of a cancellation are portal settings in the Stripe dashboard, not code. They were not checked for this draft.
- Downgrade keeps existing geckos (decision D12, `src/lib/geckoLimit.js`; enforced by the `geckos_enforce_free_limit` trigger for new adds, unarchiving and claimed transfers).
- Account deletion cancels the Stripe subscription with an immediate cancel (`DELETE /v1/subscriptions/{id}` in `supabase/functions/delete-my-account/index.ts`) and stops if that fails. The current Terms section 8 already says the store subscription is not cancelled.

## 5. Refunds (new section)

> **Refunds.** [DECISION 2 and 3. One of:]
>
> (a) *Payments are non-refundable, except where the law requires a refund.*
>
> (b) *If you ask within 14 days of your first payment for a plan, we will refund it in full.*
>
> (c) *If Geck Inspect is not for you, email us within 30 days of your first payment for a plan (monthly, yearly or lifetime) and we will refund it in full. After that, payments are non-refundable except where the law requires.*
>
> To ask for a refund, email [support address] from the address on your account. Refunds go back to the original payment method. When a payment is refunded in full, or is disputed with your bank, the plan it paid for ends. [DECISION 9, for buyers in the EU and UK: "If you live in the EU or the UK, you may withdraw from a purchase within 14 days of buying it and get a full refund."] Purchases made through the App Store or Google Play are refunded by Apple or Google under their policies; we cannot refund them.

Behaviour this describes:

- There is no written refund policy today, and refunds are issued by hand in the Stripe dashboard (the review records one such case, E1 item 12).
- A full refund or a dispute of a lifetime payment removes lifetime access; a dispute that is won, or funds reinstated, restores it (`disputeAccessDecision`, `lifetimeChargeDecision` in `stripe-webhook`).
- A refunded or disputed subscription payment keeps the plan revoked until a newer invoice is paid (`applySubscriptionAccess` in `stripe-webhook`). A partial refund does not end access. A refund or dispute on an older invoice, one that no longer decides access, is recorded as an amount only and does not change the plan (since round 2).
- The support address is `SUPPORT_EMAIL` in `src/lib/supportContact.js` (a personal Gmail address on 15 October; E1 item 9 moves it to support@geckinspect.com).

## 6. Lifetime plans (new section)

> **Lifetime plans.** A lifetime plan is a single payment for the Keeper or Breeder plan with no renewals. It is sold on our website only.
>
> - "Lifetime" means for as long as Geck Inspect operates the service, not for your lifetime or the life of any animal. It is tied to your account and cannot be transferred or resold.
> - A lifetime plan gives you the plan you bought (Keeper or Breeder) as that plan is defined from time to time. Like every plan, its features and limits can change, and we will not take away the core of the plan you paid for: [DECISION: name the core, for example "your gecko records, breeding records, lineage and passports, and the gecko limit of the plan you bought"]. Features that cost us money per use (for example Morph ID and other AI tools) come with the monthly allowances of your plan as they are set at the time.
> - If you already pay monthly or yearly when you buy a lifetime plan, your subscription is cancelled as soon as the lifetime payment succeeds. The unused part of the subscription is **not** credited or refunded. [DECISION: keep this, or credit the unused time. If kept, say it on the Membership page before purchase.]
> - If the lifetime payment is refunded in full or disputed, the lifetime plan ends.
> - **If we close the service or stop offering lifetime plans:** [DECISION 5. For example: "We will give at least 90 days' notice by email, and you will be able to export your records during that time." Optionally: "If we close the service within [two] years of your purchase, we will refund a share of your payment in proportion to the unused part of those [two] years."]

Behaviour this describes:

- Prices and the one-time Checkout: Keeper $149 and Breeder $349, `mode = payment`, no trial, an invoice is created for each (`TIER_PRICING`; `stripe-checkout` lines 45 to 49 and 205 to 245). There is no lifetime Enterprise.
- Web only: iOS and RevenueCat have no lifetime product (`docs/BILLING.md`). Whether the website's lifetime plans may be shown inside the iPhone app is an App Store guideline question (review C15 item 1).
- Existing subscription cancelled with no credit and no proration (`stripe-checkout` lines 45 to 49; `stripe-webhook` lifetime fulfilment); a second lifetime purchase is refused (409 `already_lifetime`).
- Subscription events cannot downgrade a lifetime member (`stripe-webhook`, the header comment on lifetime purchases, and `applySubscriptionAccess`).
- Access is permanent in the entitlement layer (`membership_billing_cycle = 'lifetime'`; header comment in `src/lib/stripe-config.js`).
- The review notes the lifetime webhook path has not been exercised with a real or test-mode purchase (C15 item 1). Run one test-mode lifetime purchase, refund and dispute before relying on this wording.

## 7. AI features: Morph ID, the health screen and the AI Consultant (new section)

> **AI features.** Some features use artificial intelligence provided by third parties (currently Anthropic, and Replicate for photo matching) to analyse photos and text you submit. Their output is generated automatically and can be wrong.
>
> - **Morph ID** describes the traits that are visible in your photos and how they rank against each other. It is not a genetic test and cannot confirm genetics, het status or lineage; many different crested geckos look alike in photos, and lighting and fired state change how a gecko looks. Its scores are rankings, not probabilities.
> - **The health screen** is a photo check to help with routine care. It is not a diagnosis and not veterinary advice. If you are worried about an animal, see a qualified reptile veterinarian.
> - **The AI Consultant** gives general information and can make mistakes. Check anything important before acting on it.
>
> Do not describe an animal for sale, or make a health or genetic claim to a buyer, on the strength of an AI result alone. You are responsible for what you tell buyers.
>
> Each plan includes a number of AI uses per calendar month, shown on the Membership page. Unused uses do not carry over. If an identification fails or times out on our side, the use is returned to you. Photos and text you submit to an AI feature are sent to the provider to produce the result and are handled as described in our Privacy Policy. We use them to train or evaluate our models only if you opt in.

Behaviour this describes:

- Morph ID wording already in the product: "This is a read of what is visible, not a genetic test" and "treat the result as a starting point, not a genetic test" (`src/components/morph-id/MorphCorrectionPanel.jsx`, `MorphIdLimitsCard.jsx`); "an identification aid, not a genetic test ... never treats model scores as calibrated probabilities" (`supabase/functions/recognize-gecko-morph/README.md`).
- Health screen wording in the product: "A photo check is a starting point for routine care, not a substitute for hands-on husbandry or a vet visit" (`src/components/health/HealthScreenCard.jsx`).
- Providers: `ANTHROPIC_API_KEY` and `REPLICATE_API_TOKEN` in the functions listed in `docs/OPERATIONS.md`.
- Monthly allowances with no rollover, counted by calendar month (the month turns at midnight UTC on the 1st): `TIER_LIMITS` (`src/lib/tierLimits.js`) and `supabase/migrations/20261008215000_morph_id_bonus_credits.sql` (`month_key_now()`, "no rollover"). The free plan's single lifetime try became one identification a month under E2 item 17 (decision 46, `consume_morph_id_credit` in `supabase/migrations/20261015151300_morph_id_share_card.sql`), so every plan, Free included, now has a monthly Morph ID allowance. The Terms should still say "as shown on the Membership page" so they do not need to change with the numbers.
- Failed or timed-out identifications are refunded (`refund_morph_id_credit` in `recognize-gecko-morph`).
- Training only with opt-in: the current Terms section 3 already says this.

## 8. Value estimates and market data (new section)

> **Value estimates and market data.** The value estimates on gecko records and breeding plans, the Price Index and the Market page are calculated from asking prices on public crested gecko listings, converted to US dollars. They are not sale prices, not appraisals and not offers to buy or sell. They can be out of date or incomplete, especially for rare traits and when our listing data is interrupted. Do not rely on them for insurance, legal, tax or lending purposes. What an animal sells for depends on the animal, the buyer and the market on the day.
>
> [DECISION 11: the licence for the published Price Index and open data, after counsel. Until then, say nothing about a licence in the Terms and keep the existing notice on the data pages.]

Behaviour this describes:

- In-product wording: "Asking prices on public crested gecko listings, converted to USD, not sale prices" (`src/components/public/PriceIndexTable.jsx`); "Based on asking prices from crested gecko listings tracked by Geck Data. An estimate, not an appraisal" (`src/components/gecko/MarketValueCard.jsx`).
- The US listing feed has been degraded since early September (decision 45), which is why the wording says data can be stale.

## 9. Changes to the opening paragraph and governing law (edits to existing sections)

- Opening paragraph: replace "operated by Geck Inspect" with "operated by [DECISION 1: legal name, for example 'Geck Inspect LLC, a [State] limited liability company']".
- Section 10, governing law: replace "the State in which Geck Inspect is operated" with "the State of [DECISION 1]".
- Section 11, contact: the support address from `src/lib/supportContact.js`, once it is a geckinspect.com address.
- The review also lists topics the Terms do not mention (A11 item 3): the open data licence, the MCP server, the market data and Enterprise. Section 8 above covers the market data; the rest wait for counsel (decision 11).

## 10. Checks before publishing

1. Tennyson makes decisions 1 to 11 and fills in every bracket.
2. Stripe dashboard matches the text: customer portal cancellation timing and proration, trial reminder emails, receipt wording, Stripe Tax.
3. The Membership page and checkout show the renewal terms, the trial terms and the lifetime "no credit for the unused subscription" line next to the buy buttons.
4. A test-mode lifetime purchase, refund and dispute behave as section 6 says.
5. Optional but recommended: one hour of a lawyer's time on this draft together with the scraped-data question.
6. Publish in `src/pages/Terms.jsx`, move `LAST_UPDATED`, rebuild (so `llms-full.txt` picks it up) and email members about the change.

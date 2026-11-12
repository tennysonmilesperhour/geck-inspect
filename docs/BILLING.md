# Membership billing

The current contract for paid plans: Stripe on the website, RevenueCat and Apple
in the iPhone app. The RevenueCat webhook was first verified on 6 September 2026;
the sections below were added to through October 2026, and the Stripe section was
moved here on 12 November 2026. This supersedes older instructions that every
native product must grant `Geck Inspect Pro`.

Prices and plan limits are not repeated here: the code is the source
(`src/lib/stripe-config.js`, `src/lib/tierLimits.js`) and the one table of them is
in section 5 of [CONTEXT.md](CONTEXT.md). The open Stripe step for Tennyson (adding
the refund and dispute events) is step C4 of [OWNER-STEPS.md](OWNER-STEPS.md).

## Products and access

Web membership purchases use the Stripe checkout and customer portal (the
"Stripe" section below). Native
membership purchases use RevenueCat and Apple StoreKit. Both providers grant
access to the same account and feature limits.

| RevenueCat entitlement | App tier | Apple products |
|---|---|---|
| `keeper` | Keeper | `com.geckinspect.keeper.monthly`, `com.geckinspect.keeper.annual` |
| `breeder` | Breeder | `com.geckinspect.breeder.monthly`, `com.geckinspect.breeder.annual` |
| `Geck Inspect Pro` | Breeder, legacy compatibility | Existing Test Store products; these do not grant production access |

RevenueCat project: `20585b81`. Apple app: `app3838b2750d`.
Bundle identifier: `com.geckinspect.app`. Offering: `default`.

The website also sells a Keeper lifetime plan and a Breeder lifetime plan. Both
are one-time Stripe Checkout payments; their prices and price ids are the
`lifetime` rows of `TIER_PRICING` in `src/lib/stripe-config.js`. iOS and
RevenueCat have no lifetime product. The Apple packages stay monthly and annual
only.
The four Apple packages have custom identifiers (`keeper_monthly`, etc.), so
`packageType === CUSTOM` is expected. The native screen identifies the actual
product and takes localized prices from the store. Unknown products are not sold
with guessed feature promises.

Tier resolution takes the highest of the protected Stripe profile tier, verified
store tier, and grandfathered Breeder grant. Admins receive Enterprise. Native
Keeper cannot downgrade a Stripe Breeder; Pro cannot downgrade Enterprise.
Never write store purchases into the Stripe membership fields.

## How access reaches a tool

1. `src/lib/revenuecat.js` configures the native SDK using `auth.users.id`.
2. A store purchase or restore finishes, then `revenuecat-sync` refreshes that
   signed-in account from RevenueCat's REST customer snapshot.
3. RevenueCat also delivers lifecycle events to `revenuecat-webhook`.
4. Both endpoints use `_shared/revenuecat.ts` and the atomic
   `apply_revenuecat_event` database function to update `revenuecat_entitlements`.
5. `loadUserProfile`, `RevenueCatContext`, and `resolveTier` read the mirror for UI
   access. `effective_tier_for_current_user()` supplies the corresponding server
   tier to feature-credit and quota checks.

The webhook is a refresh signal, not a command to toggle a boolean. Cancellation
can leave paid time; product changes can be deferred; a billing issue can have
an active grace period. Fetch the current customer snapshot for every affected
UUID. Transfers refresh both previous and new owners, including UUID aliases.

Expired, missing, refunded, or transferred-away entitlements are written inactive.
Every reconciliation writes all three supported entitlement identifiers, including
absent ones. Test Store and web sandbox purchases do not unlock production.
Validated Apple/Google sandbox receipts are accepted for store testing and review.
Each row also stores `is_sandbox`: true when the purchase behind it was made in the
Apple or Google sandbox (TestFlight, App Review, a developer's own phone). A sandbox
purchase still unlocks the plan, so App Review can test Breeder, but it is not money
and never counts as paying (see "What counts as paying" below).
`apply_revenuecat_event` sets the flag from the row's own `is_sandbox` (read from
the purchase in the customer snapshot) when the shared row builder sends it, else
from the webhook's `event.environment` (`SANDBOX` or `PRODUCTION`), else (a purchase
sync, which carries no environment) it keeps the stored value. The flag is stored
rather than read from webhook payloads, because the privacy job empties RevenueCat
payloads after 90 days.

SDK CustomerInfo is metadata for the native purchase UI. It never independently
grants feature access. Web clients do not initialize the large store SDK merely
to read memberships; they read the mirror alongside their Stripe profile.

## What counts as paying

The weekly scoreboard (`admin_scoreboard()`, shown on the admin Funnel card) is
where "paying breeders" and its recurring revenue are counted. Access and counting
are separate: everything below unlocks the plan exactly as described above, and
only the counting differs.

- Counts: a live Stripe subscription (active or past due, not a trial, not
  grandfathered), a lifetime plan with a lifetime payment on record, an App Store
  subscription bought with real money, and a prepaid year recorded by hand on the
  scoreboard (below).
- Never counts: App Store sandbox purchases (`is_sandbox`), App Store trials,
  promotional grants and the RevenueCat Test Store; and every number on the
  scoreboard leaves out the admin, the Morph ID evaluation account (`app_metadata`
  `morph_eval = true`) and accounts flagged internal (`app_metadata` `internal =
  true`, such as the QA and App Review accounts). Only the service role can write
  `app_metadata`, so a member cannot flag or unflag themselves. Flag a new test
  account in the Supabase dashboard (Authentication, the user, raw app metadata) or
  with SQL as the service role.
- Comps: a member who pays and also holds a current `membership_comps` grant is
  shown apart and left out of paying, because a comp is not evidence. The Revenue
  card on Overview still counts their money.
- Prepaid years: a breeder who pays for a year outside the app (for example a
  Founding Breeder year through a Stripe Payment Link, which `stripe-webhook` does
  not record as a membership) gets access through `membership_comps`. Record the
  payment on the scoreboard with Record by hand, "Prepaid year (Founding Breeder)",
  the breeder's name and the amount. For 12 months from that date the breeder counts
  as a paying Breeder, and a twelfth of the amount counts as recurring revenue, even
  though their access comes from the comp. Breeders are counted once by name, so a
  second entry for the same breeder adds money but not another breeder.

## RevenueCat: live webhook setup

Endpoint:
`https://mmuglfphhwlaluyfyxsp.supabase.co/functions/v1/revenuecat-webhook`

[RevenueCat integration](https://app.revenuecat.com/projects/20585b81/integrations/webhooks/whintgr3020562051/test)
(`whintgr3020562051`, "Geck Inspect subscription sync"):

- Enabled for all apps, all events, and production plus sandbox.
- Authorization header matches Supabase's `REVENUECAT_WEBHOOK_AUTHORIZATION`
  exactly, including the `Bearer ` prefix. Its value is never stored in git.
- `verify_jwt = false` for this external endpoint. The handler verifies its own
  shared authorization header. `revenuecat-sync` retains JWT verification and
  additionally verifies the user with Supabase Auth.
- Supabase `REVENUECAT_API_KEY` is the Apple app's public SDK key, which supports
  the read-only REST v1 customer lookup. No administrative RevenueCat key is needed.
- `VITE_REVENUECAT_IOS_API_KEY` is configured in Vercel production and the local
  public-key build configuration. The Android app needs its own Google SDK key
  before an Android release.
- Local `NATIVE_BILLING_WEBHOOK_VERIFIED=true` records the successful delivery.
  The separate native auth gate remains unset pending device verification.

RevenueCat's TEST event returned HTTP 200 and created a receipt without granting
access. Verified event: `7A8EF604-8095-42E6-9BB2-2218377297CF`, September 6 at
18:33 UTC. A separate ordinary-user live check confirmed authenticated sync,
Free access for an unpaid customer, caller UUID isolation, owner-readable rows,
429 rate limiting, denied anonymous sync, and denied client-forged writes. The
Supabase fixture account and its rows were removed afterward.

This proved delivery and reconciliation plumbing. A real Apple sandbox purchase
was observed later, on 18 October (see "Release checks"). Neither proves App
Store review acceptance.

## Reliability and recovery

- Receipt insertion and all entitlement writes commit in one transaction. Failed
  customer lookup or persistence returns 500 so RevenueCat can retry.
- A repeated event ID is acknowledged without repeating the work.
- Ordering uses the customer snapshot request timestamp, not webhook arrival time.
  A slower old lookup cannot overwrite a newer reconciliation.
- `TEST` creates only a receipt. It does not look up the example customer.
- `revenuecat-sync` ignores client-supplied IDs and entitlement claims. It allows
  one upstream lookup per account per ten seconds. An upstream failure can be
  retried after that interval.
- Purchase success and access activation are separate. If synchronization fails,
  the purchase remains with the store; the user can use Refresh store access or
  Restore purchases. Do not tell them to buy again.

Paying twice is refused on both sides. Web checkout (`stripe-checkout`) refuses a
member with a live App Store or Google Play subscription (code
`already_subscribed_store`; Test Store and promotional rows do not count), and the
phone app's purchase buttons are disabled for a member whose plan comes from
Stripe. Web checkout also expires any Checkout page the member still has open
before it makes a new one, so a second tab or a double tap cannot start a second
subscription or a second lifetime purchase; if an open page is being paid at that
moment the request is refused (`checkout_in_progress`). A member whose Stripe
payment failed (`subscription_status` past_due) sees a banner across the app that
opens the billing portal to update the card.

For a missing membership, compare the signed-in Auth UUID with the RevenueCat
customer ID, then inspect the customer's entitlements and delivery history. Check
`revenuecat_entitlements` and `revenuecat_webhook_events` for that UUID/event ID.
Use RevenueCat's resend action for a failed delivery, or have the signed-in
customer refresh store access. Never insert a guessed active row to fix a receipt.

Both billing functions are declared in `supabase/config.toml`, so merging a change
to `main` deploys them through the Supabase GitHub integration, and new migration
files are applied the same way ([MIGRATIONS.md](MIGRATIONS.md)). To deploy by hand
instead, from the repository root:

```bash
supabase functions deploy revenuecat-webhook --project-ref mmuglfphhwlaluyfyxsp --use-api
supabase functions deploy revenuecat-sync --project-ref mmuglfphhwlaluyfyxsp --use-api
```

After changing shared mapping code, make sure both billing functions are
redeployed.

## Stripe

Website memberships are sold through Stripe. Three edge functions do the work:
`stripe-checkout` starts a purchase, `stripe-billing-portal` opens Stripe's
customer portal (where a member switches plan, changes the card or cancels),
and `stripe-webhook` turns Stripe's events into the member's plan. The live
price ids are in `src/lib/stripe-config.js`.

The setup and the rules in this section were moved here on 12 November 2026
from the Stripe plan switching notes that used to sit at the top of `docs/`.
The test log that proved them (30 September to 8 October 2026) is now
`docs/planning/history/stripe-plan-switching-2026-10.md`.

### Which Stripe account

Use the Geck Inspect account, `acct_1TUx7dLBdc4xGjxq`. On 30 September 2026 the
Stripe tool connected to Claude sessions showed only a different account
("Apparently!"). Never use that account for Geck Inspect billing.

### Customer portal setup

A member changes plan in Stripe's customer portal, so the portal has to be set
up to allow it. In both test mode and live mode, open Settings, Billing,
Customer portal, select the Default configuration, and expand Subscriptions.

1. Enable "Customers can switch plans".
2. Include Keeper and Breeder only, each with its monthly and annual price.
   Exclude Enterprise and Posting Overage. Test mode has its own price ids; use
   the test catalog there.
3. Allow billing interval changes. Prorate upgrades and invoice immediately.
4. Schedule downgrades and shorter billing intervals at period end. Breeder
   monthly to Keeper monthly waits for the period end. So does Breeder monthly
   to Breeder annual, because the annual price is cheaper per month; the
   member's profile stays monthly until the scheduled change happens.
5. Under Business information, set Terms to https://geckinspect.com/Terms and
   Privacy to https://geckinspect.com/PrivacyPolicy, keep the support address
   (`SUPPORT_EMAIL` in `src/lib/supportContact.js`) as the support email, and
   set the return link to https://geckinspect.com/Membership.
6. Save, then open a portal session and look before calling it done.

State when last verified (30 September to early October 2026): the live default
configuration `bpc_1UC0v0LBdc4xGjxq2sqr5p86` and the test default
`bpc_1ULQc0LBdc4xGjxqn7JSnJ4p` allow switching between the four Keeper and
Breeder prices only, with quantity changes off, upgrades prorated and invoiced
at once, and cheaper plans or shorter intervals changed at period end. Both
return to Membership. A live Keeper to Breeder switch kept one subscription id
and set the right plan on the profile.

Stripe's own guides: https://docs.stripe.com/customer-management and
https://docs.stripe.com/customer-management/configure-portal.

Things the tests showed, which a future change must respect:

- **One item per subscription.** The portal refuses to update a subscription
  that has more than one item ("This PortalSession cannot update subscription
  ... because it has multiple items"). That is why the social post overage
  item stays off: checkout attaches it only when `STRIPE_OVERAGE_ENABLED` is
  exactly `true`, `STRIPE_OVERAGE_PRICE_ID` is set and the cycle is monthly. Do
  not switch it on again without reworking the plan-switch flow.
- **Do not trust `metadata.tier`.** On a subscription it is the plan from the
  original Checkout session. A switch in the portal does not update it, so a
  subscription can say `tier: keeper` while its price is Breeder. The webhook
  ignores the field and reads the price on the subscription item. Do not edit
  the metadata by hand.
- **Cancelling in the portal sets `cancel_at`**, with `cancel_at_period_end`
  left false, so that flag alone does not show a cancellation. The membership
  stays active until Stripe really cancels it.
- **A used single-use coupon may not survive a scheduled plan change.** In the
  live test a 100% coupon survived the immediate upgrade but was dropped when
  the annual change was scheduled.
- **Tax.** No tax rate is applied and Stripe Tax is not set up. Turning it on
  needs the right registrations first.

### Webhook events

The membership webhook is
`https://mmuglfphhwlaluyfyxsp.supabase.co/functions/v1/stripe-webhook`. The
list below is every event the function handles
(`supabase/functions/stripe-webhook/index.ts`). The endpoint in the Stripe
Dashboard (Developers, Webhooks, live mode) has to be subscribed to all of
them.

| Event | What the webhook does with it | Selected on the endpoint? |
|---|---|---|
| `checkout.session.completed` | Starts a membership bought through `stripe-checkout`. For a lifetime plan, grants it when the payment is marked paid | Yes |
| `customer.subscription.created`, `customer.subscription.updated` | Sets the plan from the price on the subscription item, and records a cancellation the moment Stripe reports one | Yes |
| `customer.subscription.deleted` | Ends the plan (sets the member to Free) when it is the member's current subscription | Yes |
| `invoice.paid`, `invoice.payment_succeeded` | The same payment, delivered twice. It is applied once, so there is no second month and no second referral credit. Keep both selected | Yes |
| `invoice.payment_failed` | Marks the subscription past due, which shows the "update your card" banner | Yes |
| `charge.refunded` | See "Refunds and disputes" below | To add (step C4) |
| `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`, `charge.dispute.funds_withdrawn`, `charge.dispute.funds_reinstated` | See "Refunds and disputes" below | To add (step C4) |
| `customer.subscription.trial_will_end` | Arrives about three days before a trial ends. Refreshes the plan and does not remove access | To add (step C4) |
| `checkout.session.async_payment_succeeded` | Grants a lifetime plan paid with a delayed payment method | To add (step C4) |

The last column is what the notes at the top of the function record: seven
events already selected, eight to add. It was not read from the Stripe
Dashboard. **The open step** is adding those eight by hand: step C4 of
[OWNER-STEPS.md](OWNER-STEPS.md) has the link and the exact list. Until it is
done a refund never reaches the app (the 17 October refund is not on the
Revenue card for this reason). Add events; never remove one that is already
selected. If test mode has its own endpoint, do the same there.

Each event id is applied once: a redelivery or a replay from the Dashboard of
an event that already finished is answered 200 and skipped. A database write
that fails makes the whole event fail (500), so Stripe sends it again.

### Refunds and disputes

What these events do to a member's access once the endpoint receives them:

- **A full refund of the subscription's latest membership invoice sets the
  member to Free.** If the latest invoice cannot be read, a full refund that
  still belongs to that subscription does the same. A partial refund does not.
  A refund of an older invoice does not take away a plan the member has
  already renewed; only the amount is recorded.
- **A chargeback sets the member to Free** (dispute status `needs_response`,
  `under_review` or `lost`, or the funds withdrawn). If the dispute is won, or
  Stripe returns the funds, access comes back only while that subscription is
  still active or trialing. An inquiry (`warning_needs_response`) does not
  remove access.
- **A lifetime plan** is removed by a full refund or a dispute of its payment.
- **A trial ending** does not remove access by itself. Access ends when Stripe
  marks the subscription `canceled`, `unpaid` or `incomplete_expired`, which
  arrives as `customer.subscription.updated` or `customer.subscription.deleted`.
- **A refund removes access in Geck Inspect. It does not cancel the Stripe
  subscription.** If the refund should also stop the next bill, cancel that
  subscription in the Stripe Dashboard by hand.

## Release checks

- Run Vitest billing and identity tests, Deno checks for both entry points, and
  the rollback-only scripts `supabase/tests/billing_repair_regressions.sql` and
  `supabase/tests/revenuecat_access_regressions.sql`.
- Verify the Apple app's in-app purchase credentials, product availability,
  subscription groups/levels and store agreements in App Store Connect. The
  RevenueCat dashboard reports its in-app purchase key as valid.
- On 17 October 2026, both production and sandbox Apple server notification
  URLs were configured with this app's receiver from RevenueCat settings.
  Delivery has since been observed in production: a sandbox Breeder annual
  purchase on 18 October arrived through RevenueCat, 8 renewals followed, and
  the member's `breeder` entitlement was active when checked on 26 October
  (the 26 October section of [APP_STORE_REQUIREMENTS.md](APP_STORE_REQUIREMENTS.md)).
  That was the last open billing proof, so `NATIVE_BILLING_WEBHOOK_VERIFIED=true`
  can be set for the store build.
- On the actual release binary, use an ordinary account for Keeper and Breeder
  sandbox purchases, restore after reinstall, upgrade, cancellation with paid
  time remaining, expiration/refund, and an account transfer. Verify both UI and
  a metered server tool. Test no-purchase and duplicate-delivery cases too.
- Set `NATIVE_BILLING_WEBHOOK_VERIFIED=true` only after verified delivery. Keep
  actual purchase evidence in the release record. Do not set the separate native
  auth verification flag from a successful compilation alone.

Technical references: [RevenueCat webhooks](https://www.revenuecat.com/docs/integrations/webhooks),
[event semantics](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields),
[customer snapshot](https://www.revenuecat.com/docs/api-v1/customer-info-model),
[REST customer lookup](https://www.revenuecat.com/docs/api-v1/customers),
[Supabase function authentication](https://supabase.com/docs/guides/functions/auth-headers).

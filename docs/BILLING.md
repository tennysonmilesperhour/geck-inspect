# Membership billing

Current contract, verified September 6, 2026. This supersedes older instructions
that every native product must grant `Geck Inspect Pro`.

## Products and access

Web membership purchases use the Stripe checkout and customer portal. Native
membership purchases use RevenueCat and Apple StoreKit. Both providers grant
access to the same account and feature limits.

| RevenueCat entitlement | App tier | Apple products |
|---|---|---|
| `keeper` | Keeper | `com.geckinspect.keeper.monthly`, `com.geckinspect.keeper.annual` |
| `breeder` | Breeder | `com.geckinspect.breeder.monthly`, `com.geckinspect.breeder.annual` |
| `Geck Inspect Pro` | Breeder, legacy compatibility | Existing Test Store products; these do not grant production access |

RevenueCat project: `20585b81`. Apple app: `app3838b2750d`.
Bundle identifier: `com.geckinspect.app`. Offering: `default`.

Web Keeper lifetime is $149 (`price_1UQV93LBdc4xGjxq4AvXpui4`) and web Breeder
lifetime is $349 (`price_1UQV94LBdc4xGjxqwzNWvXyI`). Both are one-time Stripe
Checkout payments. iOS and RevenueCat have no lifetime product. The Apple
packages stay monthly and annual only.
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

## Live webhook setup

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

This proves delivery and reconciliation plumbing. It does not prove an Apple
purchase or App Store review acceptance.

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

## Release checks

- Run Vitest billing and identity tests, Deno checks for both entry points, and
  the rollback-only scripts `supabase/tests/billing_repair_regressions.sql` and
  `supabase/tests/revenuecat_access_regressions.sql`.
- Verify the Apple app's in-app purchase credentials, product availability,
  subscription groups/levels and store agreements in App Store Connect. The
  RevenueCat dashboard reports its in-app purchase key as valid.
- On 17 October 2026, both production and sandbox Apple server notification
  URLs were configured with this app's receiver from RevenueCat settings.
  No delivery has been observed yet. Send a test notification or run the
  sandbox lifecycle test and verify receipt; configuration alone is not proof.
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

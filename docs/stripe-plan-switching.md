# Stripe plan switching

Status checked September 30, 2026. The code and removal of the existing overage item are shipped. Portal setup and the full switching test remain pending. Tennyson approved the live overage removal and a dedicated 100% discounted live test. Permission to configure the portals was requested separately and is still pending.

## Dashboard setup

Use the Geck Inspect account, acct_1TUx7dLBdc4xGjxq. The connected Stripe tool currently exposes only Apparently!, a different account. Do not use that account for Geck Inspect billing.

In both test mode and live mode, open Settings > Billing > Customer portal, select the Default configuration, and expand Subscriptions.

1. Enable Customers can switch plans.
2. Include Keeper and Breeder only, with each plan's monthly and annual prices. Exclude Enterprise and Posting Overage. Test mode has separate price IDs; use the test catalog there.
3. Allow billing interval changes. Prorate upgrades and invoice immediately.
4. Schedule eligible downgrades and shorter billing intervals at period end. Stripe documents that end-of-period downgrades are limited to prices on the same product. Keeper and Breeder are separate products, so do not promise delayed cross-tier downgrades without verifying the actual preview. If unsupported, resolve that policy before rollout.
5. Under Business information, check legal links. At inspection, both were missing. Set Terms to https://geckinspect.com/Terms and Privacy to https://geckinspect.com/PrivacyPolicy in Public business information. Keep support email morphiclabsdata@gmail.com. Set the return link to https://geckinspect.com/Membership.
6. Save and inspect a portal session before calling this complete.

Live catalog:

| Plan | Monthly | Annual |
| --- | --- | --- |
| Keeper | price_1TUxEsLBdc4xGjxqyPV4DOYb | price_1TVMLeLBdc4xGjxqA856z0Oe |
| Breeder | price_1TUxHGLBdc4xGjxqeieYNdE4 | price_1TVMOCLBdc4xGjxqK2HTmGfm |

Stripe documentation: https://docs.stripe.com/customer-management and https://docs.stripe.com/customer-management/configure-portal.

## Overage

Social posting remains paused. Checkout only attaches its monthly metered item when STRIPE_OVERAGE_ENABLED is exactly true AND STRIPE_OVERAGE_PRICE_ID is set AND the membership cycle is monthly. Do not opt in again without replacing or revisiting the portal switching flow: Stripe does not allow updates to usage-based or multi-product subscriptions.

Removed item si_VCQpLSZviCFTKC from subscription sub_1UC1y9LBdc4xGjxqeHTerQUR on September 30 at about 16:30 UTC. The Dashboard showed zero usage. Proration and billing-anchor reset were unchecked. The same subscription now has only the Keeper item, si_VCQpRiR741IvKb. The real webhook is processed and the profile remains keeper/monthly/active. Next invoice remains $2.99 on October 4.

## Verification still required

First reproduce the portal limitation with a test-mode subscription containing a membership and metered item, then remove the metered item and verify switching becomes available. This reproduction has not run.

For the live integration, use a dedicated test account and a 100% discount that remains valid through upgrades and interval changes. Verify the checkout and every confirmation show $0 before submitting. Subscribe to Keeper monthly, choose Breeder on Membership, confirm the toast and portal redirect, switch to Breeder, switch to annual, then cancel. Never use the existing paying subscription for this test.

After each step verify exactly one subscription for the test customer; the same subscription id in profiles; the expected membership_tier, membership_billing_cycle and subscription_status; processed stripe_webhook_logs; and no new Second live Stripe subscription error. Clean up the test subscription, customer and promotion code. No live test records have been created yet.

## Checks completed

- Checkout v34, webhook v37, billing portal v11 deployed through Supabase MCP and downloaded to compare exact contents.
- 17 focused billing tests pass, including catalog alignment, reversed item ordering, legacy/current invoice formats, environment price overrides, and explicit monthly-only overage opt-in.
- Full project suite: 54 files, 915 tests pass. Lint passes. Excluded the pre-existing untracked node_modules 2 folder from both commands.
- Database HTTP calls: unsigned webhook 400; unauthenticated checkout and billing portal 401. These are authentication smoke tests, not proof of a completed plan switch.
- Existing subscription update delivered a real processed webhook after overage removal.

Tax settings were not changed. The inspected subscription has no tax rate applied; any future Stripe Tax setup requires applicable registrations.

# Stripe plan switching

Status checked September 30, 2026. Code, overage removal, and both default portals are shipped. The live Keeper to Breeder test passed with one unchanged subscription id and the correct profile. Annual scheduling and portal cancellation also passed. Cleanup is in progress.

## Dashboard setup

Use the Geck Inspect account, acct_1TUx7dLBdc4xGjxq. The connected Stripe tool currently exposes only Apparently!, a different account. Do not use that account for Geck Inspect billing.

In both test mode and live mode, open Settings > Billing > Customer portal, select the Default configuration, and expand Subscriptions.

1. Enable Customers can switch plans.
2. Include Keeper and Breeder only, with each plan's monthly and annual prices. Exclude Enterprise and Posting Overage. Test mode has separate price IDs; use the test catalog there.
3. Allow billing interval changes. Prorate upgrades and invoice immediately.
4. Schedule eligible downgrades and shorter billing intervals at period end. The actual sandbox preview schedules Breeder monthly to Keeper monthly at period end even though they are separate products. Breeder monthly to annual also schedules at period end because the annual price is cheaper on a monthly basis; the profile must remain monthly until the scheduled change occurs.
5. Under Business information, check legal links. Both are now saved. Set Terms to https://geckinspect.com/Terms and Privacy to https://geckinspect.com/PrivacyPolicy in Public business information. Keep support email morphiclabsdata@gmail.com. Set the return link to https://geckinspect.com/Membership.
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

## Portal verification completed

Live default configuration bpc_1UC0v0LBdc4xGjxq2sqr5p86 and test default bpc_1ULQc0LBdc4xGjxqn7JSnJ4p have switching enabled for the four Keeper/Breeder prices only, quantity changes disabled, immediate invoiced prorations, and period-end cheaper-plan/shorter-interval changes. Both return to Membership. Live settings were reloaded to verify persistence. Public support email and Contact, Terms, and PrivacyPolicy links are saved.

In test mode, subscription sub_1ULQc1LBdc4xGjxqnVojeMpA reproduced Stripe's rejection: "This PortalSession cannot update subscription ... because it has multiple items." Removing only the metered item without proration made the subscription update portal available. A browser Keeper monthly to Breeder monthly confirmation kept exactly one subscription and the same id. The API showed the Breeder monthly price and active status. A downgrade preview scheduled Keeper monthly at October 30 renewal. A confirmed annual change created schedule sub_sched_1ULQmILBdc4xGjxqtMRg2QGy for Breeder annual on October 30, with exactly one subscription and the current monthly price retained until then. The test schedule/subscription was then canceled without invoice or proration and the disposable test customer deleted. The test catalog and default portal remain available.

## Live verification

Tennyson completed the real-card step privately. The dedicated customer was cus_VMA4F60CV0JmZZ and the only subscription was sub_1ULSp0LBdc4xGjxqZJR1W9fe. Checkout and upgrade invoices both paid $0; no payment was collected.

- Checkout set the profile to keeper/monthly/active. All checkout, subscription-created and invoice events processed.
- Choosing Start Breeder on Membership opened the existing customer's portal. The transient toast was not captured. Dashboard showed exactly one subscription before and after upgrading. The profile became breeder/monthly/active with the same subscription id; subscription.updated and invoice events processed.
- Selecting Breeder annual showed $0 and scheduled the change for October 30. Schedule sub_sched_1ULSs0LBdc4xGjxqn7v0GsKU was attached to the same subscription. The profile correctly remained breeder/monthly/active. The future annual activation was not exercised because cleanup cancels before renewal.
- Portal cancellation released the annual schedule and set cancel_at to October 30. The processed event uses cancel_at with cancel_at_period_end=false; that flag alone is not a reliable cancellation indicator. Membership remains active until actual cancellation.
- No Second live Stripe subscription errors appeared during the run.

Discount caveat: the single-use 100% forever coupon GSj9OGsG survived the immediate upgrade, but the annual schedule operation removed its discount despite a $0 confirmation preview. The portal then estimated $60 at renewal. The coupon was invalid after its one redemption; this run does not establish whether the redemption limit caused the schedule behavior. Do not rely on a consumed single-use coupon surviving a scheduled plan change. The test was canceled before renewal with no charge. Promotion code promo_1ULQeFLBdc4xGjxqrtEHBXaY is inactive and the coupon is expired (1/1 redemptions), so neither can be reused.

Cleanup: portal cancellation is verified; immediate deletion of the disposable Stripe customer is awaiting action-time approval. The disposable app login remains available with no collection records.

## Checks completed

- Checkout v34, webhook v37, billing portal v11 deployed through Supabase MCP and downloaded to compare exact contents.
- 17 focused billing tests pass, including catalog alignment, reversed item ordering, legacy/current invoice formats, environment price overrides, and explicit monthly-only overage opt-in.
- Full project suite: 54 files, 915 tests pass. Lint passes. Excluded the pre-existing untracked node_modules 2 folder from both commands.
- Database HTTP calls: unsigned webhook 400; unauthenticated checkout and billing portal 401. These are authentication smoke tests, not proof of a completed plan switch.
- Existing subscription update delivered a real processed webhook after overage removal.

Tax settings were not changed. The inspected subscription has no tax rate applied; any future Stripe Tax setup requires applicable registrations.

## Owner checklist: webhook events (8 Oct 2026)

Do this in the Stripe Dashboard. Nothing in this change edits the Stripe account, a subscription, or the endpoint's event list.

The membership webhook is `https://mmuglfphhwlaluyfyxsp.supabase.co/functions/v1/stripe-webhook`.

`metadata.tier` on a subscription is the plan from the original Checkout session. Switching Keeper to Breeder in the portal does not update it, so a subscription can show `tier: keeper` while the price is Breeder. The webhook ignores that field and reads the price on the subscription item. Do not edit the metadata by hand.

1. Open Developers, then Webhooks. Switch to live mode. Open the endpoint above.
2. Add these events. Leave every event that is already selected, including both `invoice.paid` and `invoice.payment_succeeded`:
   - `charge.refunded`
   - `charge.dispute.created`
   - `charge.dispute.updated`
   - `charge.dispute.closed`
   - `charge.dispute.funds_withdrawn`
   - `charge.dispute.funds_reinstated`
   - `customer.subscription.trial_will_end`
3. Save.
4. Repeat in test mode if that mode has its own endpoint.

What those events do once this webhook is deployed:

- A full refund of the subscription's latest membership invoice sets the member to Free. If the latest invoice cannot be read, a full refund that still belongs to that subscription does the same. A partial refund does not. A refund of an older invoice does not take away a plan they already renewed.
- A chargeback (`needs_response`, `under_review`, funds withdrawn, or `lost`) sets the member to Free. If you win the dispute, or Stripe returns the funds, access comes back only while that subscription is still active or trialing. An inquiry (`warning_needs_response`) does not remove access.
- `customer.subscription.trial_will_end` arrives about three days before the trial ends and does not remove access. Access ends when Stripe marks the subscription `canceled`, `unpaid`, or `incomplete_expired`. Those updates already arrive as `customer.subscription.updated` and `customer.subscription.deleted`.
- `invoice.paid` and `invoice.payment_succeeded` are the same payment. The second delivery does not grant a second month or a second referral credit.
- A refund removes access in Geck Inspect. It does not cancel the Stripe subscription. If the refund should stop the next bill, cancel that subscription in the Dashboard yourself.

#!/usr/bin/env node
//
// One-shot backfill: adds the metered Geck Inspect overage price to every
// existing active subscription that doesn't already have it. New
// subscriptions get it automatically via stripe-checkout going forward, but
// any subscription created before that change needs this script run once.
//
// Usage:
//   STRIPE_SECRET_KEY=sk_live_xxx STRIPE_OVERAGE_PRICE_ID=price_xxx \
//     node scripts/backfill-stripe-overage-line.mjs
//
// Optional flags:
//   --dry-run        list what would change, don't modify anything
//   --include-trial  also patch subscriptions still in trial status
//
// Idempotent: re-running is safe. Skips subs that already have the metered
// item attached.

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_OVERAGE_PRICE_ID = process.env.STRIPE_OVERAGE_PRICE_ID;
const DRY_RUN = process.argv.includes('--dry-run');
const INCLUDE_TRIAL = process.argv.includes('--include-trial');

if (!STRIPE_SECRET_KEY) {
  console.error('STRIPE_SECRET_KEY not set in environment.');
  process.exit(1);
}
if (!STRIPE_OVERAGE_PRICE_ID) {
  console.error('STRIPE_OVERAGE_PRICE_ID not set in environment.');
  process.exit(1);
}

async function stripe(path, method = 'GET', form = null) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Stripe ${path} (${res.status}): ${data?.error?.message || JSON.stringify(data)}`);
  return data;
}

async function listAllSubscriptions() {
  const subs = [];
  let starting_after = null;
  while (true) {
    const params = new URLSearchParams();
    params.set('limit', '100');
    params.set('status', INCLUDE_TRIAL ? 'all' : 'active');
    params.set('expand[]', 'data.items');
    if (starting_after) params.set('starting_after', starting_after);
    const res = await stripe(`/subscriptions?${params.toString()}`);
    subs.push(...res.data);
    if (!res.has_more) break;
    starting_after = res.data[res.data.length - 1].id;
  }
  return subs;
}

function alreadyHasOverageLine(sub) {
  return (sub.items?.data || []).some(
    (it) => it.price?.id === STRIPE_OVERAGE_PRICE_ID,
  );
}

async function attachOverageItem(subscriptionId) {
  const form = new URLSearchParams();
  form.set('subscription', subscriptionId);
  form.set('price', STRIPE_OVERAGE_PRICE_ID);
  form.set('proration_behavior', 'none');
  return stripe('/subscription_items', 'POST', form);
}

async function main() {
  console.log(`Listing subscriptions (status=${INCLUDE_TRIAL ? 'all' : 'active'}) ...`);
  const subs = await listAllSubscriptions();
  console.log(`Found ${subs.length} subscription(s).`);

  let patched = 0;
  let skipped = 0;
  let failed = 0;

  for (const sub of subs) {
    const tag = `${sub.id} (${sub.status}, customer ${sub.customer})`;
    if (alreadyHasOverageLine(sub)) {
      console.log(`  skip ${tag} - already has overage line`);
      skipped++;
      continue;
    }
    if (DRY_RUN) {
      console.log(`  WOULD PATCH ${tag}`);
      patched++;
      continue;
    }
    try {
      await attachOverageItem(sub.id);
      console.log(`  patched ${tag}`);
      patched++;
    } catch (err) {
      console.error(`  FAILED ${tag}: ${err.message}`);
      failed++;
    }
  }

  console.log('\nDone.');
  console.log(`  patched: ${patched}${DRY_RUN ? ' (dry-run)' : ''}`);
  console.log(`  skipped: ${skipped}`);
  console.log(`  failed:  ${failed}`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});

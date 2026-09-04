/**
 * Build-time environment check.
 *
 * Runs first in `pnpm build`. It never prints a value, only whether each
 * public VITE_ variable is present and, where the key format tells us,
 * whether it is a sandbox or production key. The point is that the
 * Vercel build log answers "did the env vars make it into this build?"
 * without anyone having to open the shipped bundle.
 *
 * Why this exists: the 2026-09-04 launch review found the production
 * bundle had been built with no VITE_ variables at all, so billing ran
 * on the RevenueCat sandbox key and analytics were silently off. Nothing
 * in the build had said so.
 *
 * Never fails the build. A missing key on launch night is a loud line in
 * the log, not a broken deploy.
 */

const IS_VERCEL = Boolean(process.env.VERCEL);
const TARGET = process.env.VERCEL_ENV || (IS_VERCEL ? 'unknown' : 'local');
const VERBOSE = process.argv.includes('--verbose');

// [name, required-in-production, classifier]
const CHECKS = [
  // supabaseClient.js carries a hardcoded fallback for the production
  // project, so these two are informational rather than required.
  ['VITE_SUPABASE_URL', false, null],
  ['VITE_SUPABASE_ANON_KEY', false, null],
  [
    'VITE_REVENUECAT_WEB_API_KEY',
    true,
    (v) => {
      if (v.startsWith('test_') || v.startsWith('rcb_sb_')) return 'sandbox key';
      if (v.startsWith('rcb_')) return 'production key';
      return 'set, unrecognized prefix';
    },
  ],
  ['VITE_POSTHOG_KEY', true, (v) => (v.startsWith('phc_') ? 'project key' : 'set, unexpected prefix')],
  ['VITE_POSTHOG_HOST', false, null],
  ['VITE_VAPID_PUBLIC_KEY', true, (v) => (v.length >= 80 ? 'looks like a VAPID public key' : 'set, unexpectedly short')],
  ['VITE_GECK_DATA_SUPABASE_URL', false, null],
  ['VITE_GECK_DATA_SUPABASE_ANON_KEY', false, null],
  ['VITE_MARKET_SNAPSHOT_URL', false, null],
  ['VITE_MARKET_INTEL_URL', false, null],
  ['VITE_SHIPZEROS_LIVE', false, null],
  ['VITE_IMAGE_TRANSFORMS', false, null],
];

function describe(name, value, classify) {
  if (!value) return 'MISSING';
  const note = classify ? classify(value) : 'set';
  return note;
}

const rows = CHECKS.map(([name, required, classify]) => {
  const value = process.env[name] || '';
  return { name, required, status: describe(name, value, classify), present: Boolean(value) };
});

if (IS_VERCEL || VERBOSE) {
  console.log(`[check-env] target: ${TARGET}`);
  for (const r of rows) {
    const flag = r.required ? 'required' : 'optional';
    console.log(`[check-env]   ${r.name.padEnd(34)} ${r.status}  (${flag})`);
  }
}

if (TARGET === 'production') {
  const warnings = [];
  for (const r of rows) {
    if (r.required && !r.present) warnings.push(`${r.name} is not set. Add it under Vercel, Settings, Environment Variables (Production) and redeploy.`);
  }
  const rc = rows.find((r) => r.name === 'VITE_REVENUECAT_WEB_API_KEY');
  if (rc?.present && rc.status === 'sandbox key') {
    warnings.push('VITE_REVENUECAT_WEB_API_KEY is a sandbox key. Web purchases will not charge real cards.');
  }
  for (const w of warnings) console.warn(`[check-env] WARNING: ${w}`);
  if (warnings.length === 0) console.log('[check-env] all required production variables present');
}

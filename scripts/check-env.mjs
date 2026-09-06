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
 * Production and store-release builds fail when required configuration is missing.
 */

import { loadEnv } from 'vite';
const ENV = { ...loadEnv('production', process.cwd(), ''), ...process.env };
const RELEASE_PLATFORM = ENV.GECK_RELEASE_TARGET || null;
const IS_NATIVE_RELEASE = ['android', 'ios'].includes(RELEASE_PLATFORM);

const IS_VERCEL = Boolean(ENV.VERCEL);
const TARGET = ENV.VERCEL_ENV || (IS_VERCEL ? 'unknown' : 'local');
const VERBOSE = process.argv.includes('--verbose');

// [name, required-in-production, classifier]
const CHECKS = [
  // supabaseClient.js carries a hardcoded fallback for the production
  // project, so these two are informational rather than required.
  ['VITE_SUPABASE_URL', false, null],
  ['VITE_SUPABASE_ANON_KEY', false, null],
  [
    'VITE_REVENUECAT_WEB_API_KEY',
    !IS_NATIVE_RELEASE,
    (v) => {
      if (v.startsWith('test_') || v.startsWith('rcb_sb_')) return 'sandbox key';
      if (v.startsWith('rcb_')) return 'production key';
      return 'set, unrecognized prefix';
    },
  ],
  ['VITE_POSTHOG_KEY', true, (v) => (v.startsWith('phc_') ? 'project key' : 'set, unexpected prefix')],
  ['VITE_POSTHOG_HOST', false, null],
  ['VITE_VAPID_PUBLIC_KEY', !IS_NATIVE_RELEASE, (v) => (v.length >= 80 ? 'looks like a VAPID public key' : 'set, unexpectedly short')],
  ['VITE_REVENUECAT_ANDROID_API_KEY', RELEASE_PLATFORM === 'android', null],
  ['VITE_REVENUECAT_IOS_API_KEY', RELEASE_PLATFORM === 'ios', null],
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
  const value = ENV[name] || '';
  return { name, required, status: describe(name, value, classify), present: Boolean(value) };
});

if (IS_VERCEL || VERBOSE) {
  console.log(`[check-env] target: ${TARGET}`);
  for (const r of rows) {
    const flag = r.required ? 'required' : 'optional';
    console.log(`[check-env]   ${r.name.padEnd(34)} ${r.status}  (${flag})`);
  }
}

if (TARGET === 'production' || IS_NATIVE_RELEASE) {
  const warnings = [];
  for (const r of rows) {
    if (r.required && !r.present) warnings.push(`${r.name} is not set. Add it under Vercel, Settings, Environment Variables (Production) and redeploy.`);
  }
  const rc = rows.find((r) => r.name === 'VITE_REVENUECAT_WEB_API_KEY');
  if (!IS_NATIVE_RELEASE && rc?.present && rc.status === 'sandbox key') {
    warnings.push('VITE_REVENUECAT_WEB_API_KEY is a sandbox key. Web purchases will not charge real cards.');
  }
  if (IS_NATIVE_RELEASE && ENV.NATIVE_AUTH_REDIRECT_VERIFIED !== 'true') warnings.push('Verify the native callback allowlist and set NATIVE_AUTH_REDIRECT_VERIFIED=true for the store build.');
  if (IS_NATIVE_RELEASE && ENV.NATIVE_BILLING_WEBHOOK_VERIFIED !== 'true') warnings.push('Verify RevenueCat webhook delivery and set NATIVE_BILLING_WEBHOOK_VERIFIED=true for the store build.');
  if (IS_NATIVE_RELEASE) {
    const key = ENV[`VITE_REVENUECAT_${RELEASE_PLATFORM.toUpperCase()}_API_KEY`] || '';
    if (key.startsWith('test_') || key.startsWith('rcb_')) warnings.push('A store-specific RevenueCat key is required for a native release.');
  }
  for (const w of warnings) console.error(`[check-env] ERROR: ${w}`);
  if (warnings.length > 0) { console.error('[check-env] Release configuration is incomplete.'); process.exitCode = 1; }
  if (warnings.length === 0) console.log('[check-env] all required production variables present');
}

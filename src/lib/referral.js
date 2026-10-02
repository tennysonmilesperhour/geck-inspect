import { supabase } from '@/lib/supabaseClient';

const REFERRAL_QUERY_PARAM = 'ref';
const STORAGE_KEY = 'geck_inspect_pending_referral';
// When the link was opened, so an account that already existed before
// then is not attributed. The database applies the real rule (accounts
// created in the last 7 days that never had a plan); this only avoids a
// pointless call for an existing member who clicks someone's link.
const CAPTURED_AT_KEY = 'geck_inspect_pending_referral_at';
// Allowance for clock differences between the phone and the server.
const CLOCK_SLACK_MS = 10 * 60 * 1000;

export function buildReferralLink(referralCode, baseUrl) {
  if (!referralCode) return '';
  const origin =
    baseUrl ||
    (typeof window !== 'undefined' ? window.location.origin : '');
  if (!origin) return '';
  return `${origin}/?${REFERRAL_QUERY_PARAM}=${encodeURIComponent(referralCode)}`;
}

// Pulls ?ref=<code> off the URL on initial load and stashes it in
// localStorage so we can apply it once the user signs up, even if they
// bounce around the site or come back later in the same browser. Strips
// the param from the URL bar so the dirty link doesn't get bookmarked.
export function captureReferralFromUrl() {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    const code = url.searchParams.get(REFERRAL_QUERY_PARAM);
    if (!code) return;
    localStorage.setItem(STORAGE_KEY, code);
    localStorage.setItem(CAPTURED_AT_KEY, String(Date.now()));
    url.searchParams.delete(REFERRAL_QUERY_PARAM);
    const search = url.searchParams.toString();
    const newUrl = url.pathname + (search ? `?${search}` : '') + url.hash;
    window.history.replaceState({}, '', newUrl);
  } catch {
    // Non-browser env. Ignore.
  }
}

export function getPendingReferralCode() {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearPendingReferralCode() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(CAPTURED_AT_KEY);
  } catch {}
}

function getCapturedAt() {
  try {
    const raw = Number(localStorage.getItem(CAPTURED_AT_KEY));
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  } catch {
    return null;
  }
}

/**
 * True when the account was created before the referral link was opened,
 * meaning an existing member clicked someone's link. Unknown dates return
 * false and leave the decision to the database.
 */
export function accountPredatesReferral(user, capturedAt) {
  if (!capturedAt || !user?.created_date) return false;
  const created = Date.parse(user.created_date);
  if (!Number.isFinite(created)) return false;
  return created < capturedAt - CLOCK_SLACK_MS;
}

// If a referral code is pending and the signed-in user has not already
// been attributed to a referrer, link them. The database function
// apply_referral_code() does the checking (code exists, not the member's
// own, nobody recorded yet, a new account that never had a plan) and is
// the only thing allowed to write referred_by, so a member cannot
// re-point their attribution later.
// Best-effort: never blocks auth. A transient failure keeps the pending
// code so the next sign-in retries.
export async function applyPendingReferral(user) {
  if (!user?.email) return;
  const code = getPendingReferralCode();
  if (!code) return;

  if (user.referred_by || user.referral_code === code || accountPredatesReferral(user, getCapturedAt())) {
    clearPendingReferralCode();
    return;
  }

  try {
    const { error } = await supabase.rpc('apply_referral_code', { p_code: code });
    if (error) throw error;
    clearPendingReferralCode();
  } catch (err) {
    console.warn('applyPendingReferral failed:', err);
  }
}

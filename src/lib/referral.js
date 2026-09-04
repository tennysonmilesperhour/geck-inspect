import { supabase } from '@/lib/supabaseClient';

const REFERRAL_QUERY_PARAM = 'ref';
const STORAGE_KEY = 'geck_inspect_pending_referral';

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
  } catch {}
}

// If a referral code is pending and the signed-in user has not already
// been attributed to a referrer, link them. The database function
// apply_referral_code() does the checking (code exists, not the member's
// own, nobody recorded yet) and is the only thing allowed to write
// referred_by, so a member cannot re-point their attribution later.
// Best-effort: never blocks auth. A transient failure keeps the pending
// code so the next sign-in retries.
export async function applyPendingReferral(user) {
  if (!user?.email) return;
  const code = getPendingReferralCode();
  if (!code) return;

  if (user.referred_by || user.referral_code === code) {
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

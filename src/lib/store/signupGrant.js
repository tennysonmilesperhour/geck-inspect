/**
 * Signup-grant capture + redemption helpers.
 *
 * Receipts emailed to guest checkouts include a link of the form
 *   /AuthPortal?grant=<token>
 *
 * On AuthPortal mount we capture the `grant` query param into
 * localStorage so the grant survives the OAuth / email-confirmation
 * round-trip. After the user is signed in we call the SECURITY DEFINER
 * `redeem_signup_grant` RPC, which validates the token (expiry, email
 * match, single-use) and applies the membership extension server-side.
 */

import { supabase } from '@/lib/supabaseClient';
import { captureEvent } from '@/lib/posthog';

const STORAGE_KEY = 'gi_pending_signup_grant';

export function captureSignupGrantFromUrl() {
  if (typeof window === 'undefined') return;
  try {
    const url = new URL(window.location.href);
    const token = url.searchParams.get('grant');
    if (token) {
      window.localStorage.setItem(STORAGE_KEY, token);
      url.searchParams.delete('grant');
      // Tidy up the URL so refreshes don't re-trigger.
      window.history.replaceState({}, '', url.toString());
    }
  } catch {
    // ignore ,  best-effort
  }
}

export function readPendingSignupGrant() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function clearPendingSignupGrant() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export async function applyPendingSignupGrant() {
  const token = readPendingSignupGrant();
  if (!token) return null;
  try {
    const { data, error } = await supabase.rpc('redeem_signup_grant', { p_token: token });
    if (error) {
      console.warn('[signup-grant] rpc error', error);
      return null;
    }
    if (data?.ok) {
      clearPendingSignupGrant();
      captureEvent('store_signup_grant_redeemed', {
        tier: data.tier,
        duration_days: data.duration_days,
      });
      return data;
    }
    if (data?.reason && ['already_redeemed', 'expired', 'voided', 'token_not_found'].includes(data.reason)) {
      clearPendingSignupGrant();
    }
    return data;
  } catch (e) {
    console.warn('[signup-grant] apply failed', e);
    return null;
  }
}

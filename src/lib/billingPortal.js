/**
 * openBillingPortal, client wrapper for the `stripe-billing-portal`
 * Supabase edge function.
 *
 * Asks the function for a Stripe Customer Portal URL for the signed-in
 * member and sends the browser there. The portal is where members
 * change cards, switch plans, download invoices, and cancel.
 *
 * Errors carry `code`:
 *   'no_billing_account'  no Stripe customer on the profile yet
 *   'grandfathered'       comped Breeder, nothing to manage
 *   'lifetime'            one-time purchase, no recurring billing
 *   'unauthenticated'     session expired
 *   'portal_unavailable'  Stripe refused (portal not activated, etc.)
 */
import { supabase } from '@/lib/supabaseClient';

export async function openBillingPortal({ returnPath = '/Membership' } = {}) {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://geckinspect.com';
  const { data, error } = await supabase.functions.invoke('stripe-billing-portal', {
    body: { returnUrl: `${origin}${returnPath}` },
  });

  if (error) {
    // FunctionsHttpError hides the JSON body behind error.context.
    const ctx = error.context;
    const status = ctx && typeof ctx.status === 'number' ? ctx.status : null;
    let detail = error.message;
    if (ctx && typeof ctx.text === 'function') {
      try {
        const body = await ctx.text();
        detail = body || detail;
      } catch {
        // ignore, keep the generic message
      }
    }
    let parsed = null;
    try {
      parsed = JSON.parse(detail);
    } catch {
      // not JSON
    }
    const err = new Error(parsed?.message || parsed?.error || detail || 'Billing portal unavailable');
    err.code = parsed?.error || (status === 401 ? 'unauthenticated' : 'portal_unavailable');
    err.status = status;
    throw err;
  }

  if (!data?.url) {
    const err = new Error(data?.message || data?.error || 'Billing portal did not return a URL');
    err.code = data?.error || 'portal_unavailable';
    throw err;
  }

  window.location.href = data.url;
  return data.url;
}

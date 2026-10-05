import { supabase } from '@/lib/supabaseClient';

// Calls the Supabase edge function `recognize-gecko-morph`, which routes
// to Claude vision, clamps the output to our canonical taxonomy, and
// debits one MorphID credit from the user's monthly allotment (admins
// are exempt). See supabase/functions/recognize-gecko-morph/index.ts and
// supabase/migrations/20260516011246_morph_id_credits.sql.
//
// Accepts either { imageUrl: string } or { imageUrls: string[] } (up to 5).
// Optional ageStage (hatchling | juvenile | subadult | adult | unknown) and
// firedState feed the prompt so the model weighs traits in context.
// Claude synthesizes across multiple photos of the same gecko.
//
// Resolved error shape (for upstream UI):
//   { code: 'morph_id_credits_exhausted' | 'upstream_rate_limited' |
//           'upstream_error' | 'upstream_timeout' | 'morph_id_in_progress' |
//           'auth_required' | 'bad_request' |
//           'credit_check_failed' | 'internal_error',
//     message: string,
//     tier?, credits_included?, status? }
async function readEdgeError(error) {
  if (error?.context?.name === 'AbortError') {
    return {
      code: 'request_timeout',
      message: 'Morph ID exceeded the client request deadline.',
    };
  }
  let detail = error.message;
  let parsed = null;
  const ctx = error.context;
  if (ctx && typeof ctx.text === 'function') {
    try {
      const body = await ctx.text();
      if (body) {
        try { parsed = JSON.parse(body); detail = parsed?.error || body; }
        catch { detail = body; }
      }
    } catch { /* ignore */ }
  }
  return {
    code: parsed?.code || (error?.name === 'FunctionsFetchError' ? 'network_error' : 'internal_error'),
    message: detail,
    tier: parsed?.tier,
    credits_included: parsed?.credits_included,
    status: ctx?.status,
  };
}

export async function recognizeGeckoMorph({ imageUrl, imageUrls, ageStage, firedState, requestKey } = {}) {
  const urls = Array.isArray(imageUrls) && imageUrls.length
    ? imageUrls
    : imageUrl ? [imageUrl] : [];
  if (urls.length === 0) {
    return { data: null, error: { code: 'bad_request', message: 'imageUrl(s) required' } };
  }

  const body = { imageUrls: urls };
  if (typeof ageStage === 'string' && ageStage) body.age_stage = ageStage;
  if (typeof firedState === 'string' && firedState) body.fired_state = firedState;
  // Same key for a retry of the same photos: the server answers a repeat
  // from the stored result (or says it is still running) without a second
  // credit. Ignored by a server without the morph_id_requests table.
  if (typeof requestKey === 'string' && requestKey) body.request_key = requestKey;

  const { data, error } = await supabase.functions.invoke('recognize-gecko-morph', {
    body,
  });
  if (error) {
    return { data: null, error: await readEdgeError(error) };
  }
  if (data?.error) {
    return {
      data: null,
      error: {
        code: data.code || 'internal_error',
        message: data.error,
        tier: data.tier,
        credits_included: data.credits_included,
      },
    };
  }
  return {
    data: data?.analysis || data,
    meta: {
      tier: data?.tier,
      is_admin: data?.is_admin,
      credits_included: data?.credits_included,
      credits_remaining: data?.credits_remaining,
      credit_refunded: data?.credit_refunded === true,
      replayed: data?.replayed === true,
      value_estimate_included: data?.value_estimate_included,
    },
    error: null,
  };
}

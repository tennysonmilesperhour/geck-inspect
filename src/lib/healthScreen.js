/**
 * Client helper for the AI photo health screen.
 *
 * Calls the deployed `health-screen` Supabase edge function, which sends
 * the gecko's photo to Claude vision and returns OBSERVATIONS (body
 * condition, shed, visible concerns), never a diagnosis. See
 * supabase/functions/health-screen/index.ts for the server contract.
 *
 * METERING: the edge function consumes the health_screen credit
 * server-side via the feature_usage ledger. The client must NOT call
 * consumeFeatureCredit for this feature, that would double-charge the
 * user (one debit here, one on the server). The UI may read the ledger
 * with getFeatureUsage('health_screen') for "N of M left" hints, which
 * is read-only and safe.
 *
 * Server responses:
 *   200 -> { observations: [{ area, finding, severity, note }],
 *            overall_note, disclaimer, credits_remaining }
 *        severity is one of 'looks_typical' | 'worth_watching' | 'see_a_vet'
 *   402 -> { code: 'health_screen_credits_exhausted', tier, included }
 *        supabase.functions.invoke surfaces non-2xx as a FunctionsHttpError
 *        whose useful body hides inside error.context, so we read it
 *        defensively below.
 */
import { supabase } from '@/lib/supabaseClient';
import { canonicalizeMorphTags } from '@/lib/genetics';

const FALLBACK_DISCLAIMER =
  'This is an observational husbandry screen, not a veterinary diagnosis. ' +
  'When in doubt, see an exotics vet.';

/** The photo the screen reviews: the gecko's first (primary) photo. */
export function firstPhotoUrl(gecko) {
  const urls = Array.isArray(gecko?.image_urls) ? gecko.image_urls.filter(Boolean) : [];
  return urls[0] || null;
}

/**
 * Pull the real error body out of a FunctionsHttpError. Supabase's invoke
 * wrapper reports a generic message and stashes the Response on
 * error.context; the JSON body there carries the machine-readable `code`
 * (e.g. 'health_screen_credits_exhausted').
 */
async function readEdgeError(error) {
  let message = error?.message || 'Health screen failed.';
  let parsed = null;
  const ctx = error?.context;
  if (ctx && typeof ctx.text === 'function') {
    try {
      const body = await ctx.text();
      if (body) {
        try {
          parsed = JSON.parse(body);
          message = parsed?.error || body;
        } catch {
          message = body;
        }
      }
    } catch {
      /* keep the generic message */
    }
  }
  return {
    code: parsed?.code || 'internal_error',
    message,
    tier: parsed?.tier,
    included: parsed?.included,
    status: ctx?.status,
  };
}

function normalizedFailure(parsed) {
  return {
    ok: false,
    exhausted: parsed.code === 'health_screen_credits_exhausted',
    error: parsed.message,
    code: parsed.code,
    tier: parsed.tier,
    included: parsed.included,
    observations: [],
    overallNote: '',
    disclaimer: FALLBACK_DISCLAIMER,
    creditsRemaining: null,
  };
}

/**
 * Run the health screen for a gecko record.
 *
 * Builds the animal context (name, hatch_date, weight_grams, morph tags
 * canonicalized through the genetics adapter so 'Lily White' and
 * 'Lilly White' read the same to the model), invokes the edge function,
 * and normalizes every outcome into one shape:
 *
 *   { ok, exhausted, error?, observations, overallNote, disclaimer,
 *     creditsRemaining, tier?, included? }
 *
 * - ok: true        -> observations/overallNote/disclaimer are populated
 * - exhausted: true -> monthly cap hit (HTTP 402), show the upgrade CTA
 * - otherwise       -> error holds a human-readable message
 */
export async function runHealthScreen(gecko) {
  const imageUrl = firstPhotoUrl(gecko);
  if (!imageUrl) {
    return normalizedFailure({
      code: 'no_photo',
      message: 'Add a photo of this gecko first, then run the health check.',
    });
  }

  const context = {
    name: gecko?.name || null,
    hatch_date: gecko?.hatch_date || null,
    weight_grams: gecko?.weight_grams ?? null,
    morphs: canonicalizeMorphTags(gecko?.morph_tags || []) || [],
  };

  let data;
  let error;
  try {
    ({ data, error } = await supabase.functions.invoke('health-screen', {
      body: { image_url: imageUrl, context },
    }));
  } catch (err) {
    return normalizedFailure({
      code: 'network_error',
      message: err?.message || 'Could not reach the health screen service.',
    });
  }

  if (error) {
    return normalizedFailure(await readEdgeError(error));
  }
  // Some edge failures come back as 200 + { error, code } payloads.
  if (data?.error) {
    return normalizedFailure({
      code: data.code || 'internal_error',
      message: data.error,
      tier: data.tier,
      included: data.included,
    });
  }

  return {
    ok: true,
    exhausted: false,
    error: null,
    observations: Array.isArray(data?.observations) ? data.observations : [],
    overallNote: data?.overall_note || '',
    disclaimer: data?.disclaimer || FALLBACK_DISCLAIMER,
    creditsRemaining: data?.credits_remaining ?? null,
  };
}

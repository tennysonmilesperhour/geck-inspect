// How the daily canary labels a Morph ID failure.
//
// A provider credit or billing failure (Anthropic: "Your credit balance is
// too low ... Plans & Billing") is not a bug in this repo. The check still
// fails, so the morning email goes out, but the label is separate from an
// application failure. Keep the test in scripts/canary/__tests__ in step
// with isProviderBillingFailure in supabase/functions/_shared/morph-upstream.ts.

export function isProviderBillingFailure(detail) {
  const text = String(detail || '');
  if (/credit balance/i.test(text)) return true;
  return /billing/i.test(text) && /too low/i.test(text);
}

/**
 * @returns {{ ok: boolean, kind: 'ok' | 'provider_billing' | 'application' }}
 */
export function classifyMorphIdFailure({ status, payload } = {}) {
  const body = payload && typeof payload === 'object' ? payload : {};
  const analysis = body.analysis && typeof body.analysis === 'object' ? body.analysis : {};
  const ok = status === 200
    && body.success === true
    && typeof analysis.primary_morph === 'string'
    && analysis.primary_morph.length > 0
    && typeof analysis.assessment_status === 'string';
  if (ok) return { ok: true, kind: 'ok' };

  const text = [body.error, body.message, body.detail]
    .filter((part) => typeof part === 'string')
    .join(' ');
  if (body.failure_kind === 'provider_billing' || isProviderBillingFailure(text)) {
    return { ok: false, kind: 'provider_billing' };
  }
  return { ok: false, kind: 'application' };
}

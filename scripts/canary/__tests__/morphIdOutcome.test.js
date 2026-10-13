import { describe, expect, it } from 'vitest';
import { classifyMorphIdFailure, isProviderBillingFailure } from '../morphIdOutcome.mjs';

const CREDIT_BODY = 'Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits.';

describe('daily canary Morph ID outcomes', () => {
  it('labels a low credit balance as a provider billing error', () => {
    const outcome = classifyMorphIdFailure({
      status: 502,
      payload: {
        code: 'analyzer_unavailable',
        error: `Anthropic 400: ${CREDIT_BODY}`,
        user_message: 'Morph ID is temporarily unavailable, try again later',
      },
    });
    expect(outcome).toEqual({ ok: false, kind: 'provider_billing' });
    expect(isProviderBillingFailure(CREDIT_BODY)).toBe(true);
  });

  it('honors an explicit provider_billing kind from the function', () => {
    const outcome = classifyMorphIdFailure({
      status: 502,
      payload: { failure_kind: 'provider_billing', error: 'redacted' },
    });
    expect(outcome.kind).toBe('provider_billing');
  });

  it('labels other analyzer failures as application failures', () => {
    expect(classifyMorphIdFailure({
      status: 502,
      payload: { code: 'upstream_error', error: 'Anthropic 500: internal' },
    })).toEqual({ ok: false, kind: 'application' });

    expect(classifyMorphIdFailure({
      status: 0,
      payload: { error: 'timed out after 125s' },
    })).toEqual({ ok: false, kind: 'application' });

    expect(classifyMorphIdFailure({
      status: 500,
      payload: { code: 'internal_error', error: 'credit check failed: relation missing' },
    }).kind).toBe('application');
  });

  it('does not call a successful identification a billing failure', () => {
    const outcome = classifyMorphIdFailure({
      status: 200,
      payload: {
        success: true,
        analysis: { primary_morph: 'Lilly White', assessment_status: 'confident' },
      },
    });
    expect(outcome).toEqual({ ok: true, kind: 'ok' });
  });

  it('does not treat a mention of billing without a low balance as provider billing', () => {
    expect(isProviderBillingFailure('billing portal schema mismatch')).toBe(false);
    expect(classifyMorphIdFailure({
      status: 400,
      payload: { error: 'billing portal schema mismatch' },
    }).kind).toBe('application');
  });
});
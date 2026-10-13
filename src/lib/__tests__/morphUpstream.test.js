import { describe, expect, it } from 'vitest';
import {
  PROVIDER_UNAVAILABLE_MESSAGE,
  RETRYABLE_UPSTREAM_STATUS,
  isProviderBillingFailure,
  requestShape,
  upstreamErrorCode,
  upstreamFailureResponse,
} from '../../../supabase/functions/_shared/morph-upstream.ts';

describe('upstreamErrorCode', () => {
  it('reads overload and rate limits as busy', () => {
    expect(upstreamErrorCode(429, '')).toBe('upstream_rate_limited');
    expect(upstreamErrorCode(529, '{"type":"overloaded_error"}')).toBe('upstream_rate_limited');
  });

  it('tells the member when a photo cannot be read, since a retry never helps', () => {
    expect(upstreamErrorCode(400, '{"error":{"message":"messages.0.content.3.image.source: media type image/avif is not supported"}}')).toBe('image_unreadable');
    expect(upstreamErrorCode(400, 'image exceeds 5 MB maximum')).toBe('image_unreadable');
  });

  it('says the analyzer is unavailable when the account is out of credit', () => {
    expect(upstreamErrorCode(400, '{"error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API."}}')).toBe('analyzer_unavailable');
    expect(upstreamErrorCode(401, 'invalid x-api-key')).toBe('analyzer_unavailable');
  });

  it('keeps other failures generic', () => {
    expect(upstreamErrorCode(400, 'invalid tool schema')).toBe('upstream_error');
    expect(upstreamErrorCode(500, 'internal')).toBe('upstream_error');
    expect(upstreamErrorCode(400, 'billing portal schema mismatch')).toBe('upstream_error');
  });

  it('treats a low credit balance as a provider billing failure', () => {
    const anthropic = '400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API. Please go to Plans & Billing to upgrade or purchase credits."}}';
    expect(isProviderBillingFailure(anthropic)).toBe(true);
    expect(isProviderBillingFailure('billing too low to continue')).toBe(true);
    expect(isProviderBillingFailure('invalid tool schema')).toBe(false);
    expect(isProviderBillingFailure('billing portal schema mismatch')).toBe(false);
  });

  it('returns a member-safe message and reports whether the scan was handed back', () => {
    const billing = upstreamFailureResponse({
      code: 'analyzer_unavailable',
      diagnostic: 'Anthropic 400: Your credit balance is too low to access the Anthropic API.',
      creditRefunded: true,
    });
    expect(billing.user_message).toBe(PROVIDER_UNAVAILABLE_MESSAGE);
    expect(billing.failure_kind).toBe('provider_billing');
    expect(billing.credit_refunded).toBe(true);
    expect(billing.error).toContain('credit balance is too low');

    const down = upstreamFailureResponse({
      code: 'upstream_error',
      diagnostic: 'Anthropic 502: bad gateway',
      creditRefunded: true,
    });
    expect(down.user_message).toBe('Morph ID is temporarily unavailable, try again later');
    expect(down.failure_kind).toBe('provider_unavailable');

    const timedOut = upstreamFailureResponse({
      code: 'upstream_timeout',
      diagnostic: 'Analyzer timed out',
      creditRefunded: false,
    });
    expect(timedOut.user_message).toBe(PROVIDER_UNAVAILABLE_MESSAGE);
    expect(timedOut.credit_refunded).toBe(false);

    const photo = upstreamFailureResponse({
      code: 'image_unreadable',
      diagnostic: 'media type image/avif is not supported',
      creditRefunded: true,
    });
    expect(photo.user_message).toBeUndefined();
    expect(photo.credit_refunded).toBe(true);
    expect(photo.failure_kind).toBe('application');
  });

  it('retries only transient statuses', () => {
    for (const status of [429, 500, 502, 503, 504, 529]) expect(RETRYABLE_UPSTREAM_STATUS.has(status)).toBe(true);
    for (const status of [400, 401, 403, 404, 413]) expect(RETRYABLE_UPSTREAM_STATUS.has(status)).toBe(false);
  });
});

describe('requestShape', () => {
  it('keeps forcing the tool on models that allow it', () => {
    const shape = requestShape('claude-sonnet-4-6', 'submit_morph_analysis');
    expect(shape.toolChoice).toEqual({ type: 'tool', name: 'submit_morph_analysis' });
    expect(shape.outputConfig).toBeUndefined();
    expect(shape.callInstruction).toBe('');
  });

  it('uses auto plus an instruction on models that reject a forced tool', () => {
    for (const model of ['claude-sonnet-5-5', 'claude-opus-5-5']) {
      const shape = requestShape(model, 'submit_morph_analysis');
      expect(shape.toolChoice).toEqual({ type: 'auto' });
      expect(shape.callInstruction).toContain('submit_morph_analysis');
      expect(shape.maxTokens).toBeGreaterThan(3000);
      expect(shape.outputConfig).toEqual({ effort: 'medium' });
    }
  });
});

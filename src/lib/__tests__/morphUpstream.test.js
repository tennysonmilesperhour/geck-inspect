import { describe, expect, it } from 'vitest';
import { RETRYABLE_UPSTREAM_STATUS, upstreamErrorCode } from '../../../supabase/functions/_shared/morph-upstream.ts';

describe('upstreamErrorCode', () => {
  it('reads overload and rate limits as busy', () => {
    expect(upstreamErrorCode(429, '')).toBe('upstream_rate_limited');
    expect(upstreamErrorCode(529, '{"type":"overloaded_error"}')).toBe('upstream_rate_limited');
  });

  it('tells the member when a photo cannot be read, since a retry never helps', () => {
    expect(upstreamErrorCode(400, '{"error":{"message":"messages.0.content.3.image.source: media type image/avif is not supported"}}')).toBe('image_unreadable');
    expect(upstreamErrorCode(400, 'image exceeds 5 MB maximum')).toBe('image_unreadable');
  });

  it('keeps other failures generic', () => {
    expect(upstreamErrorCode(400, 'invalid tool schema')).toBe('upstream_error');
    expect(upstreamErrorCode(500, 'internal')).toBe('upstream_error');
  });

  it('retries only transient statuses', () => {
    for (const status of [429, 500, 502, 503, 504, 529]) expect(RETRYABLE_UPSTREAM_STATUS.has(status)).toBe(true);
    for (const status of [400, 401, 403, 404, 413]) expect(RETRYABLE_UPSTREAM_STATUS.has(status)).toBe(false);
  });
});

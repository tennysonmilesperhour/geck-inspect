import { describe, expect, it } from 'vitest';
import {
  PROVIDER_UNAVAILABLE_MESSAGE,
  morphIdErrorSettledQuota,
  presentMorphIdError,
} from '../morphIdErrors';

const UNAVAILABLE = 'Morph ID is temporarily unavailable, try again later';

describe('presentMorphIdError', () => {
  it('uses one temporary-unavailable sentence for provider failures', () => {
    for (const code of ['upstream_error', 'upstream_timeout', 'analyzer_unavailable', 'network_error', 'request_timeout']) {
      const copy = presentMorphIdError({ code });
      expect(copy.title).toBe(UNAVAILABLE);
      expect(copy.title).toBe(PROVIDER_UNAVAILABLE_MESSAGE);
      expect(copy.title).not.toMatch(/\u2014|\u2013/);
      expect(copy.body).not.toMatch(/\u2014|\u2013/);
    }
  });

  it('tells the member a provider failure did not use the scan', () => {
    for (const code of ['upstream_error', 'upstream_timeout', 'analyzer_unavailable']) {
      expect(presentMorphIdError({ code, credit_refunded: true }).body).toMatch(/Nothing was charged/);
    }
  });

  it('does not promise a refund the server could not finish', () => {
    const copy = presentMorphIdError({ code: 'analyzer_unavailable', credit_refunded: false });
    expect(copy.title).toBe(UNAVAILABLE);
    expect(copy.body).not.toMatch(/Nothing was charged/);
  });

  it('only promises refunds for confirmed provider, photo, and internal failures', () => {
    for (const code of ['upstream_error', 'upstream_timeout', 'upstream_rate_limited', 'analyzer_unavailable', 'image_unreadable', 'internal_error']) {
      const confirmedCopy = presentMorphIdError({ code, credit_refunded: true }).body;
      expect(confirmedCopy).toMatch(/Nothing was charged|refunded automatically|No credit was used/);
      for (const confirmation of [false, undefined]) {
        const copy = presentMorphIdError({ code, credit_refunded: confirmation });
        expect(copy.body).toMatch(/could not confirm whether a scan was returned/);
        expect(copy.body).not.toMatch(/Nothing was charged|refunded automatically|No credit was used/);
      }
    }
  });

  it('keeps a busy analyzer distinct from an outage', () => {
    const copy = presentMorphIdError({ code: 'upstream_rate_limited' });
    expect(copy.title).toBe('Our AI is busy right now');
    expect(copy.body).toMatch(/could not confirm whether a scan was returned/);
    expect(copy.retryable).toBe(true);
  });

  it('lets a member retry a provider outage', () => {
    expect(presentMorphIdError({ code: 'analyzer_unavailable' }).retryable).toBe(true);
    expect(presentMorphIdError({ code: 'auth_required' }).retryable).toBe(false);
  });

  it('does not offer another try when the free identification is used', () => {
    const copy = presentMorphIdError(
      { code: 'morph_id_credits_exhausted' },
      { isFreeTier: true, bonus: 0, keeperCredits: 3 },
    );
    expect(copy.title).toBe("You have used this month's free Morph ID");
    expect(copy.retryable).toBe(false);
  });
});

describe('morphIdErrorSettledQuota', () => {
  it('reloads the scan count after a refunded provider failure', () => {
    expect(morphIdErrorSettledQuota({ code: 'analyzer_unavailable', credit_refunded: true })).toBe(true);
    expect(morphIdErrorSettledQuota({ code: 'upstream_error' })).toBe(true);
    expect(morphIdErrorSettledQuota({ code: 'upstream_timeout' })).toBe(true);
  });

  it('does not reload while a client timeout may still be running', () => {
    expect(morphIdErrorSettledQuota({ code: 'request_timeout' })).toBe(false);
    expect(morphIdErrorSettledQuota({ code: 'network_error' })).toBe(false);
    expect(morphIdErrorSettledQuota({ code: 'network_error', credit_refunded: true })).toBe(true);
  });
});

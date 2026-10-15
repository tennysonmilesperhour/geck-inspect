import { describe, it, expect } from 'vitest';
import { sanitizeUrl } from './ga';

describe('sanitizeUrl', () => {
  it('drops everything after # so sign-in tokens never reach analytics', () => {
    expect(sanitizeUrl('https://geckinspect.com/#access_token=abc&refresh_token=def'))
      .toBe('https://geckinspect.com/');
  });

  it('redacts token-like query values and member emails', () => {
    expect(sanitizeUrl('/AuthPortal?code=xyz&next=/MyGeckos'))
      .toBe('/AuthPortal?code=redacted&next=/MyGeckos');
    expect(sanitizeUrl('/PublicProfile?email=a@b.com'))
      .toBe('/PublicProfile?email=redacted');
  });

  it('leaves ordinary paths alone', () => {
    expect(sanitizeUrl('/MorphGuide/lilly-white?tab=genetics'))
      .toBe('/MorphGuide/lilly-white?tab=genetics');
  });
});

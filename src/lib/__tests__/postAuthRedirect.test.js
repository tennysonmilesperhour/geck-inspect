import { beforeEach, describe, expect, it } from 'vitest';
import {
  authContinuationPath,
  peekPostAuthRedirect,
  clearPostAuthRedirect,
  redirectFromSearch,
  rememberPostAuthRedirect,
  safeRedirectPath,
  takePostAuthRedirect,
} from '../postAuthRedirect';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

describe('post sign-in redirect', () => {
  beforeEach(() => store.clear());

  it('accepts only paths inside the app', () => {
    expect(safeRedirectPath('/claim/abc')).toBe('/claim/abc');
    expect(safeRedirectPath('https://evil.example')).toBeNull();
    expect(safeRedirectPath('//evil.example')).toBeNull();
    expect(safeRedirectPath('/\\evil.example')).toBeNull();
    expect(safeRedirectPath('/AuthPortal?mode=signup')).toBeNull();
    expect(safeRedirectPath(null)).toBeNull();
    for (const unsafe of ['/\\evil.example', '/%2fevil.example', '/%255cevil.example', '/x\n/evil', '/%00evil']) expect(safeRedirectPath(unsafe)).toBeNull();
  });

  it('reads ?redirect= and ?next= (encoded or not)', () => {
    expect(redirectFromSearch('?mode=signup&redirect=/claim/abc')).toBe('/claim/abc');
    expect(redirectFromSearch(`?next=${encodeURIComponent('/collection-invite/t1')}`)).toBe('/collection-invite/t1');
    expect(redirectFromSearch('?mode=signup')).toBeNull();
  });

  it('carries a validated return path in verification and recovery callbacks', () => {
    expect(authContinuationPath('/claim/token')).toBe('/AuthPortal?redirect=%2Fclaim%2Ftoken');
    expect(authContinuationPath('/claim/token', { reset: true })).toBe('/AuthPortal?mode=reset&redirect=%2Fclaim%2Ftoken');
    expect(authContinuationPath('//evil.test')).toBe('/AuthPortal');
  });

  it('keeps continuation for retries throughout the transfer lifetime', () => {
    rememberPostAuthRedirect('/claim/token', 1000);
    expect(peekPostAuthRedirect(1000 + 48 * 3600 * 1000)).toBe('/claim/token');
    expect(peekPostAuthRedirect(1000 + 48 * 3600 * 1000)).toBe('/claim/token');
    clearPostAuthRedirect();
    expect(peekPostAuthRedirect(2000)).toBeNull();
  });

  it('hands the saved target back once, and forgets stale ones', () => {
    rememberPostAuthRedirect('/claim/abc', 1000);
    expect(takePostAuthRedirect(2000)).toBe('/claim/abc');
    expect(takePostAuthRedirect(3000)).toBeNull();
    rememberPostAuthRedirect('/claim/abc', 0);
    expect(takePostAuthRedirect(4 * 24 * 60 * 60 * 1000)).toBeNull();
    rememberPostAuthRedirect('https://evil.example', 1000);
    expect(takePostAuthRedirect(2000)).toBeNull();
  });
});

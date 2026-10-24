import { describe, expect, it, vi } from 'vitest';
import {
  WEB_AUTH_FLOW,
  completeEmailLink,
  completeLegacyTokenLink,
  destinationFor,
  isPkceLinkFromAnotherBrowser,
  nativeHandoff,
  readEmailLink,
} from '../emailLinkAuth';
import { parseNativeAuthCallback } from '../nativeAuth';

// Review item E3 31, "PKCE on web". The website stays on the implicit flow
// until the Supabase email templates send token links, because a default
// PKCE email link only works in the browser that asked for it. These tests
// pin that decision and the token-link handling that makes the switch safe.

const ORIGIN = 'https://geckinspect.com';

function fakeWindow(href, stored = {}) {
  const url = new URL(href);
  const data = new Map(Object.entries(stored));
  return {
    location: {
      origin: url.origin,
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      replace: vi.fn(),
    },
    history: { state: null, replaceState: vi.fn() },
    localStorage: {
      get length() {
        return data.size;
      },
      key: (i) => [...data.keys()][i] ?? null,
      getItem: (k) => (data.has(k) ? data.get(k) : null),
    },
  };
}

const client = (result = { error: null }) => ({
  auth: { verifyOtp: vi.fn(async () => result), setSession: vi.fn(async () => ({ error: null })) },
});

describe('the website flow', () => {
  it('stays implicit until the email templates send token links', () => {
    expect(WEB_AUTH_FLOW).toBe('implicit');
  });

  it('is what the Supabase client is created with on the web, and the apps keep PKCE', async () => {
    vi.resetModules();
    const createClient = vi.fn(() => ({ auth: {} }));
    vi.doMock('@supabase/supabase-js', () => ({ createClient }));
    await import('../supabaseClient');
    expect(createClient.mock.calls[0][2].auth.flowType).toBe(WEB_AUTH_FLOW);
    vi.doUnmock('@supabase/supabase-js');
  });
});

describe('reading a token link', () => {
  it('accepts the email link types and ignores everything else', () => {
    expect(readEmailLink('?token_hash=abc&type=recovery&next=https://geckinspect.com/AuthPortal?mode=reset'))
      .toEqual({ tokenHash: 'abc', type: 'recovery', next: 'https://geckinspect.com/AuthPortal?mode=reset' });
    for (const type of ['signup', 'email', 'magiclink', 'invite', 'email_change']) {
      expect(readEmailLink(`?token_hash=abc&type=${type}`)?.type).toBe(type);
    }
    expect(readEmailLink('?token_hash=abc&type=sms')).toBeNull();
    expect(readEmailLink('?type=recovery')).toBeNull();
    expect(readEmailLink('?code=xyz')).toBeNull();
  });

  it('sends resets and invites to the new-password form, and confirmations where the sign-up asked', () => {
    expect(destinationFor({ type: 'recovery', next: '' }, ORIGIN)).toBe('/AuthPortal?mode=reset');
    expect(destinationFor({ type: 'invite', next: '' }, ORIGIN)).toBe('/AuthPortal?mode=reset');
    expect(destinationFor({ type: 'email_change', next: '' }, ORIGIN)).toBe('/Settings');
    expect(destinationFor({ type: 'email', next: 'https://geckinspect.com/MyGeckos' }, ORIGIN)).toBe('/MyGeckos');
    expect(destinationFor({ type: 'email', next: 'https://geckinspect.com/claim/abc' }, ORIGIN)).toBe('/claim/abc');
    expect(destinationFor({ type: 'signup', next: '' }, ORIGIN)).toBe('/MyGeckos');
  });

  it('never sends anyone to another site', () => {
    expect(destinationFor({ type: 'email', next: 'https://evil.example/steal' }, ORIGIN)).toBe('/MyGeckos');
    expect(destinationFor({ type: 'email', next: '//evil.example/x' }, ORIGIN)).toBe('/MyGeckos');
    expect(destinationFor({ type: 'email', next: 'javascript:alert(1)' }, ORIGIN)).toBe('/MyGeckos');
  });

  it('passes a link the app asked for on to the app', () => {
    expect(nativeHandoff({ tokenHash: 'abc', type: 'recovery', next: 'com.geckinspect.app://auth/callback?mode=reset' }))
      .toBe('com.geckinspect.app://auth/callback?mode=reset&token_hash=abc&type=recovery');
    expect(nativeHandoff({ tokenHash: 'abc', type: 'email', next: 'com.geckinspect.app://auth/callback' }))
      .toBe('com.geckinspect.app://auth/callback?token_hash=abc&type=email');
    expect(nativeHandoff({ tokenHash: 'abc', type: 'email', next: 'https://geckinspect.com/MyGeckos' })).toBeNull();
    expect(parseNativeAuthCallback('com.geckinspect.app://auth/callback?mode=reset&token_hash=abc&type=recovery'))
      .toMatchObject({ tokenHash: 'abc', type: 'recovery', recovery: true, failed: false });
  });
});

describe('finishing a token link', () => {
  it('checks the token with Supabase and moves on with a full load', async () => {
    const win = fakeWindow('https://geckinspect.com/AuthPortal?token_hash=hash1&type=recovery&next=https://geckinspect.com/AuthPortal?mode=reset');
    const sb = client();
    expect(await completeEmailLink(sb, win)).toBe('done');
    expect(sb.auth.verifyOtp).toHaveBeenCalledWith({ token_hash: 'hash1', type: 'recovery' });
    expect(win.location.replace).toHaveBeenCalledWith('/AuthPortal?mode=reset');
  });

  it('says so on the sign-in page when the link has expired', async () => {
    const win = fakeWindow('https://geckinspect.com/AuthPortal?token_hash=old&type=recovery');
    expect(await completeEmailLink(client({ error: { message: 'Token has expired or is invalid' } }), win)).toBe('failed');
    expect(win.location.replace).toHaveBeenCalledWith('/AuthPortal?authError=link&mode=reset');
  });

  it('hands an app link to the app without checking it in the browser', async () => {
    const win = fakeWindow('https://geckinspect.com/AuthPortal?token_hash=h&type=email&next=com.geckinspect.app://auth/callback');
    const sb = client();
    expect(await completeEmailLink(sb, win)).toBe('native');
    expect(sb.auth.verifyOtp).not.toHaveBeenCalled();
    expect(win.location.replace).toHaveBeenCalledWith('com.geckinspect.app://auth/callback?token_hash=h&type=email');
  });

  it('does nothing on an ordinary page', async () => {
    const win = fakeWindow('https://geckinspect.com/MorphGuide?tab=genetics');
    const sb = client();
    expect(await completeEmailLink(sb, win)).toBe('none');
    expect(sb.auth.verifyOtp).not.toHaveBeenCalled();
    expect(win.location.replace).not.toHaveBeenCalled();
  });

  it('leaves token links after "#" to Supabase while the website is on the implicit flow', async () => {
    const win = fakeWindow('https://geckinspect.com/MyGeckos#access_token=a&refresh_token=r&type=signup');
    const sb = client();
    expect(await completeLegacyTokenLink(sb, win)).toBe(false);
    expect(sb.auth.setSession).not.toHaveBeenCalled();
  });
});

describe('a PKCE link opened in another browser', () => {
  it('is recognised when this browser holds no code verifier for it', () => {
    expect(isPkceLinkFromAnotherBrowser(fakeWindow('https://geckinspect.com/MyGeckos?code=abc'))).toBe(true);
    expect(isPkceLinkFromAnotherBrowser(fakeWindow('https://geckinspect.com/MyGeckos?code=abc', {
      'sb-mmuglfphhwlaluyfyxsp-auth-token-code-verifier': 'v',
    }))).toBe(false);
    expect(isPkceLinkFromAnotherBrowser(fakeWindow('https://geckinspect.com/MyGeckos?code=abc&sb_flow_id=f1', {
      'sb-mmuglfphhwlaluyfyxsp-auth-token-flow-f1-code-verifier': 'v',
    }))).toBe(false);
    expect(isPkceLinkFromAnotherBrowser(fakeWindow('https://geckinspect.com/MyGeckos'))).toBe(false);
  });
});

describe('where a confirmed member lands with nothing else asked for', () => {
  it('uses the home the caller gives (Today on a phone)', () => {
    expect(destinationFor({ type: 'signup', next: '' }, 'https://geckinspect.com', '/Today')).toBe('/Today');
    expect(destinationFor({ type: 'email', next: 'https://geckinspect.com/claim/abc' }, 'https://geckinspect.com', '/Today')).toBe('/claim/abc');
  });
});


describe('transfer continuation across email verification', () => {
  const callback = ORIGIN + '/AuthPortal?redirect=%2Fclaim%2Fprivate-token';
  it('unwraps the same-site auth callback without needing local storage', () => {
    expect(destinationFor({ type: 'signup', next: callback }, ORIGIN)).toBe('/claim/private-token');
  });
  it('keeps the pending claim through recovery', () => {
    expect(destinationFor({ type: 'recovery', next: callback }, ORIGIN)).toBe('/AuthPortal?mode=reset&redirect=%2Fclaim%2Fprivate-token');
  });
  it('does not accept an external nested return path', () => {
    expect(destinationFor({ type: 'signup', next: ORIGIN + '/AuthPortal?redirect=https%3A%2F%2Fevil.test' }, ORIGIN)).toBe('/MyGeckos');
  });
  it('preserves the transfer when email verification fails on another device', async () => {
    const win = fakeWindow(ORIGIN + '/AuthPortal?token_hash=expired&type=signup&next=' + encodeURIComponent(callback));
    expect(await completeEmailLink(client({ error: { message: 'expired' } }), win)).toBe('failed');
    expect(win.location.replace).toHaveBeenCalledWith('/AuthPortal?authError=link&redirect=%2Fclaim%2Fprivate-token');
  });
  it('reads a validated continuation from a native callback', () => {
    expect(parseNativeAuthCallback('com.geckinspect.app://auth/callback?code=abc&redirect=%2Fclaim%2Fprivate-token').target).toBe('/claim/private-token');
    expect(parseNativeAuthCallback('com.geckinspect.app://auth/callback?code=abc&redirect=https%3A%2F%2Fevil.test').target).toBeNull();
  });
});

// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { BrowserRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  native: vi.fn(() => true),
  addListener: vi.fn(),
  getLaunchUrl: vi.fn(),
  close: vi.fn(),
  exchange: vi.fn(),
  verify: vi.fn(),
}));
vi.mock('../revenuecat', () => ({ isNativePlatform: mocks.native }));
vi.mock('@capacitor/app', () => ({ App: mocks }));
vi.mock('@capacitor/browser', () => ({ Browser: { close: mocks.close } }));
vi.mock('../supabaseLazy', () => ({ getSupabase: async () => ({ auth: { exchangeCodeForSession: mocks.exchange } }) }));
vi.mock('../supabaseClient', () => ({ supabase: { auth: { verifyOtp: mocks.verify } } }));

const callback = 'com.geckinspect.app://auth/callback';
function CurrentRoute() {
  const location = useLocation();
  return <div data-testid="route">{location.pathname + location.search}</div>;
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.native.mockReturnValue(true);
  mocks.getLaunchUrl.mockResolvedValue(undefined);
  mocks.close.mockResolvedValue(undefined);
  mocks.exchange.mockResolvedValue({ error: null });
  mocks.verify.mockResolvedValue({ error: null });
  window.history.replaceState({ idx: 0 }, '', '/AuthPortal');
});
afterEach(cleanup);

async function start(url) {
  mocks.getLaunchUrl.mockResolvedValue(url ? { url } : undefined);
  render(<BrowserRouter><CurrentRoute /></BrowserRouter>);
  const { installNativeAuth } = await import('../nativeAuth');
  await act(() => installNativeAuth());
  return mocks.addListener.mock.calls[0]?.[1];
}

describe('native auth navigation without reloading the webview', () => {
  it('finishes a cold-start confirmation and ignores duplicate native delivery', async () => {
    const handle = await start(`${callback}?code=one-use-code`);
    expect(screen.getByTestId('route').textContent).toBe('/MyGeckos');
    expect(window.history.state).toEqual({ idx: 0 });
    await act(() => handle({ url: `${callback}?code=one-use-code` }));
    expect(mocks.exchange).toHaveBeenCalledExactlyOnceWith('one-use-code');
    expect(mocks.getLaunchUrl).toHaveBeenCalledTimes(1);
  });

  it('handles a link delivered to an already-running app', async () => {
    const handle = await start();
    await act(() => handle({ url: `${callback}?code=warm-code&mode=reset` }));
    expect(screen.getByTestId('route').textContent).toBe('/AuthPortal?mode=reset');
  });

  it('returns a confirmed recipient to the transfer without reloading', async () => {
    await start(`${callback}?code=transfer-code&redirect=%2Fclaim%2Ftest-transfer`);
    expect(screen.getByTestId('route').textContent).toBe('/claim/test-transfer');
    expect(window.history.state).toEqual({ idx: 0 });
  });

  it('keeps the transfer target while a token link opens password recovery', async () => {
    await start(`${callback}?token_hash=recovery-hash&type=recovery&redirect=%2Fclaim%2Ftest-transfer`);
    expect(screen.getByTestId('route').textContent).toBe('/AuthPortal?mode=reset&redirect=%2Fclaim%2Ftest-transfer');
  });

  it('keeps the transfer target when confirmation fails', async () => {
    mocks.exchange.mockResolvedValue({ error: new Error('Expired') });
    await start(`${callback}?code=expired-transfer&redirect=%2Fclaim%2Ftest-transfer`);
    expect(screen.getByTestId('route').textContent).toBe('/AuthPortal?authError=callback&redirect=%2Fclaim%2Ftest-transfer');
  });

  it.each(['signup', 'recovery', 'invite'])('finishes a %s token link', async (type) => {
    await start(`${callback}?token_hash=test-hash&type=${type}`);
    expect(mocks.verify).toHaveBeenCalledWith({ token_hash: 'test-hash', type });
    expect(screen.getByTestId('route').textContent).toBe(type === 'signup' ? '/MyGeckos' : '/AuthPortal?mode=reset');
  });

  it('shows the callback error for an expired code without restarting', async () => {
    mocks.exchange.mockResolvedValue({ error: new Error('Expired') });
    await start(`${callback}?code=expired`);
    expect(screen.getByTestId('route').textContent).toBe('/AuthPortal?authError=callback');
    expect(mocks.exchange).toHaveBeenCalledTimes(1);
    expect(mocks.getLaunchUrl).toHaveBeenCalledTimes(1);
  });

  it('shows the callback error for an invalid token', async () => {
    mocks.verify.mockResolvedValue({ error: new Error('Invalid') });
    await start(`${callback}?token_hash=invalid&type=signup`);
    expect(screen.getByTestId('route').textContent).toBe('/AuthPortal?authError=callback');
  });

  it('ignores unrelated deep links', async () => {
    await start('https://example.com/auth/callback?code=untrusted');
    expect(screen.getByTestId('route').textContent).toBe('/AuthPortal');
    expect(mocks.exchange).not.toHaveBeenCalled();
  });

  it('does not install native listeners on the website', async () => {
    mocks.native.mockReturnValue(false);
    await start();
    expect(mocks.addListener).not.toHaveBeenCalled();
  });
});

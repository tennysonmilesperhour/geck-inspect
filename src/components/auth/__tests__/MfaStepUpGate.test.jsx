// @vitest-environment jsdom
// The sign-in code step (src/components/auth/MfaStepUpGate.jsx): an account
// with a verified authenticator whose session is still aal1 sees the code
// screen instead of the app (admin screens included) until a correct code
// raises it to aal2. Members without an authenticator see the app at once.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({
  aal: { currentLevel: 'aal1', nextLevel: 'aal1' },
  aalPending: null,
  listeners: [],
  auth: { isAuthenticated: true, user: { role: 'user' } },
  calls: [],
  verifyResult: { data: {}, error: null },
  logout: null,
  invalidate: null,
  clearAll: null,
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      mfa: {
        getAuthenticatorAssuranceLevel: () => fx.aalPending || Promise.resolve({ data: fx.aal, error: null }),
        listFactors: async () => ({
          data: { all: [{ id: 'factor-1', factor_type: 'totp', status: 'verified', friendly_name: 'Authenticator app' }] },
          error: null,
        }),
        challenge: async (args) => { fx.calls.push(['challenge', args]); return { data: { id: 'challenge-1' }, error: null }; },
        verify: async (args) => {
          fx.calls.push(['verify', args]);
          // A correct code: Supabase stores a session at aal2.
          if (!fx.verifyResult.error) fx.aal = { currentLevel: 'aal2', nextLevel: 'aal2' };
          return fx.verifyResult;
        },
      },
      onAuthStateChange: (cb) => {
        fx.listeners.push(cb);
        return { data: { subscription: { unsubscribe: () => { fx.listeners = fx.listeners.filter((l) => l !== cb); } } } };
      },
      refreshSession: async () => ({ data: {}, error: null }),
    },
  },
}));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ ...fx.auth, logout: fx.logout }) }));
vi.mock('@/lib/query-client', () => ({ queryClientInstance: { invalidateQueries: (...a) => fx.invalidate(...a) } }));
vi.mock('@/lib/layoutCache', () => ({ dataCache: { clearAll: (...a) => fx.clearAll(...a) } }));

import MfaStepUpGate, { CHECK_TIMEOUT_MS, needsCodeStep } from '@/components/auth/MfaStepUpGate';

installDomHarness();

const App = () => (
  <MfaStepUpGate>
    <h1>Admin Panel</h1>
  </MfaStepUpGate>
);

// An auth event, as Supabase announces it to every listener.
async function announce(event) {
  await act(async () => {
    fx.listeners.forEach((cb) => cb(event, {}));
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
}

beforeEach(() => {
  fx.aal = { currentLevel: 'aal1', nextLevel: 'aal1' };
  fx.aalPending = null;
  fx.listeners = [];
  fx.auth = { isAuthenticated: true, user: { role: 'user' } };
  fx.calls = [];
  fx.verifyResult = { data: {}, error: null };
  fx.logout = vi.fn(async () => {});
  fx.invalidate = vi.fn();
  fx.clearAll = vi.fn();
});

describe('needsCodeStep', () => {
  it('is true only for an aal1 session on an account with a verified authenticator', () => {
    expect(needsCodeStep({ currentLevel: 'aal1', nextLevel: 'aal2' })).toBe(true);
    expect(needsCodeStep({ currentLevel: 'aal2', nextLevel: 'aal2' })).toBe(false);
    expect(needsCodeStep({ currentLevel: 'aal1', nextLevel: 'aal1' })).toBe(false);
    expect(needsCodeStep({ currentLevel: null, nextLevel: null })).toBe(false);
    expect(needsCodeStep(null)).toBe(false);
  });
});

describe('sign-in code step', () => {
  it('shows the app at once to a member without an authenticator', async () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Admin Panel' })).toBeTruthy();
    await act(async () => {});
    expect(screen.getByRole('heading', { name: 'Admin Panel' })).toBeTruthy();
    expect(screen.queryByText('Enter your sign-in code')).toBeNull();
  });

  it('asks an admin with an authenticator for the code before any admin screen, then opens the app at aal2', async () => {
    fx.auth = { isAuthenticated: true, user: { role: 'admin' } };
    fx.aal = { currentLevel: 'aal1', nextLevel: 'aal2' };
    render(<App />);
    // Never the admin screen first, not even while the session is read.
    expect(screen.queryByRole('heading', { name: 'Admin Panel' })).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Enter your sign-in code' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Admin Panel' })).toBeNull();

    const input = await screen.findByLabelText('6-digit code');
    const confirm = screen.getByRole('button', { name: 'Confirm code' });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(input, { target: { value: '123 456' } });
    expect(input.value).toBe('123456');
    fireEvent.click(confirm);
    await waitFor(() => expect(fx.calls).toHaveLength(2));
    expect(fx.calls[0]).toEqual(['challenge', { factorId: 'factor-1' }]);
    expect(fx.calls[1]).toEqual(['verify', { factorId: 'factor-1', challengeId: 'challenge-1', code: '123456' }]);
    expect(fx.invalidate).toHaveBeenCalled();
    expect(fx.clearAll).toHaveBeenCalled();

    // The session is aal2 now, so the gate opens the app.
    expect(await screen.findByRole('heading', { name: 'Admin Panel' })).toBeTruthy();
    expect(screen.queryByText('Enter your sign-in code')).toBeNull();
  });

  it('opens when the code was typed in another tab (Supabase announces the aal2 session)', async () => {
    fx.auth = { isAuthenticated: true, user: { role: 'admin' } };
    fx.aal = { currentLevel: 'aal1', nextLevel: 'aal2' };
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Enter your sign-in code' })).toBeTruthy();
    fx.aal = { currentLevel: 'aal2', nextLevel: 'aal2' };
    await announce('TOKEN_REFRESHED');
    expect(await screen.findByRole('heading', { name: 'Admin Panel' })).toBeTruthy();
  });

  it('says so when the code is wrong and keeps the app closed', async () => {
    fx.auth = { isAuthenticated: true, user: { role: 'admin' } };
    fx.aal = { currentLevel: 'aal1', nextLevel: 'aal2' };
    fx.verifyResult = { data: null, error: { code: 'mfa_verification_failed', message: 'Invalid TOTP code entered' } };
    render(<App />);
    fireEvent.change(await screen.findByLabelText('6-digit code'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm code' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/That code did not work/);
    expect(screen.queryByRole('heading', { name: 'Admin Panel' })).toBeNull();
    expect(fx.invalidate).not.toHaveBeenCalled();
  });

  it('lets the person sign out from the code screen', async () => {
    fx.auth = { isAuthenticated: true, user: { role: 'admin' } };
    fx.aal = { currentLevel: 'aal1', nextLevel: 'aal2' };
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(fx.logout).toHaveBeenCalled();
  });

  it('opens straight away for a session that already passed the code step', async () => {
    fx.auth = { isAuthenticated: true, user: { role: 'admin' } };
    fx.aal = { currentLevel: 'aal2', nextLevel: 'aal2' };
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Admin Panel' })).toBeTruthy();
  });

  it('holds only an admin while the session is read; a member is never held', async () => {
    let release;
    fx.aalPending = new Promise((resolve) => { release = resolve; });
    fx.auth = { isAuthenticated: true, user: { role: 'admin' } };
    const { unmount } = render(<App />);
    expect(screen.queryByRole('heading', { name: 'Admin Panel' })).toBeNull();
    expect(screen.getByRole('status', { name: 'Checking your sign-in' })).toBeTruthy();
    await act(async () => { release({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null }); });
    expect(await screen.findByRole('heading', { name: 'Admin Panel' })).toBeTruthy();
    unmount();

    fx.aalPending = new Promise(() => {});
    fx.auth = { isAuthenticated: true, user: { role: 'user' } };
    render(<App />);
    expect(screen.getByRole('heading', { name: 'Admin Panel' })).toBeTruthy();
  });

  it('opens the app for an admin when the check takes longer than the limit', async () => {
    vi.useFakeTimers();
    try {
      fx.aalPending = new Promise(() => {});
      fx.auth = { isAuthenticated: true, user: { role: 'admin' } };
      render(<App />);
      expect(screen.getByRole('status', { name: 'Checking your sign-in' })).toBeTruthy();
      await act(async () => { vi.advanceTimersByTime(CHECK_TIMEOUT_MS - 100); });
      expect(screen.queryByRole('heading', { name: 'Admin Panel' })).toBeNull();
      await act(async () => { vi.advanceTimersByTime(200); });
      expect(screen.getByRole('heading', { name: 'Admin Panel' })).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does nothing for a signed-out visitor or the demo', async () => {
    fx.auth = { isAuthenticated: false, user: null };
    fx.aal = { currentLevel: 'aal1', nextLevel: 'aal2' };
    render(<App />);
    await act(async () => {});
    expect(screen.getByRole('heading', { name: 'Admin Panel' })).toBeTruthy();
    expect(fx.listeners).toHaveLength(0);
  });
});

// @vitest-environment jsdom
// Settings, Security (src/components/settings/SecurityCard.jsx): adding an
// authenticator app (QR code plus the secret as text), turning it on with
// a first code (mfa.challenge then mfa.verify), and removing one with a
// confirm step on the page, never a browser pop-up.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const QR = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect fill="#000000" width="5" height="5"/></svg>';
const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

const fx = vi.hoisted(() => ({ factors: [], calls: [], verifyResult: null, unenrollResult: null }));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    auth: {
      mfa: {
        listFactors: async () => { fx.calls.push(['listFactors']); return { data: { all: fx.factors }, error: null }; },
        enroll: async (args) => {
          fx.calls.push(['enroll', args]);
          fx.factors = [...fx.factors, { id: 'new-factor', factor_type: 'totp', status: 'unverified', friendly_name: args.friendlyName, created_at: '2026-10-28T12:00:00Z' }];
          return {
            data: { id: 'new-factor', type: 'totp', totp: { qr_code: `data:image/svg+xml;utf-8,${QR}`, secret: SECRET, uri: 'otpauth://totp/Geck%20Inspect:admin?secret=X' } },
            error: null,
          };
        },
        challenge: async (args) => { fx.calls.push(['challenge', args]); return { data: { id: 'challenge-1' }, error: null }; },
        verify: async (args) => {
          fx.calls.push(['verify', args]);
          if (fx.verifyResult) return fx.verifyResult;
          fx.factors = fx.factors.map((f) => (f.id === args.factorId ? { ...f, status: 'verified' } : f));
          return { data: {}, error: null };
        },
        unenroll: async (args) => {
          fx.calls.push(['unenroll', args]);
          if (fx.unenrollResult) return fx.unenrollResult;
          fx.factors = fx.factors.filter((f) => f.id !== args.factorId);
          return { data: { id: args.factorId }, error: null };
        },
      },
      refreshSession: async () => { fx.calls.push(['refreshSession']); return { data: {}, error: null }; },
    },
  },
}));

import SecurityCard from '@/components/settings/SecurityCard';

installDomHarness();

const named = (name) => fx.calls.filter(([n]) => n === name);

beforeEach(() => {
  fx.factors = [];
  fx.calls = [];
  fx.verifyResult = null;
  fx.unenrollResult = null;
});

describe('Settings, Security', () => {
  it('explains what two-factor sign-in is, why, and what to do about a lost phone', async () => {
    render(<SecurityCard />);
    expect(await screen.findByText('Two-factor off')).toBeTruthy();
    expect(screen.getByText(/6-digit code from an authenticator app/)).toBeTruthy();
    expect(screen.getByText(/admin powers/)).toBeTruthy();
    expect(screen.getByText(/If you lose your phone/)).toBeTruthy();
    expect(screen.getByText(/Save it somewhere safe/)).toBeTruthy();
  });

  it('adds an authenticator: QR code and secret, then a first code turns it on', async () => {
    // A setup started earlier and never finished is cleared first.
    fx.factors = [{ id: 'stale', factor_type: 'totp', status: 'unverified', friendly_name: 'old', created_at: '2026-10-27T10:00:00Z' }];
    render(<SecurityCard />);
    fireEvent.click(await screen.findByRole('button', { name: 'Set up an authenticator app' }));

    const qr = await screen.findByAltText('QR code for your authenticator app');
    expect(named('unenroll')).toEqual([['unenroll', { factorId: 'stale' }]]);
    const [, enrollArgs] = named('enroll')[0];
    expect(enrollArgs.factorType).toBe('totp');
    expect(enrollArgs.issuer).toBe('Geck Inspect');
    expect(enrollArgs.friendlyName).toMatch(/^Authenticator app, \d{1,2} [A-Z][a-z]{2} \d{4} \d{2}:\d{2}$/);
    // The QR code is a data: image the CSP allows, re-encoded so "#" is safe.
    expect(qr.getAttribute('src').startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(qr.getAttribute('src')).not.toContain('#');
    expect(decodeURIComponent(qr.getAttribute('src').split(',').slice(1).join(','))).toBe(QR);
    // The secret is shown as text for typing in by hand.
    expect(screen.getByTestId('mfa-secret').textContent).toBe('JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP');

    const turnOn = screen.getByRole('button', { name: 'Turn on two-factor sign-in' });
    expect(turnOn.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Type the 6-digit code/), { target: { value: '654 321' } });
    fireEvent.click(turnOn);

    expect((await screen.findByRole('status')).textContent).toMatch(/Two-factor sign-in is on/);
    expect(named('challenge')).toEqual([['challenge', { factorId: 'new-factor' }]]);
    expect(named('verify')).toEqual([['verify', { factorId: 'new-factor', challengeId: 'challenge-1', code: '654321' }]]);
    expect(await screen.findByText('Two-factor on')).toBeTruthy();
    const list = screen.getByRole('list', { name: 'Authenticator apps' });
    expect(within(list).getByText(/^Authenticator app, /)).toBeTruthy();
    expect(within(list).getByText('Added 28 Oct 2026')).toBeTruthy();
    expect(screen.queryByAltText('QR code for your authenticator app')).toBeNull();
  });

  it('keeps the setup open and says so when the first code is wrong', async () => {
    fx.verifyResult = { data: null, error: { code: 'mfa_verification_failed', message: 'Invalid TOTP code entered' } };
    render(<SecurityCard />);
    fireEvent.click(await screen.findByRole('button', { name: 'Set up an authenticator app' }));
    fireEvent.change(await screen.findByLabelText(/Type the 6-digit code/), { target: { value: '111111' } });
    fireEvent.click(screen.getByRole('button', { name: 'Turn on two-factor sign-in' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/That code did not work/);
    expect(screen.getByAltText('QR code for your authenticator app')).toBeTruthy();
    expect(screen.getByText('Two-factor off')).toBeTruthy();
  });

  it('cancelling a setup removes the half-made authenticator', async () => {
    render(<SecurityCard />);
    fireEvent.click(await screen.findByRole('button', { name: 'Set up an authenticator app' }));
    await screen.findByAltText('QR code for your authenticator app');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(named('unenroll')).toEqual([['unenroll', { factorId: 'new-factor' }]]));
    expect(screen.queryByAltText('QR code for your authenticator app')).toBeNull();
  });

  it('removes an authenticator only after a confirm step on the page', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockImplementation(() => true);
    fx.factors = [{ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'Authenticator app, 1 Oct 2026 09:00', created_at: '2026-10-01T09:00:00Z' }];
    render(<SecurityCard />);
    fireEvent.click(await screen.findByRole('button', { name: /Remove/ }));
    expect(named('unenroll')).toHaveLength(0);
    const confirmBox = screen.getByRole('group', { name: 'Confirm removal' });
    expect(within(confirmBox).getByText(/Remove this authenticator\?/)).toBeTruthy();

    // "Keep it" closes the question and removes nothing.
    fireEvent.click(within(confirmBox).getByRole('button', { name: 'Keep it' }));
    expect(screen.queryByRole('group', { name: 'Confirm removal' })).toBeNull();
    expect(named('unenroll')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: /Remove/ }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Confirm removal' })).getByRole('button', { name: 'Yes, remove it' }));
    await waitFor(() => expect(named('unenroll')).toEqual([['unenroll', { factorId: 'f1' }]]));
    expect(await screen.findByText('Two-factor off')).toBeTruthy();
    expect(named('refreshSession')).toHaveLength(1);
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('explains a removal Supabase refuses before the code step', async () => {
    fx.factors = [{ id: 'f1', factor_type: 'totp', status: 'verified', friendly_name: 'Phone', created_at: '2026-10-01T09:00:00Z' }];
    fx.unenrollResult = { data: null, error: { code: 'insufficient_aal', message: 'AAL2 required' } };
    render(<SecurityCard />);
    fireEvent.click(await screen.findByRole('button', { name: /Remove/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, remove it' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/sign back in with your authenticator code/);
    expect(screen.getByText('Two-factor on')).toBeTruthy();
  });
});

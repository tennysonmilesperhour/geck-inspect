// @vitest-environment jsdom
// The Unsubscribe page (no sign-in): a Weekly Gecko Notes link
// (?t=...&scope=weekly) stops only those emails and offers a second button
// that stops all email, which runs only when clicked; a plain link stops
// all notification email as before. Only the database call is stubbed.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({ calls: [], answer: () => ({ data: true, error: null }) }));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    rpc: (fn, args) => {
      fx.calls.push({ fn, args });
      return Promise.resolve(fx.answer(fn, args));
    },
  },
}));
vi.mock('@/lib/AuthContext', () => ({ useAuth: () => ({ user: null, isAuthenticated: false }) }));
vi.mock('@/lib/posthog', () => ({ captureEvent: vi.fn() }));

import Unsubscribe from '@/pages/Unsubscribe';

installDomHarness();

function renderAt(path) {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Unsubscribe />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

beforeEach(() => {
  fx.calls = [];
  fx.answer = () => ({ data: true, error: null });
});

describe('Unsubscribe page', () => {
  it('a weekly link stops only Weekly Gecko Notes and says so', async () => {
    renderAt('/Unsubscribe?t=p1.sig&scope=weekly');
    expect(screen.getByText('Turning off Weekly Gecko Notes...')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Weekly Gecko Notes are off' })).toBeTruthy();
    expect(screen.getByText(/You will not get the weekly email any more\. Reminders, hatch alerts and the other emails you chose still arrive\. You can turn Weekly Gecko Notes back on in Settings\./)).toBeTruthy();
    expect(fx.calls).toEqual([{ fn: 'unsubscribe_weekly_notes_by_token', args: { p_token: 'p1.sig' } }]);
    expect(screen.getByRole('button', { name: 'Email settings' })).toBeTruthy();
  });

  it('"Stop all Geck Inspect email" calls the all-email unsubscribe only when clicked', async () => {
    const user = userEvent.setup();
    renderAt('/Unsubscribe?t=p1.sig&scope=weekly');
    const stopAll = await screen.findByRole('button', { name: 'Stop all Geck Inspect email' });
    expect(fx.calls.map((c) => c.fn)).toEqual(['unsubscribe_weekly_notes_by_token']);
    await user.click(stopAll);
    expect(await screen.findByRole('heading', { name: 'You are unsubscribed' })).toBeTruthy();
    expect(fx.calls).toEqual([
      { fn: 'unsubscribe_weekly_notes_by_token', args: { p_token: 'p1.sig' } },
      { fn: 'unsubscribe_email_by_token', args: { p_token: 'p1.sig' } },
    ]);
    expect(screen.queryByRole('button', { name: 'Stop all Geck Inspect email' })).toBeNull();
  });

  it('with no scope the page stops all email, as before', async () => {
    renderAt('/Unsubscribe?t=p1.sig');
    expect(screen.getByText('Turning off notification emails...')).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'You are unsubscribed' })).toBeTruthy();
    expect(fx.calls).toEqual([{ fn: 'unsubscribe_email_by_token', args: { p_token: 'p1.sig' } }]);
    expect(screen.queryByRole('button', { name: 'Stop all Geck Inspect email' })).toBeNull();
  });

  it('any other scope is the all-email unsubscribe', async () => {
    renderAt('/Unsubscribe?t=p1.sig&scope=everything');
    await screen.findByRole('heading', { name: 'You are unsubscribed' });
    expect(fx.calls.map((c) => c.fn)).toEqual(['unsubscribe_email_by_token']);
  });

  it('a changed weekly link says it does not work and offers no stop-all button', async () => {
    fx.answer = () => ({ data: false, error: null });
    renderAt('/Unsubscribe?t=bad&scope=weekly');
    expect(await screen.findByRole('heading', { name: 'This link does not work' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Stop all Geck Inspect email' })).toBeNull();
  });

  it('a link with no token asks the database nothing', async () => {
    renderAt('/Unsubscribe?scope=weekly');
    expect(screen.getByRole('heading', { name: 'This link does not work' })).toBeTruthy();
    await waitFor(() => expect(fx.calls).toEqual([]));
  });
});

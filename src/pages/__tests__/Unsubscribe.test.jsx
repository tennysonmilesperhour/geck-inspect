// @vitest-environment jsdom
// The Unsubscribe page (no sign-in): nothing changes until a button is
// pressed, because mail security scanners open every link in an email. A
// Weekly Gecko Notes link (?t=...&scope=weekly) offers "Stop Weekly Gecko
// Notes" and "Stop all notification emails"; a plain link offers
// "Unsubscribe", which stops all notification email. Only the database call
// is stubbed.
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
  it('opening a weekly link changes nothing until a button is pressed', async () => {
    renderAt('/Unsubscribe?t=p1.sig&scope=weekly');
    expect(screen.getByRole('heading', { name: 'Stop Weekly Gecko Notes?' })).toBeTruthy();
    expect(screen.getByText(/This stops only the weekly email\. Reminders, hatch alerts and the other emails you chose still arrive\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Stop Weekly Gecko Notes' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Stop all notification emails' })).toBeTruthy();
    // A link scanner that loads the page and runs its scripts stops nothing.
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fx.calls).toEqual([]);
  });

  it('opening a plain link changes nothing until Unsubscribe is pressed', async () => {
    renderAt('/Unsubscribe?t=p1.sig');
    expect(screen.getByRole('heading', { name: 'Unsubscribe from notification emails?' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Stop all notification emails' })).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fx.calls).toEqual([]);
  });

  it('"Stop Weekly Gecko Notes" stops only those emails and says so', async () => {
    const user = userEvent.setup();
    renderAt('/Unsubscribe?t=p1.sig&scope=weekly');
    await user.click(screen.getByRole('button', { name: 'Stop Weekly Gecko Notes' }));
    expect(await screen.findByRole('heading', { name: 'Weekly Gecko Notes are off' })).toBeTruthy();
    expect(screen.getByText(/You will not get the weekly email any more\. Reminders, hatch alerts and the other emails you chose still arrive\. You can turn Weekly Gecko Notes back on in Settings\./)).toBeTruthy();
    expect(fx.calls).toEqual([{ fn: 'unsubscribe_weekly_notes_by_token', args: { p_token: 'p1.sig' } }]);
    expect(screen.getByRole('button', { name: 'Email settings' })).toBeTruthy();
  });

  it('"Stop all notification emails" calls the all-email unsubscribe only when clicked', async () => {
    const user = userEvent.setup();
    renderAt('/Unsubscribe?t=p1.sig&scope=weekly');
    await user.click(screen.getByRole('button', { name: 'Stop Weekly Gecko Notes' }));
    const stopAll = await screen.findByRole('button', { name: 'Stop all notification emails' });
    expect(fx.calls.map((c) => c.fn)).toEqual(['unsubscribe_weekly_notes_by_token']);
    await user.click(stopAll);
    expect(await screen.findByRole('heading', { name: 'You are unsubscribed' })).toBeTruthy();
    expect(fx.calls).toEqual([
      { fn: 'unsubscribe_weekly_notes_by_token', args: { p_token: 'p1.sig' } },
      { fn: 'unsubscribe_email_by_token', args: { p_token: 'p1.sig' } },
    ]);
    expect(screen.queryByRole('button', { name: 'Stop all notification emails' })).toBeNull();
  });

  it('a weekly link can stop all notification emails straight away', async () => {
    const user = userEvent.setup();
    renderAt('/Unsubscribe?t=p1.sig&scope=weekly');
    await user.click(screen.getByRole('button', { name: 'Stop all notification emails' }));
    expect(await screen.findByRole('heading', { name: 'You are unsubscribed' })).toBeTruthy();
    expect(fx.calls).toEqual([{ fn: 'unsubscribe_email_by_token', args: { p_token: 'p1.sig' } }]);
  });

  it('with no scope, Unsubscribe stops all email, Weekly Gecko Notes included', async () => {
    const user = userEvent.setup();
    renderAt('/Unsubscribe?t=p1.sig');
    await user.click(screen.getByRole('button', { name: 'Unsubscribe' }));
    expect(await screen.findByRole('heading', { name: 'You are unsubscribed' })).toBeTruthy();
    expect(screen.getByText(/Weekly Gecko Notes included/)).toBeTruthy();
    expect(fx.calls).toEqual([{ fn: 'unsubscribe_email_by_token', args: { p_token: 'p1.sig' } }]);
    expect(screen.queryByRole('button', { name: 'Stop all notification emails' })).toBeNull();
  });

  it('any other scope is the all-email unsubscribe', async () => {
    const user = userEvent.setup();
    renderAt('/Unsubscribe?t=p1.sig&scope=everything');
    await user.click(screen.getByRole('button', { name: 'Unsubscribe' }));
    await screen.findByRole('heading', { name: 'You are unsubscribed' });
    expect(fx.calls.map((c) => c.fn)).toEqual(['unsubscribe_email_by_token']);
  });

  it('a changed weekly link says it does not work and offers no stop-all button', async () => {
    const user = userEvent.setup();
    fx.answer = () => ({ data: false, error: null });
    renderAt('/Unsubscribe?t=bad&scope=weekly');
    await user.click(screen.getByRole('button', { name: 'Stop Weekly Gecko Notes' }));
    expect(await screen.findByRole('heading', { name: 'This link does not work' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Stop all notification emails' })).toBeNull();
  });

  it('a visitor link (no account) stops their notes only when pressed, and offers no Settings', async () => {
    const user = userEvent.setup();
    renderAt('/Unsubscribe?t=sub1.sig&scope=visitor');
    expect(screen.getByRole('heading', { name: 'Stop Weekly Gecko Notes?' })).toBeTruthy();
    expect(screen.getByText(/You signed up for them on the Geck Inspect website\. This stops them for this address\./)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Email settings' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Stop all notification emails' })).toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(fx.calls).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Stop Weekly Gecko Notes' }));
    expect(await screen.findByRole('heading', { name: 'Weekly Gecko Notes are off' })).toBeTruthy();
    expect(fx.calls).toEqual([{ fn: 'unsubscribe_weekly_notes_subscriber', args: { p_token: 'sub1.sig' } }]);
    expect(screen.getByRole('button', { name: 'Weekly Gecko Notes page' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Email settings' })).toBeNull();
  });

  it('a changed visitor link points to a recent note, not Settings', async () => {
    const user = userEvent.setup();
    fx.answer = () => ({ data: false, error: null });
    renderAt('/Unsubscribe?t=bad&scope=visitor');
    await user.click(screen.getByRole('button', { name: 'Stop Weekly Gecko Notes' }));
    expect(await screen.findByRole('heading', { name: 'This link does not work' })).toBeTruthy();
    expect(screen.getByText(/Use the link at the bottom of a recent note\./)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Email settings' })).toBeNull();
  });

  it('a link with no token asks the database nothing and offers no button', async () => {
    renderAt('/Unsubscribe?scope=weekly');
    expect(screen.getByRole('heading', { name: 'This link does not work' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Stop Weekly Gecko Notes' })).toBeNull();
    await waitFor(() => expect(fx.calls).toEqual([]));
  });
});

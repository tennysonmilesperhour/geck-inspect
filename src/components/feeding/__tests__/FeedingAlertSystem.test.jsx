// @vitest-environment jsdom
// The floating feeding reminder cards are gone (experience review B4).
// What is left is the one-line phone notification ask, shown while a
// feeding is due to a member this device can still ask, in the "feeding"
// turn of the floating notice queue.
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({
  groups: [],
  status: { permission: 'default', subscribed: false },
  groupQueries: 0,
}));

vi.mock('@/entities/all', () => ({
  FeedingGroup: { filter: vi.fn(async () => { fx.groupQueries += 1; return fx.groups; }) },
  OtherReptile: { filter: vi.fn(async () => []) },
}));
vi.mock('@/lib/webPush', () => ({
  isPushSupported: () => true,
  getPushStatus: vi.fn(async () => fx.status),
}));
vi.mock('@/lib/pagePolling', () => ({ startVisiblePolling: () => () => {} }));
// The real card reads the browser's push state; this stand-in keeps its
// two behaviours that matter here: it draws one line, and "Not now"
// makes it draw nothing.
vi.mock('@/components/notifications/PushAskCard', async () => {
  const { useState } = await import('react');
  return {
    default: function PushAskCard({ subject, compact, hasReminder }) {
      const [gone, setGone] = useState(false);
      if (gone || !hasReminder) return null;
      return (
        <div data-compact={String(Boolean(compact))}>
          Get {subject} on this device.
          <button type="button" onClick={() => setGone(true)}>Not now</button>
        </div>
      );
    },
  };
});

import FeedingAlertSystem from '@/components/feeding/FeedingAlertSystem';

installDomHarness();

const member = { email: 'keeper@example.com' };
const due = { id: 'g1', name: 'Adults A', interval_days: 3, last_fed_date: '2020-01-01' };
const notDue = { id: 'g2', name: 'Hatchlings', interval_days: 3, last_fed_date: new Date().toISOString().slice(0, 10) };
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
const notice = () => document.querySelector('[data-floating-notice]');

beforeEach(() => {
  fx.groups = [due];
  fx.status = { permission: 'default', subscribed: false };
  fx.groupQueries = 0;
});

describe('FeedingAlertSystem', () => {
  it('draws no reminder cards, only the compact notification ask, in the feeding slot', async () => {
    render(<FeedingAlertSystem user={member} enabled />);
    await settle();
    expect(notice().getAttribute('data-floating-notice')).toBe('feeding');
    expect(notice().textContent).toContain('Get feeding reminders on this device.');
    expect(notice().querySelector('[data-compact="true"]')).toBeTruthy();
    expect(screen.queryByText('Adults A')).toBeNull();
    expect(screen.queryByRole('button', { name: /Mark Fed|Dismiss/ })).toBeNull();
  });

  it('gives the slot back after "Not now"', async () => {
    render(<FeedingAlertSystem user={member} enabled />);
    await settle();
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }));
    await settle();
    expect(notice()).toBeNull();
  });

  it('shows nothing when no feeding is due', async () => {
    fx.groups = [notDue];
    render(<FeedingAlertSystem user={member} enabled />);
    await settle();
    expect(notice()).toBeNull();
    expect(fx.groupQueries).toBe(1);
  });

  it('asks nothing of the database for a guest, a subscribed member, a "Not now" device or with alerts off', async () => {
    const cases = [
      () => render(<FeedingAlertSystem user={{ email: 'guest@local', is_guest: true }} enabled />),
      () => { fx.status = { permission: 'granted', subscribed: true }; return render(<FeedingAlertSystem user={member} enabled />); },
      () => { localStorage.setItem('geck_push_ask_dismissed_v1', '1'); return render(<FeedingAlertSystem user={member} enabled />); },
      () => render(<FeedingAlertSystem user={member} enabled={false} />),
    ];
    for (const mount of cases) {
      fx.status = { permission: 'default', subscribed: false };
      const view = mount();
      await settle();
      expect(notice()).toBeNull();
      view.unmount();
      localStorage.clear();
    }
    expect(fx.groupQueries).toBe(0);
  });
});

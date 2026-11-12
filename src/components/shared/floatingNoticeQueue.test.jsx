// @vitest-environment jsdom
// One floating notice at a time (experience review B3). The five notices
// are mounted in different places, so they take turns through
// src/components/shared/floatingNoticeQueue.js. These tests hold the
// order, and prove with the real consent banner and offline badge that
// only one is on the page when two are eligible.
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installDomHarness } from '@/lib/__tests__/domHarness';

const fx = vi.hoisted(() => ({ needsConsent: true, queue: { pending: 0, online: false } }));

vi.mock('@/lib/analyticsConsent', () => ({
  CONSENT_EVENT: 'gi-consent-changed',
  needsConsentPrompt: () => fx.needsConsent,
  setConsent: () => { fx.needsConsent = false; },
}));
vi.mock('@/lib/offlineSync', () => ({
  useOfflineQueue: () => fx.queue,
  syncNow: vi.fn(async () => ({ saved: 0, failed: [] })),
}));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

import ConsentBanner from '@/components/shared/ConsentBanner';
import OfflineSyncStatus from '@/components/shared/OfflineSyncStatus';
import {
  FLOATING_NOTICE_ORDER,
  pickFloatingNotice,
  useFloatingNotice,
} from '@/components/shared/floatingNoticeQueue';

installDomHarness();

const onScreen = () => [...document.querySelectorAll('[data-floating-notice]')].map((el) => el.getAttribute('data-floating-notice'));

function Notice({ id, wants = true }) {
  const showing = useFloatingNotice(id, wants);
  return showing ? <div data-floating-notice={id}>{id}</div> : null;
}

beforeEach(() => {
  fx.needsConsent = true;
  fx.queue = { pending: 0, online: false };
});

describe('the floating notice order', () => {
  it('is update, consent, offline, feeding, tour', () => {
    expect(FLOATING_NOTICE_ORDER).toEqual(['update', 'consent', 'offline', 'feeding', 'tour']);
  });

  it('picks the first waiting notice in that order, whatever order they arrived in', () => {
    expect(pickFloatingNotice(['tour', 'offline', 'consent'])).toBe('consent');
    expect(pickFloatingNotice(['feeding', 'tour'])).toBe('feeding');
    expect(pickFloatingNotice(['tour', 'update'])).toBe('update');
    expect(pickFloatingNotice([])).toBeNull();
    expect(pickFloatingNotice(['not-a-notice'])).toBeNull();
  });
});

describe('one floating notice at a time', () => {
  it('shows one of five eligible notices, then the next as each goes away', () => {
    const all = (hidden = []) => (
      <>
        {[...FLOATING_NOTICE_ORDER].reverse().map((id) => <Notice key={id} id={id} wants={!hidden.includes(id)} />)}
      </>
    );
    const { rerender } = render(all());
    expect(onScreen()).toEqual(['update']);
    rerender(all(['update']));
    expect(onScreen()).toEqual(['consent']);
    rerender(all(['update', 'consent', 'offline']));
    expect(onScreen()).toEqual(['feeding']);
    rerender(all(['update', 'consent', 'offline', 'feeding']));
    expect(onScreen()).toEqual(['tour']);
    // A higher one that becomes eligible later takes the place back.
    rerender(all(['update', 'consent', 'feeding']));
    expect(onScreen()).toEqual(['offline']);
    rerender(all(FLOATING_NOTICE_ORDER));
    expect(onScreen()).toEqual([]);
  });

  it('two holders of one slot (the tour card, then the guest notice) hand over without a gap for others', () => {
    const { rerender } = render(<><Notice id="tour" /><Notice id="feeding" wants={false} /></>);
    expect(onScreen()).toEqual(['tour']);
    rerender(<><Notice key="second" id="tour" /><Notice id="feeding" wants={false} /></>);
    expect(onScreen()).toEqual(['tour']);
  });

  it('the real consent banner and offline badge: only the banner renders, then the badge after an answer', async () => {
    render(
      <MemoryRouter>
        <OfflineSyncStatus />
        <ConsentBanner />
      </MemoryRouter>,
    );
    expect(onScreen()).toEqual(['consent']);
    expect(screen.getByRole('region', { name: 'Analytics choice' })).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(onScreen()).toEqual(['offline']);
    expect(screen.getByRole('status').textContent).toBe('Offline');
    expect(screen.queryByRole('region', { name: 'Analytics choice' })).toBeNull();
  });

  it('the offline badge leaves when the connection is back and nothing waits', () => {
    fx.needsConsent = false;
    const { rerender } = render(<MemoryRouter><OfflineSyncStatus /><ConsentBanner /></MemoryRouter>);
    expect(onScreen()).toEqual(['offline']);
    fx.queue = { pending: 0, online: true };
    act(() => { rerender(<MemoryRouter><OfflineSyncStatus /><ConsentBanner /></MemoryRouter>); });
    expect(onScreen()).toEqual([]);
  });
});

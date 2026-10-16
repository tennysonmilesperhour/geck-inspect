import React from 'react';
import { act, create } from 'react-test-renderer';
import { readFileSync } from 'node:fs';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => {
  vi.stubGlobal('window', { self: null, top: null, matchMedia: () => ({ matches: false }), navigator: {} });
  return { supported: true, status: { permission: 'default', subscribed: false }, subscribe: null, events: [] };
});
afterAll(() => vi.unstubAllGlobals());

vi.mock('@/lib/webPush', () => ({
  isPushSupported: () => state.supported,
  getPushStatus: () => Promise.resolve(state.status),
  subscribeToPush: (...args) => state.subscribe(...args),
}));
vi.mock('@/lib/posthog', () => ({ captureEvent: (name, props) => state.events.push([name, props]) }));
vi.mock('react-router-dom', () => ({ Link: ({ to, children, ...rest }) => React.createElement('a', { href: to, ...rest }, children) }));
vi.mock('@/utils', () => ({ createPageUrl: (p) => `/${p}` }));

import { pushAskState, pushAskErrorMessage, readPushAskDismissed, writePushAskDismissed, PUSH_ASK_DISMISS_KEY } from '@/lib/pushAsk';
import PushAskCard from '@/components/notifications/PushAskCard';

const member = { email: 'keeper@example.com', is_guest: false };
const base = { user: member, hasReminder: true, supported: true, ios: false, standalone: false, status: { permission: 'default', subscribed: false }, dismissed: false };

describe('pushAskState: ask only when there is a reminder to receive', () => {
  it('asks a member with a reminder on a browser that can subscribe', () => {
    expect(pushAskState(base)).toBe('ask');
  });
  it('never asks a member with no gecko reminder yet (the old banner did, from minute one)', () => {
    expect(pushAskState({ ...base, hasReminder: false })).toBe('hidden');
  });
  it('never asks guests or signed-out visitors', () => {
    expect(pushAskState({ ...base, user: { email: 'guest@demo', is_guest: true } })).toBe('hidden');
    expect(pushAskState({ ...base, user: null })).toBe('hidden');
  });
  it('stays quiet after Not now, once subscribed, or when the browser blocked it', () => {
    expect(pushAskState({ ...base, dismissed: true })).toBe('hidden');
    expect(pushAskState({ ...base, status: { permission: 'granted', subscribed: true } })).toBe('hidden');
    expect(pushAskState({ ...base, status: { permission: 'denied', subscribed: false } })).toBe('hidden');
    expect(pushAskState({ ...base, status: null })).toBe('hidden');
    expect(pushAskState({ ...base, supported: false })).toBe('hidden');
  });
  it('shows the Home Screen steps on an iPhone browser, and asks once installed', () => {
    expect(pushAskState({ ...base, ios: true, standalone: false, supported: false, status: null })).toBe('install');
    expect(pushAskState({ ...base, ios: true, standalone: true })).toBe('ask');
  });
  it('explains a blocked permission in plain words', () => {
    expect(pushAskErrorMessage('permission-denied')).toMatch(/blocked/);
    expect(pushAskErrorMessage('anything-else')).toMatch(/Settings, Notifications/);
  });
  it('remembers Not now per device and survives storage that throws', () => {
    const store = new Map();
    const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    expect(readPushAskDismissed(storage)).toBe(false);
    writePushAskDismissed(storage);
    expect(store.get(PUSH_ASK_DISMISS_KEY)).toBe('1');
    expect(readPushAskDismissed(storage)).toBe(true);
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(readPushAskDismissed(broken)).toBe(false);
    expect(() => writePushAskDismissed(broken)).not.toThrow();
  });
});

describe('PushAskCard', () => {
  let tree;
  beforeEach(() => {
    state.supported = true;
    state.status = { permission: 'default', subscribed: false };
    state.events = [];
    state.subscribe = vi.fn(() => Promise.resolve({ ok: true }));
  });
  afterEach(() => { if (tree) act(() => tree.unmount()); tree = null; });

  const text = () => JSON.stringify(tree.toJSON());

  it('renders nothing without a reminder', async () => {
    await act(async () => { tree = create(<PushAskCard user={member} hasReminder={false} subject="Mango's reminders" />); });
    expect(tree.toJSON()).toBeNull();
  });

  it('offers to turn on notifications beside a reminder, and subscribes on the tap', async () => {
    await act(async () => { tree = create(<PushAskCard user={member} hasReminder subject="Mango's reminders" source="first_gecko_payoff" />); });
    expect(text()).toContain('Get ');
    expect(text()).toContain("Mango's reminders");
    const button = tree.root.findAll((n) => n.type === 'button' && JSON.stringify(n.children).includes('Turn on notifications'))[0];
    await act(async () => { await button.props.onClick(); });
    expect(state.subscribe).toHaveBeenCalledWith('keeper@example.com');
    expect(text()).toContain('will reach this device');
    expect(state.events.map(([, p]) => p.action)).toEqual(expect.arrayContaining(['shown', 'clicked', 'enabled']));
  });

  it('shows a plain message when the browser refuses', async () => {
    state.subscribe = vi.fn(() => Promise.resolve({ ok: false, reason: 'permission-denied' }));
    await act(async () => { tree = create(<PushAskCard user={member} hasReminder compact subject="feeding reminders" />); });
    const button = tree.root.findAll((n) => n.type === 'button' && JSON.stringify(n.children).includes('Turn on'))[0];
    await act(async () => { await button.props.onClick(); });
    expect(text()).toContain('blocked');
  });
});

describe('no page-wide push banner', () => {
  it('the app shell no longer mounts a push banner on every route', () => {
    const layout = readFileSync(new URL('../../Layout.jsx', import.meta.url), 'utf8');
    expect(layout).not.toMatch(/PushEnableBanner/);
  });
  it('the first-gecko payoff and the feeding reminder carry the ask', () => {
    const flow = readFileSync(new URL('../../components/onboarding/FirstGeckoFlow.jsx', import.meta.url), 'utf8');
    const feeding = readFileSync(new URL('../../components/feeding/FeedingAlertSystem.jsx', import.meta.url), 'utf8');
    expect(flow).toMatch(/<PushAskCard[\s\S]*hasReminder=/);
    expect(feeding).toMatch(/<PushAskCard[\s\S]*hasReminder/);
  });
});

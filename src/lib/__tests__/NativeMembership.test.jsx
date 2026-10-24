import React from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { act, create } from 'react-test-renderer';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => vi.stubGlobal('window', { self: null, top: null }));
afterAll(() => vi.unstubAllGlobals());
const fixture = vi.hoisted(() => ({ packages: [], storeTier: 'free', sync: vi.fn(), purchase: vi.fn(), toast: vi.fn(), capture: vi.fn() }));
vi.mock('@/lib/RevenueCatContext', () => ({ useRevenueCat: () => ({ offerings: { current: { availablePackages: fixture.packages } }, isReady: true, sync: fixture.sync, customerInfo: null, storeTier: fixture.storeTier }) }));
vi.mock('@/lib/revenuecat', () => ({ configureRevenueCat: async () => ({}), purchasePackage: (...args) => fixture.purchase(...args), restorePurchases: async () => ({}), fetchOfferings: async () => null }));
vi.mock('@/lib/posthog', () => ({ captureEvent: (...args) => fixture.capture(...args), ensurePostHog: async () => null }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: fixture.toast }) }));
import NativeMembership from '../../components/subscription/NativeMembership';
const contents = node => typeof node === 'string' ? node : (node.children || []).map(contents).join('');
beforeEach(() => {
  fixture.storeTier = 'free';
  fixture.sync.mockReset().mockResolvedValue('keeper'); fixture.purchase.mockReset(); fixture.toast.mockReset(); fixture.capture.mockReset();
  fixture.packages = ['keeper', 'breeder'].flatMap((tier, i) => ['monthly', 'annual'].map((cycle, j) => ({
    identifier: `${tier}_${cycle}`, packageType: 'CUSTOM',
    product: { identifier: `com.geckinspect.${tier}.${cycle}`, priceString: `$${(i + 1) * (j ? 40 : 4)}.00` },
  })));
});

describe('native membership screen', () => {
  it('opens legal pages inside the app router without handing them to iOS', () => {
    function Location() { return <output>{useLocation().pathname}</output>; }
    const tree = create(<MemoryRouter><NativeMembership user={null} /><Location /></MemoryRouter>);
    for (const [label, path] of [['Terms', '/Terms'], ['Privacy', '/PrivacyPolicy']]) {
      const link = tree.root.findAllByType('a').find(node => contents(node) === label);
      const event = { button: 0, preventDefault: vi.fn() };
      act(() => link.props.onClick(event));
      expect(event.preventDefault).toHaveBeenCalled();
      expect(contents(tree.root.findByType('output'))).toBe(path);
    }
    tree.unmount();
  });
  it('updates access after restoration even when the page account snapshot is unchanged', () => {
    const user = { membership_tier: 'free' };
    const tree = create(<MemoryRouter><NativeMembership user={user} /></MemoryRouter>);
    fixture.storeTier = 'breeder';
    act(() => tree.update(<MemoryRouter><NativeMembership user={user} /></MemoryRouter>));
    expect(contents(tree.toJSON())).toContain('Your Breeder access is active');
    const buttons = tree.root.findAllByType('button').filter(b => contents(b) === 'Included in your current access');
    expect(buttons).toHaveLength(4);
    expect(buttons.every(b => b.props.disabled)).toBe(true);
    fixture.storeTier = 'free';
    act(() => tree.update(<MemoryRouter><NativeMembership user={user} /></MemoryRouter>));
    expect(contents(tree.toJSON())).not.toContain('Your Breeder access is active');
    tree.unmount();
  });
  it('shows both actual plans with recurring periods and excludes unknown Test Store packages', () => {
    fixture.packages.push({ identifier: '$rc_lifetime', product: { identifier: 'lifetime', priceString: '$99' } });
    const tree = create(<MemoryRouter><NativeMembership user={{ membership_tier: 'free' }} /></MemoryRouter>);
    expect(tree.root.findAllByType('h2').map(contents)).toEqual(['Keeper', 'Keeper', 'Breeder', 'Breeder']);
    const text = contents(tree.toJSON());
    expect(text).toContain('$4.00 per month'); expect(text).toContain('$40.00 per year');
    expect(text).not.toContain('$99'); tree.unmount();
  });
  it('reconciles a Keeper purchase and reports Keeper instead of promising Breeder', async () => {
    const tree = create(<MemoryRouter><NativeMembership user={{ membership_tier: 'free' }} /></MemoryRouter>);
    const button = tree.root.findAllByType('button').find(b => contents(b) === 'Continue for $4.00 per month');
    await act(async () => button.props.onClick());
    expect(fixture.purchase).toHaveBeenCalledWith(fixture.packages[0]); expect(fixture.sync).toHaveBeenCalledOnce();
    expect(fixture.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Keeper access is active' }));
    expect(fixture.capture).toHaveBeenCalledWith('native_purchase_started', { tier: 'keeper', interval: 'monthly', paywall_outcome: null });
    expect(fixture.capture).toHaveBeenCalledWith('native_purchase_completed', { tier: 'keeper', interval: 'monthly', paywall_outcome: null });
    expect(fixture.capture.mock.calls.filter(([event]) => event === 'native_purchase_completed')).toHaveLength(1);
    tree.unmount();
  });
  it('records store success once before a failed entitlement sync, without losing the error', async () => {
    fixture.sync.mockImplementation(async () => {
      expect(fixture.capture.mock.calls.filter(([event]) => event === 'native_purchase_completed')).toHaveLength(1);
      throw new Error('Entitlement sync unavailable');
    });
    const tree = create(<MemoryRouter><NativeMembership user={{ membership_tier: 'free' }} /></MemoryRouter>);
    const button = tree.root.findAllByType('button').find(b => contents(b) === 'Continue for $4.00 per month');
    await act(async () => button.props.onClick());
    expect(fixture.purchase).toHaveBeenCalledOnce();
    expect(fixture.sync).toHaveBeenCalledOnce();
    expect(fixture.capture.mock.calls.filter(([event]) => event === 'native_purchase_completed')).toEqual([
      ['native_purchase_completed', { tier: 'keeper', interval: 'monthly', paywall_outcome: null }],
    ]);
    expect(fixture.toast).toHaveBeenCalledWith(expect.objectContaining({ description: 'Entitlement sync unavailable', variant: 'destructive' }));
    expect(button.props.disabled).toBe(false);
    tree.unmount();
  });
  it.each([
    ['failed', new Error('Store unavailable')],
    ['cancelled', { userCancelled: true }],
  ])('does not count a %s purchase as completed', async (_status, error) => {
    fixture.purchase.mockRejectedValue(error);
    const tree = create(<MemoryRouter><NativeMembership user={{ membership_tier: 'free' }} /></MemoryRouter>);
    const button = tree.root.findAllByType('button').find(b => contents(b) === 'Continue for $4.00 per month');
    await act(async () => button.props.onClick());
    expect(fixture.capture.mock.calls.map(([event]) => event)).toEqual(['native_purchase_started']);
    expect(fixture.sync).not.toHaveBeenCalled();
    expect(button.props.disabled).toBe(false);
    tree.unmount();
  });
  it('does not sell a second store subscription to an existing direct member', () => {
    const tree = create(<MemoryRouter><NativeMembership user={{ membership_tier: 'keeper' }} /></MemoryRouter>);
    const purchaseButtons = tree.root.findAllByType('button').filter(b => /Included in|Manage your existing/.test(contents(b)));
    expect(purchaseButtons).toHaveLength(4); expect(purchaseButtons.every(b => b.props.disabled)).toBe(true);
    tree.unmount();
  });
  it('gives visitors a clear sign-in action before requesting store offerings', () => {
    const tree = create(<MemoryRouter><NativeMembership user={null} /></MemoryRouter>);
    const text = contents(tree.toJSON()); expect(text).toContain('Sign in to view store plans');
    expect(text).not.toContain('Store plans are currently unavailable'); tree.unmount();
  });
});

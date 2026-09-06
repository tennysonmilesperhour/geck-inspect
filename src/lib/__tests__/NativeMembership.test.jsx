import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => vi.stubGlobal('window', { self: null, top: null }));
afterAll(() => vi.unstubAllGlobals());
const fixture = vi.hoisted(() => ({ packages: [], sync: vi.fn(), purchase: vi.fn(), toast: vi.fn() }));
vi.mock('@/lib/RevenueCatContext', () => ({ useRevenueCat: () => ({ offerings: { current: { availablePackages: fixture.packages } }, isReady: true, sync: fixture.sync, customerInfo: null }) }));
vi.mock('@/lib/revenuecat', () => ({ configureRevenueCat: async () => ({}), purchasePackage: (...args) => fixture.purchase(...args), restorePurchases: async () => ({}), fetchOfferings: async () => null }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: fixture.toast }) }));
import NativeMembership from '../../components/subscription/NativeMembership';
const contents = node => typeof node === 'string' ? node : (node.children || []).map(contents).join('');
beforeEach(() => {
  fixture.sync.mockReset().mockResolvedValue('keeper'); fixture.purchase.mockReset(); fixture.toast.mockReset();
  fixture.packages = ['keeper', 'breeder'].flatMap((tier, i) => ['monthly', 'annual'].map((cycle, j) => ({
    identifier: `${tier}_${cycle}`, packageType: 'CUSTOM',
    product: { identifier: `com.geckinspect.${tier}.${cycle}`, priceString: `$${(i + 1) * (j ? 40 : 4)}.00` },
  })));
});

describe('native membership screen', () => {
  it('shows both actual plans with recurring periods and excludes unknown Test Store packages', () => {
    fixture.packages.push({ identifier: '$rc_lifetime', product: { identifier: 'lifetime', priceString: '$99' } });
    const tree = create(<NativeMembership user={{ membership_tier: 'free' }} />);
    expect(tree.root.findAllByType('h2').map(contents)).toEqual(['Keeper', 'Keeper', 'Breeder', 'Breeder']);
    const text = contents(tree.toJSON());
    expect(text).toContain('$4.00 per month'); expect(text).toContain('$40.00 per year');
    expect(text).not.toContain('$99'); tree.unmount();
  });
  it('reconciles a Keeper purchase and reports Keeper instead of promising Breeder', async () => {
    const tree = create(<NativeMembership user={{ membership_tier: 'free' }} />);
    const button = tree.root.findAllByType('button').find(b => contents(b) === 'Continue for $4.00 per month');
    await act(async () => button.props.onClick());
    expect(fixture.purchase).toHaveBeenCalledWith(fixture.packages[0]); expect(fixture.sync).toHaveBeenCalledOnce();
    expect(fixture.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Keeper access is active' }));
    tree.unmount();
  });
  it('does not sell a second store subscription to an existing direct member', () => {
    const tree = create(<NativeMembership user={{ membership_tier: 'keeper' }} />);
    const purchaseButtons = tree.root.findAllByType('button').filter(b => /Included in|Manage your existing/.test(contents(b)));
    expect(purchaseButtons).toHaveLength(4); expect(purchaseButtons.every(b => b.props.disabled)).toBe(true);
    tree.unmount();
  });
  it('gives visitors a clear sign-in action before requesting store offerings', () => {
    const tree = create(<NativeMembership user={null} />);
    const text = contents(tree.toJSON()); expect(text).toContain('Sign in to view store plans');
    expect(text).not.toContain('Store plans are currently unavailable'); tree.unmount();
  });
});

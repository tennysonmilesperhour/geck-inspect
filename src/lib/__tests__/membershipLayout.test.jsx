import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';

// Tests run in Node; the UI kit reads window.self at import time, and the
// page reads location and history once on mount.
const fx = vi.hoisted(() => {
  vi.stubGlobal('window', {
    self: null,
    top: null,
    location: { search: '', pathname: '/Membership', hash: '', origin: 'https://geckinspect.com' },
    history: { state: null, replaceState: () => {} },
    sessionStorage: { getItem: () => null, setItem: () => {} },
  });
  return { member: null, toast: vi.fn() };
});
afterAll(() => vi.unstubAllGlobals());

vi.mock('@/lib/supabaseClient', () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock('@/entities/all', () => ({
  User: { me: async () => fx.member },
  PageConfig: { filter: async () => [] },
}));
vi.mock('@/lib/posthog', () => ({ captureEvent: () => {}, ensurePostHog: async () => null }));
vi.mock('@/lib/telemetry', () => ({ reportError: () => {} }));
vi.mock('@/lib/billingPortal', () => ({ openBillingPortal: vi.fn() }));
vi.mock('@/lib/revenuecat', () => ({ isNativePlatform: () => false }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: fx.toast }) }));
vi.mock('@/components/seo/Seo', () => ({ default: () => null }));
vi.mock('@/components/support/SupportContactCard', () => ({ default: () => null }));
vi.mock('@/components/shared/ReferralLinkCard', () => ({ default: () => null }));
vi.mock('@/components/subscription/NativeMembership', () => ({ default: () => null }));

import MembershipPage from '@/pages/Membership';
import { ACTIVE_PAIR_LIMITS, planNumbers } from '@/lib/membershipFeatures';
import { getTierPricing } from '@/lib/stripe-config';
import { PLAN_LIMITS } from '@/components/subscription/PlanLimitChecker';

const contents = (node) => (node == null ? '' : typeof node === 'string' ? node : Array.isArray(node) ? node.map(contents).join(' ') : (node.children || []).map(contents).join(' '));

let tree;
afterEach(() => { if (tree) act(() => tree.unmount()); tree = null; });

async function render(member = null) {
  fx.member = member;
  await act(async () => { tree = create(<MembershipPage />); });
  return tree;
}

const cardsGrid = () => tree.root.find((n) => n.type === 'div' && typeof n.props.className === 'string' && n.props.className.includes('md:grid-cols-3'));

describe('Membership: three plans with who each is for and the numbers that decide them', () => {
  it('shows Free, Keeper and Breeder as three columns, and hides off-sale Enterprise', async () => {
    await render();
    const grid = cardsGrid();
    const titles = grid.findAll((n) => typeof n.type === 'string' && n.props?.className?.includes?.('text-2xl text-white')).map(contents);
    expect(titles.map((t) => t.trim())).toEqual(['FREE', 'KEEPER', 'BREEDER']);
    expect(tree.root.findAll((n) => n.props?.['aria-labelledby'] === 'enterprise-plan-heading')).toHaveLength(0);
    expect(contents(tree.root)).not.toContain('ENTERPRISE');
  });

  it('still shows Enterprise to a member who already holds it', async () => {
    await render({ email: 'ent@example.com', membership_tier: 'enterprise', subscription_status: 'active' });
    const enterprise = tree.root.find((n) => n.props?.['aria-labelledby'] === 'enterprise-plan-heading');
    expect(contents(enterprise)).toContain('ENTERPRISE');
    expect(contents(enterprise)).toContain('Current plan');
  });

  it('drops the "Best for most keepers" claim and says who each plan is for', async () => {
    await render();
    const text = contents(tree.toJSON());
    expect(text).not.toMatch(/Best for most keepers|Most popular|Best Value/i);
    expect(text).toContain('For keepers with up to 10 geckos');
    expect(text).toContain('For keepers whose collection has grown past 10 geckos');
    expect(text).toContain('For breeders who pair every season');
  });

  it('collapses Free to six lines with a Show all toggle, and opens all eleven', async () => {
    // Twelve lines, less the Other Reptiles one while that page is retired.
    await render();
    const freeList = () => tree.root.find((n) => n.type === 'ul' && n.props.id === 'plan-features-free');
    expect(freeList().findAllByType('li')).toHaveLength(6);
    const toggle = tree.root.find((n) => n.type === 'button' && n.props['aria-controls'] === 'plan-features-free');
    expect(toggle.props['aria-expanded']).toBe(false);
    expect(contents(toggle)).toContain('Show all 11 Free features');
    await act(async () => toggle.props.onClick());
    expect(freeList().findAllByType('li')).toHaveLength(11);
    expect(tree.root.find((n) => n.type === 'button' && n.props['aria-controls'] === 'plan-features-free').props['aria-expanded']).toBe(true);
    // Keeper and Breeder are short enough to show in full.
    expect(tree.root.findAll((n) => n.type === 'button' && n.props['aria-controls'] === 'plan-features-keeper')).toHaveLength(0);
  });

  it('keeps every plan line (no plan contents changed) and the prices from stripe-config', async () => {
    await render();
    const text = contents(tree.toJSON());
    for (const tier of ['keeper', 'breeder']) {
      expect(text).toContain(getTierPricing(tier, 'monthly').price);
      expect(text).toContain(getTierPricing(tier, 'monthly').cta);
    }
    expect(text).toContain('MorphMarket CSV sync');
    expect(text).toContain('Estimated-value add-on for Morph ID (opt in)');
  });

  it('marks a signed-in free member’s plan once, with a readable badge', async () => {
    await render({ email: 'keeper@example.com', membership_tier: 'free', free_trial_used: true });
    const current = tree.root.findAll((n) => n.type === 'button' && contents(n).trim() === 'Current plan');
    expect(current).toHaveLength(1);
    const badge = tree.root.findAll((n) => n.type === 'span' && contents(n).trim() === 'Current plan')[0];
    expect(badge.props.className).toContain('bg-emerald-700');
    expect(badge.props.className).toContain('text-white');
  });
});

describe('planNumbers', () => {
  it('reads the limits the app enforces', () => {
    expect(planNumbers('free')).toEqual([
      { label: 'Geckos', value: '10' },
      { label: 'Active pairs', value: '1' },
      { label: 'Morph IDs a month', value: '1' },
      { label: 'Photo storage', value: '1 GB' },
    ]);
    expect(planNumbers('keeper').map((n) => n.value)).toEqual(['50', '5', '3', '10 GB']);
    expect(planNumbers('breeder').map((n) => n.value)).toEqual(['Unlimited', 'Unlimited', '6', 'Unlimited']);
  });

  it('pair limits match PlanLimitChecker', () => {
    for (const tier of ['free', 'keeper', 'breeder', 'enterprise']) {
      const enforced = PLAN_LIMITS[tier].breeding_pairs;
      expect(ACTIVE_PAIR_LIMITS[tier] ?? Infinity).toBe(enforced);
    }
  });
});

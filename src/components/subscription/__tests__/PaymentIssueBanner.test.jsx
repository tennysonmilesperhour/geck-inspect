import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The banner a member sees when Stripe could not take their last payment.
const state = vi.hoisted(() => ({ portalCalls: [], portalError: null }));
vi.mock('@/lib/billingPortal', () => ({
  openBillingPortal: async (opts) => {
    state.portalCalls.push(opts);
    if (state.portalError) throw state.portalError;
  },
}));

const { default: PaymentIssueBanner } = await import('../PaymentIssueBanner');

// All visible text, with React's split children joined back together.
const textOf = (renderer) => {
  const walk = (node) => (node == null ? '' : typeof node === 'string' ? node
    : Array.isArray(node) ? node.map(walk).join('') : walk(node.children));
  return walk(renderer.toJSON());
};
const buttons = (renderer) => renderer.root.findAllByType('button');

beforeEach(() => {
  state.portalCalls = [];
  state.portalError = null;
  try { sessionStorage.clear(); } catch { /* no storage in this runner */ }
});

describe('PaymentIssueBanner', () => {
  it('shows for a member whose payment failed, naming their plan', () => {
    let r;
    act(() => { r = create(<PaymentIssueBanner user={{ email: 'a@b.c', membership_tier: 'breeder', subscription_status: 'past_due' }} />); });
    expect(textOf(r)).toContain('Your last Breeder payment did not go through');
    expect(r.root.findByProps({ role: 'alert' })).toBeTruthy();
  });

  it('stays hidden for paying, free and guest members', () => {
    for (const user of [
      { email: 'a@b.c', membership_tier: 'breeder', subscription_status: 'active' },
      { email: 'a@b.c', membership_tier: 'free', subscription_status: null },
      { email: 'guest@b.c', is_guest: true, membership_tier: 'breeder', subscription_status: 'past_due' },
      null,
    ]) {
      let r;
      act(() => { r = create(<PaymentIssueBanner user={user} />); });
      expect(r.toJSON()).toBeNull();
    }
  });

  it('opens the billing portal from Update payment', async () => {
    let r;
    act(() => { r = create(<PaymentIssueBanner user={{ email: 'a@b.c', membership_tier: 'keeper', subscription_status: 'past_due' }} />); });
    await act(async () => { await buttons(r)[0].props.onClick(); });
    expect(state.portalCalls).toHaveLength(1);
  });

  it('says how to get help when the billing page will not open', async () => {
    state.portalError = new Error('portal down');
    let r;
    act(() => { r = create(<PaymentIssueBanner user={{ email: 'a@b.c', membership_tier: 'keeper', subscription_status: 'past_due' }} />); });
    await act(async () => { await buttons(r)[0].props.onClick(); });
    expect(textOf(r)).toContain('The billing page would not open');
  });

  it('hides when dismissed', () => {
    let r;
    act(() => { r = create(<PaymentIssueBanner user={{ email: 'a@b.c', membership_tier: 'keeper', subscription_status: 'past_due' }} />); });
    act(() => { buttons(r)[1].props.onClick(); });
    expect(r.toJSON()).toBeNull();
  });
});

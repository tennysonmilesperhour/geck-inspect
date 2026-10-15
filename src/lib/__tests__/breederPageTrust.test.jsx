import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Signed-out buyers on /Breeder/<slug> cannot read the owner's email, so
// the Track record panel used to disappear for them. It now asks the
// database for the numbers by slug (breeder_page_trust, migration
// 20261016090000), and only falls back to the email path for signed-in
// visitors while that function is not deployed.
const state = vi.hoisted(() => ({ rpcCalls: [], rpcResult: null, emailCalls: [] }));
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    rpc: async (name, args) => {
      state.rpcCalls.push([name, args]);
      return state.rpcResult;
    },
  },
}));
// The email path reads entity tables; a signed-out visitor gets nothing.
vi.mock('@/api/supabaseEntities', () => {
  const none = { filter: async (...args) => { state.emailCalls.push(args); return []; }, get: async () => null };
  return {
    Gecko: none, WeightRecord: none, OwnershipRecord: none, BreederReview: none, BreederProfile: none,
    UserEntity: {
      filter: async (q) => {
        state.emailCalls.push(q);
        return [{ id: 'p1', email: q.email, created_date: new Date(Date.now() - 90 * 86400000).toISOString() }];
      },
      get: async () => null,
    },
  };
});

const { breederPageTrustSignals } = await import('../trustScore');
const { default: TrustPanel } = await import('@/components/marketplace/TrustPanel');

const ROW = {
  account_age_months: 14, animals_tracked: 23, weight_logs_count: 41, ownership_transfers: 3,
  review_count: 5, avg_rating: '4.6', is_verified_breeder: true, is_featured_breeder: false,
};

function textOf(tree) {
  const out = [];
  const walk = (n) => {
    if (n == null) return;
    if (typeof n === 'string') { out.push(n); return; }
    if (Array.isArray(n)) { n.forEach(walk); return; }
    walk(n.children);
  };
  walk(tree.toJSON());
  return out.join('');
}

beforeEach(() => {
  state.rpcCalls = [];
  state.emailCalls = [];
  state.rpcResult = { data: [ROW], error: null };
});

describe('breeder page trust numbers by slug', () => {
  it('maps the database row to the panel signals', async () => {
    expect(await breederPageTrustSignals('harlequin-house')).toEqual({
      accountAgeMonths: 14, animalsTracked: 23, weightLogsCount: 41, ownershipTransfers: 3,
      reviewCount: 5, avgRating: 4.6, isVerifiedBreeder: true, isFeaturedBreeder: false,
    });
    expect(state.rpcCalls).toEqual([['breeder_page_trust', { p_slug: 'harlequin-house' }]]);
  });

  it('is null for a page with no visible owner, and throws when the function is missing', async () => {
    state.rpcResult = { data: [], error: null };
    expect(await breederPageTrustSignals('gone')).toBeNull();
    state.rpcResult = { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
    await expect(breederPageTrustSignals('gone')).rejects.toMatchObject({ code: 'PGRST202' });
  });

  it('shows the full panel to a signed-out visitor from the slug alone', async () => {
    let tree;
    await act(async () => { tree = create(<TrustPanel breederSlug="pangea-co" variant="full" />); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    const text = textOf(tree);
    expect(text).toContain('Track record');
    expect(text).toContain('1 year');
    expect(text).toContain('4.6');
    expect(state.emailCalls).toHaveLength(0);
    act(() => tree.unmount());
  });

  it('falls back to the email for a signed-in visitor while the function is not deployed', async () => {
    state.rpcResult = { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
    let tree;
    await act(async () => {
      tree = create(<TrustPanel breederSlug="sable-street" email="owner@example.com" variant="full" />);
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(textOf(tree)).toContain('Track record');
    expect(state.emailCalls[0]).toEqual({ email: 'owner@example.com' });
    act(() => tree.unmount());
  });
});

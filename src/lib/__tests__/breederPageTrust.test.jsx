import React from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Signed-out buyers on /Breeder/<slug> cannot read the owner's email, so
// the Track record panel used to disappear for them. It now asks the
// database for the numbers by slug (breeder_page_trust, migration
// 20261015151000). Elsewhere (a marketplace card) the panel works from the
// seller's profile id: members cannot read another member's email on a
// gecko or its records (owner decision E16), so the seller's rows are
// counted by owner_profile_id.
const state = vi.hoisted(() => ({ rpcCalls: [], rpcResult: null, entityCalls: [], rows: {} }));
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    rpc: async (name, args) => {
      state.rpcCalls.push([name, args]);
      return name === 'breeder_page_trust' ? state.rpcResult : { data: null, error: null };
    },
  },
}));
// The profile id path reads entity tables. read_profiles gives another
// member's profile without an email.
vi.mock('@/api/supabaseEntities', () => {
  const entity = (name) => ({
    filter: async (...args) => { state.entityCalls.push([name, ...args]); return state.rows[name] || []; },
    get: async () => null,
  });
  return {
    Gecko: entity('Gecko'), WeightRecord: entity('WeightRecord'), OwnershipRecord: entity('OwnershipRecord'),
    BreederReview: entity('BreederReview'), BreederProfile: entity('BreederProfile'),
    UserEntity: {
      filter: async (q) => { state.entityCalls.push(['UserEntity', q]); return []; },
      get: async (id) => {
        state.entityCalls.push(['UserEntity.get', id]);
        return { id, email: null, full_name: 'Ana Reyes', created_date: new Date(Date.now() - 90 * 86400000).toISOString() };
      },
    },
  };
});

const { breederPageTrustSignals, computeTrustSignals } = await import('../trustScore');
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
  state.entityCalls = [];
  state.rows = {};
  state.rpcResult = { data: [ROW], error: null };
});

// Another member's rows, as members read them: no created_by.
const sellerRows = (n) => Array.from({ length: n }, (_, i) => ({ id: `r${i}`, owner_profile_id: 'p-ana' }));
const namesEmail = (calls) => JSON.stringify(calls).includes('created_by');

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
    expect(state.entityCalls).toHaveLength(0);
    act(() => tree.unmount());
  });

  it('falls back to the seller\'s profile id when the slug finds no visible owner', async () => {
    state.rpcResult = { data: [], error: null };
    let tree;
    await act(async () => {
      tree = create(<TrustPanel breederSlug="sable-street" profileId="p-sable" variant="full" />);
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(textOf(tree)).toContain('Track record');
    expect(state.entityCalls[0]).toEqual(['UserEntity.get', 'p-sable']);
    expect(namesEmail(state.entityCalls)).toBe(false);
    act(() => tree.unmount());
  });
});

describe('a seller\'s trust numbers by profile id', () => {
  it('counts another member\'s geckos, weigh-ins and ownership records by owner_profile_id', async () => {
    state.rows = { Gecko: sellerRows(3), WeightRecord: sellerRows(12), OwnershipRecord: sellerRows(1) };
    const signals = await computeTrustSignals('p-ana');
    expect(signals).toMatchObject({ accountAgeMonths: 2, animalsTracked: 3, weightLogsCount: 12, ownershipTransfers: 1 });
    for (const table of ['Gecko', 'WeightRecord', 'OwnershipRecord']) {
      expect(state.entityCalls).toContainEqual([table, { owner_profile_id: 'p-ana' }]);
    }
    expect(namesEmail(state.entityCalls)).toBe(false);
  });

  it('shows a marketplace card\'s compact panel from the profile id alone', async () => {
    state.rows = { Gecko: sellerRows(3), WeightRecord: sellerRows(12), OwnershipRecord: sellerRows(1) };
    let tree;
    await act(async () => { tree = create(<TrustPanel profileId="p-ana" variant="compact" />); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    const text = textOf(tree);
    expect(text).toContain('Establishing');
    expect(text).toContain('Tracking 3 geckos for 2 months');
    expect(state.rpcCalls.map(([name]) => name)).not.toContain('breeder_page_trust');
    act(() => tree.unmount());
  });

  it('shows nothing without a slug or a profile id', async () => {
    let tree;
    await act(async () => { tree = create(<TrustPanel variant="compact" />); });
    expect(tree.toJSON()).toBeNull();
    expect(state.entityCalls).toHaveLength(0);
    act(() => tree.unmount());
  });
});

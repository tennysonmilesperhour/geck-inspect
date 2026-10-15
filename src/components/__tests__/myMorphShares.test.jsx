import { act, create } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Tests run in Node; the UI kit reads window.self at import time.
const state = vi.hoisted(() => {
  vi.stubGlobal('window', { self: null, top: null });
  return { deleteResult: { error: null }, deleted: [] };
});
afterAll(() => vi.unstubAllGlobals());

vi.mock('@/lib/supabaseClient', () => {
  const rows = [{
    id: '0123456789abcdef',
    card: { candidate_morphs: [{ morph: 'harlequin', score: 58 }], assessment_status: 'tentative' },
    view_count: 3,
    signup_count: 0,
    created_date: '2026-10-15T12:00:00Z',
  }];
  const list = { select: () => list, order: () => list, limit: async () => ({ data: rows, error: null }) };
  return {
    supabase: {
      from: () => ({
        ...list,
        delete: () => ({ eq: async (_col, id) => { state.deleted.push(id); return state.deleteResult; } }),
      }),
    },
  };
});
vi.mock('@/components/shared/ShareMenu', () => ({ default: () => null }));

import { MyMorphShares } from '../morph-id/MorphShareCard';

const textOf = (node) => (typeof node === 'string' ? node : (node.children || []).map(textOf).join(''));
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

async function render() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree;
  await act(async () => {
    tree = create(<QueryClientProvider client={client}><MyMorphShares userId="u1" /></QueryClientProvider>);
  });
  await settle();
  return tree;
}

const stopButton = (tree) => tree.root.findAll((n) => n.type === 'button' && textOf(n).includes('Stop sharing'))[0];

beforeEach(() => {
  state.deleteResult = { error: null };
  state.deleted = [];
});

describe('your shared Morph ID cards', () => {
  it('says the card is still public when taking it down fails', async () => {
    state.deleteResult = { error: { code: '42501', message: 'permission denied for table morph_id_shares' } };
    const tree = await render();
    expect(textOf(tree.root)).toContain('Possibly Harlequin');
    await act(async () => { await stopButton(tree).props.onClick(); });
    expect(state.deleted).toEqual(['0123456789abcdef']);
    expect(textOf(tree.root)).toContain('so it is still public');
    expect(textOf(tree.root)).not.toContain('permission denied');
    await act(async () => tree.unmount());
  });

  it('shows no warning when the card is taken down', async () => {
    const tree = await render();
    await act(async () => { await stopButton(tree).props.onClick(); });
    expect(textOf(tree.root)).not.toContain('still public');
    await act(async () => tree.unmount());
  });
});

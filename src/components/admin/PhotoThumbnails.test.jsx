// The admin Photo thumbnails tool: counts what is left, runs the backfill
// with the admin's session, and says plainly when the database function
// has not been installed yet.
import { act, create } from 'react-test-renderer';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.hoisted(() => {
  vi.stubGlobal('window', { self: null, top: null, addEventListener() {}, removeEventListener() {} });
});
afterAll(() => vi.unstubAllGlobals());

const db = vi.hoisted(() => ({ rows: [], error: null, rpcCalls: [], made: [] }));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    rpc: vi.fn(async (fn, args) => {
      db.rpcCalls.push({ fn, args });
      if (db.error) return { data: null, error: db.error };
      const left = db.rows.filter((r) => !db.made.includes(r));
      const page = left.filter((r) => args.p_after === null || r > args.p_after).slice(0, args.p_limit);
      return { data: page.map((name) => ({ name, total_needing: left.length })), error: null };
    }),
    storage: { from: () => ({}) },
  },
}));
vi.mock('./photoThumbnailBackfill', async () => {
  const actual = await vi.importActual('./photoThumbnailBackfill');
  return {
    ...actual,
    makeOneThumbnail: vi.fn(async (row) => {
      if (row.name.includes('broken')) throw new Error('could not draw');
      db.made.push(row.name);
      return 'made';
    }),
  };
});

import PhotoThumbnails from './PhotoThumbnails';

const textOf = (node) => (typeof node === 'string' ? node : (node.children || []).map(textOf).join(''));
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

beforeEach(() => {
  db.rows = [];
  db.error = null;
  db.rpcCalls = [];
  db.made = [];
});

describe('PhotoThumbnails admin tool', () => {
  it('says the function is not installed yet instead of failing', async () => {
    db.error = { code: 'PGRST202', message: 'Could not find the function public.admin_photos_without_thumbnail' };
    let tree;
    await act(async () => { tree = create(<PhotoThumbnails />); });
    await settle();
    expect(textOf(tree.toJSON())).toContain('not installed on the database yet');
    const button = tree.root.findAllByType('button').find((b) => textOf(b).includes('Make thumbnails'));
    expect(button.props.disabled).toBe(true);
    act(() => tree.unmount());
  });

  it('counts the photos, makes thumbnails, and reports failures by count', async () => {
    db.rows = ['a.jpg', 'b-broken.jpg', 'c.jpg'];
    let tree;
    await act(async () => { tree = create(<PhotoThumbnails />); });
    await settle();
    expect(textOf(tree.toJSON())).toContain('3 photos need a thumbnail');
    expect(db.rpcCalls[0]).toEqual({ fn: 'admin_photos_without_thumbnail', args: { p_after: null, p_limit: 1 } });

    const button = tree.root.findAllByType('button').find((b) => textOf(b).includes('Make thumbnails'));
    await act(async () => { await button.props.onClick(); });
    await settle();

    const text = textOf(tree.toJSON());
    expect(text).toContain('Done: made 2 of 3, 1 failed.');
    expect(text).toContain('b-broken.jpg: could not draw');
    // The recount after the run shows the one that failed is still left.
    expect(text).toContain('1 photo needs a thumbnail');
    act(() => tree.unmount());
  });
});

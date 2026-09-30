import { describe, expect, it, vi } from 'vitest';
import { fetchStoreCatalog } from '../store/catalog';
import { STEP_BLURBS } from '../../data/tutorial-steps';
import { FALLBACK_NAV_ITEMS, flattenNavItems, getSectionForPage } from '../navItems';

describe('complete store catalog', () => {
  it('includes non-featured products beyond the first page', async () => {
    const rows = Array.from({ length: 211 }, (_, id) => ({ id, is_featured: false }));
    const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn(async (a, b) => ({ data: rows.slice(a, b + 1) })) };
    for (const key of ['select', 'eq', 'order']) query[key].mockReturnValue(query);
    const result = await fetchStoreCatalog({ from: () => query });
    expect(result).toEqual(rows);
    expect(query.eq.mock.calls).toEqual([['status', 'active'], ['status', 'active'], ['status', 'active']]);
    expect(query.range.mock.calls).toEqual([[0, 99], [100, 199], [200, 299]]);
  });
  it('reports query errors instead of presenting an empty catalog', async () => {
    const query = { select() { return this; }, eq() { return this; }, order() { return this; }, range: async () => ({ error: new Error('offline') }) };
    await expect(fetchStoreCatalog({ from: () => query })).rejects.toThrow('offline');
  });
});

it('explains every sidebar feature included in the tutorial', () => {
  const pages = flattenNavItems(FALLBACK_NAV_ITEMS).filter((item) => getSectionForPage(item.page_name));
  for (const item of pages) {
    expect(STEP_BLURBS[item.page_name], item.page_name).toBeDefined();
    expect(STEP_BLURBS[item.page_name].body.length).toBeGreaterThan(80);
    expect(STEP_BLURBS[item.page_name].body).not.toMatch(/use this part|click here/i);
  }
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ queries: [], responses: {} }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: (table) => {
  const query = { table, filters: [] }; mock.queries.push(query);
  const builder = {
    select() { return builder; }, eq(field, value) { query.filters.push([field, value]); return builder; },
    in(field, values) { query.filters.push([field, values]); return builder; },
    ilike() { return builder; }, order() { return builder; }, limit() { return builder; },
    then(resolve) { return Promise.resolve(mock.responses[table] || { data: [], count: 0, error: null }).then(resolve); },
  };
  return builder;
} }) }));
let client;
beforeEach(async () => {
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-test-key'); vi.resetModules();
  mock.queries = []; mock.responses = {};
  client = await import('../geckDataClient');
});

describe('shared reference data contract', () => {
  it('scopes crested references across scientific and collector species names', async () => {
    await client.getMorphReferenceImages('Harlequin');
    expect(mock.queries.find(q => q.table === 'external_reference_images').filters).toContainEqual(['species', 'Correlophus ciliatus']);
    await client.getMorphTaxonomy('Harlequin');
    expect(mock.queries.find(q => q.table === 'morph_taxonomy').filters).toContainEqual(['species', 'Correlophus ciliatus']);
  });
  it('never tops up public reference photos with marketplace listings', async () => {
    await client.getMorphReferenceImages('Harlequin');
    await client.getMorphReferenceImages('Albino', { species: 'Eublepharis macularius' });
    expect(mock.queries.some(q => q.table === 'market_listings' || q.table === 'listing_images')).toBe(false);
  });
  it('asks only for photos whose licence allows commercial use, and drops any that slip through', async () => {
    mock.responses.external_reference_images = { data: [
      { image_url: 'https://example.org/a.jpg', license: 'cc-by', attribution: '(c) A, some rights reserved (CC BY)' },
      { image_url: 'https://example.org/b.jpg', license: 'cc-by-nc', attribution: '(c) B' },
      { image_url: 'https://example.org/c.jpg', license: null, attribution: null },
      { image_url: 'https://example.org/d.jpg', license: 'CC BY-SA 4.0', attribution: '(c) D' },
    ], error: null };
    const { data } = await client.getMorphReferenceImages('Wild type');
    const query = mock.queries.find(q => q.table === 'external_reference_images');
    expect(query.filters).toContainEqual(['license', ['cc0', 'cc-by', 'cc-by-sa', 'pdm']]);
    expect(data.map((d) => d.url)).toEqual(['https://example.org/a.jpg', 'https://example.org/d.jpg']);
    expect(data[0].attribution).toContain('CC BY');
  });
});

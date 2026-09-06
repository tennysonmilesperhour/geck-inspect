import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ queries: [], responses: {} }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: (table) => {
  const query = { table, filters: [] }; mock.queries.push(query);
  const builder = {
    select() { return builder; }, eq(field, value) { query.filters.push([field, value]); return builder; },
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
    expect(mock.queries.find(q => q.table === 'market_listings').filters).toContainEqual(['species', 'crested']);
    await client.getMorphTaxonomy('Harlequin');
    expect(mock.queries.find(q => q.table === 'morph_taxonomy').filters).toContainEqual(['species', 'Correlophus ciliatus']);
  });
  it('does not supplement another species with crested listings', async () => {
    await client.getMorphReferenceImages('Albino', { species: 'Eublepharis macularius' });
    expect(mock.queries.some(q => q.table === 'market_listings')).toBe(false);
  });
  it('distinguishes a failed inventory query from a real zero count', async () => {
    mock.responses.listing_images = { data: null, count: null, error: { message: 'permission denied' } };
    expect(await client.getGeckDataTrainingStats()).toEqual({ data: null, error: 'permission denied' });
  });
});

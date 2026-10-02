import { describe, it, expect, vi, beforeEach } from 'vitest';

const existing = [];
const created = [];
vi.mock('@/lib/supabaseClient', () => ({
  supabase: { auth: { getUser: async () => ({ data: { user: { email: 'keeper@example.com' } } }) } },
}));
vi.mock('@/entities/all', () => ({
  Gecko: {
    filter: async () => existing,
    create: async (data) => { const row = { id: `new-${created.length}`, ...data }; created.push(row); return row; },
    update: async () => ({}),
  },
  BreedingPlan: { filter: async () => [], create: async () => ({}) },
  Egg: { filter: async () => [], create: async () => ({}) },
}));

const { importGeckosFromCSV } = await import('@/functions/importGeckosFromCSV');

const rows = (n) => Array.from({ length: n }, (_, i) => ({ name: `Gecko ${i + 1}` }));

describe('CSV import respects the gecko limit', () => {
  beforeEach(() => {
    existing.length = 0;
    created.length = 0;
  });

  it('adds new geckos only up to the free limit and skips the rest with a note', async () => {
    for (let i = 0; i < 7; i++) existing.push({ id: `old-${i}`, name: `Old ${i}`, archived: false });
    existing.push({ id: 'gone', name: 'Sold one', archived: true });
    const { data } = await importGeckosFromCSV({ rows: rows(5), geckoLimit: 10 });
    expect(data.results.created).toBe(3);
    expect(data.results.skippedForLimit).toBe(2);
    expect(data.results.warnings.some((w) => w.includes('up to 10 active geckos'))).toBe(true);
  });

  it('still updates geckos that already exist when the limit is full', async () => {
    for (let i = 0; i < 10; i++) existing.push({ id: `old-${i}`, name: `Old ${i}`, gecko_id_code: `C${i}`, archived: false });
    const { data } = await importGeckosFromCSV({ rows: [{ name: 'Old 0', gecko_id_code: 'C0' }, { name: 'New' }], geckoLimit: 10 });
    expect(data.results.updated).toBe(1);
    expect(data.results.created).toBe(0);
    expect(data.results.skippedForLimit).toBe(1);
  });

  it('has no limit when none is given', async () => {
    const { data } = await importGeckosFromCSV({ rows: rows(25) });
    expect(data.results.created).toBe(25);
  });
});

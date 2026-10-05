import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabaseClient', () => ({ supabase: {}, normalizeSupabaseUser: (u) => u }));

const { activeComp } = await import('../userProfile');

describe('activeComp', () => {
  const now = Date.parse('2026-11-15T00:00:00Z');

  it('returns null with no rows', () => {
    expect(activeComp([], now)).toBe(null);
    expect(activeComp(null, now)).toBe(null);
  });

  it('ignores comps that ended or have not started', () => {
    expect(activeComp([
      { tier: 'breeder', starts_at: '2026-10-01T00:00:00Z', ends_at: '2026-11-01T00:00:00Z' },
      { tier: 'breeder', starts_at: '2026-12-01T00:00:00Z', ends_at: '2027-01-01T00:00:00Z' },
    ], now)).toBe(null);
  });

  it('prefers breeder over keeper', () => {
    const comp = activeComp([
      { tier: 'keeper', starts_at: '2026-10-01T00:00:00Z', ends_at: '2027-06-01T00:00:00Z' },
      { tier: 'breeder', starts_at: '2026-10-05T00:00:00Z', ends_at: '2026-12-01T00:00:00Z' },
    ], now);
    expect(comp.tier).toBe('breeder');
  });
});

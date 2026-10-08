import { describe, it, expect } from 'vitest';
import {
  morphIdGate,
  morphIdScansLeftLabel,
  legacyFreeScansRemaining,
  isMissingScansRpc,
  loadMorphIdQuota,
} from '../morphIdQuota';

describe('morphIdGate', () => {
  it('keeps the first-free banner for an unused free try and no bonus', () => {
    const gate = morphIdGate({ isFreeTier: true, remaining: 1, bonus: 0 });
    expect(gate.locked).toBe(false);
    expect(gate.showFirstFreeBanner).toBe(true);
    expect(gate.showScansLeft).toBe(false);
  });

  it('locks a free account once the server says nothing is left', () => {
    const gate = morphIdGate({ isFreeTier: true, remaining: 0, bonus: 0 });
    expect(gate).toMatchObject({
      locked: true,
      showFirstFreeBanner: false,
      showScansLeft: false,
    });
  });

  it('counts bonus scans for a free account instead of stopping at 1', () => {
    const gate = morphIdGate({ isFreeTier: true, remaining: 11, bonus: 10 });
    expect(gate.locked).toBe(false);
    expect(gate.showFirstFreeBanner).toBe(false);
    expect(gate.showScansLeft).toBe(true);
    expect(gate.remaining).toBe(11);
  });

  it('still offers the last bonus scan when the free try is already used', () => {
    const gate = morphIdGate({ isFreeTier: true, remaining: 1, bonus: 10 });
    expect(gate.locked).toBe(false);
    expect(gate.showFirstFreeBanner).toBe(false);
    expect(gate.showScansLeft).toBe(true);
  });

  it('locks after bonus scans are used up', () => {
    expect(morphIdGate({ isFreeTier: true, remaining: 0, bonus: 10 }).locked).toBe(true);
  });

  it('adds bonus scans on top of a paid monthly allowance', () => {
    const gate = morphIdGate({ isFreeTier: false, remaining: 5, bonus: 2 });
    expect(gate.locked).toBe(false);
    expect(gate.showFirstFreeBanner).toBe(false);
    expect(gate.showScansLeft).toBe(true);
  });

  it('locks a paid account only when the server reports zero', () => {
    expect(morphIdGate({ isFreeTier: false, remaining: 0, bonus: 0 }).locked).toBe(true);
    expect(morphIdGate({ isFreeTier: false, remaining: 3, bonus: 0 }).showScansLeft).toBe(true);
  });

  it('does not lock while the server value is unknown', () => {
    const gate = morphIdGate({ isFreeTier: true });
    expect(gate.known).toBe(false);
    expect(gate.locked).toBe(false);
    expect(gate.showFirstFreeBanner).toBe(false);
  });
});

describe('morphIdScansLeftLabel', () => {
  it('uses the singular only for one scan', () => {
    expect(morphIdScansLeftLabel(1)).toBe('1 Morph ID scan left.');
    expect(morphIdScansLeftLabel(11)).toBe('11 Morph ID scans left.');
    expect(morphIdScansLeftLabel(0)).toBe('0 Morph ID scans left.');
  });
});

describe('legacy free fallback', () => {
  it('is the old one-try rule', () => {
    expect(legacyFreeScansRemaining(0)).toBe(1);
    expect(legacyFreeScansRemaining(1)).toBe(0);
    expect(legacyFreeScansRemaining(4)).toBe(0);
  });

  it('recognizes a missing scans function', () => {
    expect(isMissingScansRpc({ code: 'PGRST202', message: 'Could not find the function' })).toBe(true);
    expect(isMissingScansRpc({
      message: 'function public.morph_id_scans_remaining does not exist',
    })).toBe(true);
    expect(isMissingScansRpc({ message: 'permission denied' })).toBe(false);
  });
});

describe('loadMorphIdQuota', () => {
  function client({ rpcData = null, rpcError = null, rows = [] } = {}) {
    const usage = { data: rows, error: null };
    return {
      rpc: async (name) => {
        if (name !== 'morph_id_scans_remaining') throw new Error(`unexpected rpc ${name}`);
        return { data: rpcData, error: rpcError };
      },
      from: (table) => {
        if (table !== 'morph_id_usage') throw new Error(`unexpected table ${table}`);
        return {
          select: () => ({
            eq: () => Promise.resolve(usage),
            then: (resolve, reject) => Promise.resolve(usage).then(resolve, reject),
          }),
        };
      },
    };
  }

  it('uses the server payload, including bonus, and does not read the ledger itself', async () => {
    let readLedger = false;
    const quota = await loadMorphIdQuota({
      rpc: async () => ({ data: { remaining: 11, bonus: 10, bonus_left: 10 }, error: null }),
      from: () => { readLedger = true; throw new Error('ledger should not be read'); },
    }, { isFreeTier: true, userId: 'user-1' });
    expect(readLedger).toBe(false);
    expect(quota.remaining).toBe(11);
    expect(quota.bonus).toBe(10);
    expect(quota.locked).toBe(false);
    expect(quota.showFirstFreeBanner).toBe(false);
  });

  it('falls back to the free-try ledger only when the scans function is missing', async () => {
    const quota = await loadMorphIdQuota(client({
      rpcError: { code: 'PGRST202', message: 'Could not find morph_id_scans_remaining in the schema cache' },
      rows: [{ credits_consumed: 1 }],
    }), { isFreeTier: true, userId: 'user-1' });
    expect(quota.locked).toBe(true);
    expect(quota.remaining).toBe(0);
    expect(quota.bonus).toBe(0);
  });

  it('leaves a paid account unlocked when the scans function is missing', async () => {
    await expect(loadMorphIdQuota(client({
      rpcError: { code: 'PGRST202', message: 'Could not find morph_id_scans_remaining' },
    }), { isFreeTier: false, userId: 'user-1' })).rejects.toMatchObject({ code: 'PGRST202' });
  });
});

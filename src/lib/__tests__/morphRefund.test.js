import { describe, expect, it, vi } from 'vitest';
import { refundMorphIdCreditOnce } from '../../../supabase/functions/_shared/morph-refund.ts';

describe('refundMorphIdCreditOnce', () => {
  it('confirms a returned usage row', async () => {
    const call = vi.fn().mockResolvedValue({ data: { scans_remaining: 1 }, error: null });
    await expect(refundMorphIdCreditOnce(call)).resolves.toBe(true);
    expect(call).toHaveBeenCalledTimes(1);
  });

  it('does not retry an RPC error or an absent updated row', async () => {
    for (const result of [
      { data: null, error: new Error('rpc failed') },
      { data: null, error: null },
    ]) {
      const call = vi.fn().mockResolvedValue(result);
      await expect(refundMorphIdCreditOnce(call)).resolves.toBe(false);
      expect(call).toHaveBeenCalledTimes(1);
    }
  });

  it('does not retry a timeout after the simulated transaction commits', async () => {
    let committed = false;
    const call = vi.fn(async () => {
      committed = true;
      throw new Error('response timed out');
    });
    await expect(refundMorphIdCreditOnce(call)).resolves.toBe(false);
    expect(committed).toBe(true);
    expect(call).toHaveBeenCalledTimes(1);
  });
});

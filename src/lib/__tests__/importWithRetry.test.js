import { describe, expect, it, vi } from 'vitest';
import { importWithRetry } from '@/lib/lazyWithRetry';

// importWithRetry is lazyWithRetry's retry loop on its own, for code a page
// loads itself (the calculator's engine, src/components/breeding/
// calculatorEngine.js). A dropped download is tried again; a real error
// inside the module is not hidden behind retries.

const chunkError = () => new TypeError('Failed to fetch dynamically imported module: /assets/x.js');

describe('importWithRetry', () => {
  it('tries a failed download again and resolves with the module', async () => {
    const mod = { ready: true };
    const factory = vi.fn().mockRejectedValueOnce(chunkError()).mockResolvedValueOnce(mod);
    await expect(importWithRetry(factory, { baseDelayMs: 0 })).resolves.toBe(mod);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('surfaces an error thrown inside the module at once', async () => {
    const bug = new Error('x is not a function');
    const factory = vi.fn().mockRejectedValue(bug);
    await expect(importWithRetry(factory, { baseDelayMs: 0 })).rejects.toBe(bug);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('gives up after its retries when there is no page to reload', async () => {
    const factory = vi.fn().mockRejectedValue(chunkError());
    await expect(importWithRetry(factory, { retries: 2, baseDelayMs: 0 })).rejects.toThrow(/dynamically imported/);
    expect(factory).toHaveBeenCalledTimes(3);
  });
});

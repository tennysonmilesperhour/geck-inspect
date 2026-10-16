import { Suspense } from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { importWithRetry, isStaleChunkError, lazyOptional } from '../loadOnDemand';

// What Chrome and Safari say when a file from an older release is gone.
const stale = () => new TypeError('Failed to fetch dynamically imported module: https://geckinspect.com/assets/GrowthReel-old.js');
const safariStale = () => new TypeError('Importing a module script failed.');

describe('importWithRetry', () => {
  it('recognises a missing file, and nothing else, as a download failure', () => {
    expect(isStaleChunkError(stale())).toBe(true);
    expect(isStaleChunkError(safariStale())).toBe(true);
    expect(isStaleChunkError({ name: 'ChunkLoadError' })).toBe(true);
    expect(isStaleChunkError(new TypeError("Cannot read properties of undefined (reading 'name')"))).toBe(false);
  });

  it('tries a failed download again and returns the module once it arrives', async () => {
    const factory = vi.fn()
      .mockRejectedValueOnce(stale())
      .mockRejectedValueOnce(safariStale())
      .mockResolvedValueOnce({ default: 'ok' });
    await expect(importWithRetry(factory, { baseDelayMs: 1 })).resolves.toEqual({ default: 'ok' });
    expect(factory).toHaveBeenCalledTimes(3);
  });

  it('gives up after the retries, and never retries a bug inside the module', async () => {
    const gone = vi.fn().mockRejectedValue(stale());
    await expect(importWithRetry(gone, { baseDelayMs: 1 })).rejects.toThrow(/dynamically imported/);
    expect(gone).toHaveBeenCalledTimes(3);

    const buggy = vi.fn().mockRejectedValue(new ReferenceError('x is not defined'));
    await expect(importWithRetry(buggy, { baseDelayMs: 1 })).rejects.toThrow('x is not defined');
    expect(buggy).toHaveBeenCalledTimes(1);
  });
});

describe('lazyOptional', () => {
  it('shows the fallback instead of failing the record when a part cannot be loaded', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const Part = lazyOptional(() => Promise.reject(stale()), () => <p>left out</p>, { retries: 0 });
    let tree;
    await act(async () => {
      tree = create(<div><p>weigh-in form</p><Suspense fallback={null}><Part /></Suspense></div>);
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain('weigh-in form');
    expect(json).toContain('left out');
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('renders the part when it loads', async () => {
    const Part = lazyOptional(() => Promise.resolve({ default: () => <p>growth reel</p> }));
    let tree;
    await act(async () => { tree = create(<Suspense fallback={null}><Part /></Suspense>); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    expect(JSON.stringify(tree.toJSON())).toContain('growth reel');
  });
});

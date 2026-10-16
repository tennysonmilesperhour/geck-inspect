import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loads = vi.hoisted(() => ({ count: 0 }));
vi.mock('@/lib/supabaseClient', () => {
  loads.count += 1;
  return { supabase: { id: 'client' } };
});

import { __resetSupabaseLazy, afterFirstPaint, getSupabase, getSupabaseWhenIdle, peekSupabase } from '../supabaseLazy';

describe('lazy Supabase client', () => {
  let idle;
  beforeEach(() => {
    __resetSupabaseLazy();
    idle = [];
    vi.stubGlobal('window', { requestIdleCallback: (cb) => { idle.push(cb); return idle.length; }, addEventListener() {} });
    vi.stubGlobal('document', { readyState: 'complete' });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it('waits for the idle moment before downloading for a signed-out page', async () => {
    const pending = getSupabaseWhenIdle();
    await Promise.resolve();
    expect(peekSupabase()).toBeNull();
    expect(idle).toHaveLength(1);
    idle[0]();
    await expect(pending).resolves.toEqual({ id: 'client' });
    expect(peekSupabase()).toEqual({ id: 'client' });
  });

  it('hands every caller the same client, and skips the wait once someone loaded it', async () => {
    const now = await getSupabase();
    const later = await getSupabaseWhenIdle();
    expect(later).toBe(now);
    expect(idle).toHaveLength(0);
    expect(loads.count).toBe(1);
  });

  it('runs at the latest after the cap when the page never goes idle', () => {
    vi.useFakeTimers();
    vi.stubGlobal('document', { readyState: 'loading' });
    const fn = vi.fn();
    afterFirstPaint(fn, { maxWaitMs: 4000 });
    vi.advanceTimersByTime(3999);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVisualEmbedding } from '../../../supabase/functions/_shared/visual-embedding.ts';

const vector = Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0));

function stubReplicate() {
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    calls.push({ url, method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null });
    if (!init.method) {
      return new Response(JSON.stringify({ latest_version: { id: 'v123' } }), { status: 200 });
    }
    return new Response(JSON.stringify({ status: 'succeeded', output: vector }), { status: 201 });
  }));
  return calls;
}

describe('createVisualEmbedding', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends one prediction per photo and looks the model version up only once', async () => {
    const calls = stubReplicate();
    const model = 'someone/clip-test';

    const first = await createVisualEmbedding('https://example.com/a.webp', { token: 't', model });
    await createVisualEmbedding('https://example.com/b.webp', { token: 't', model });

    const posts = calls.filter((call) => call.method === 'POST');
    expect(posts).toHaveLength(2);
    expect(posts.every((call) => call.url === 'https://api.replicate.com/v1/predictions')).toBe(true);
    expect(posts[0].body).toEqual({ version: 'v123', input: { image: 'https://example.com/a.webp' } });
    expect(calls.filter((call) => call.method === 'GET')).toHaveLength(1);
    expect(first.embedding).toHaveLength(768);
  });

  it('reports a time-out, not a bad output, when Replicate is still starting the model', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ status: 'starting', urls: { get: 'https://api.replicate.com/v1/predictions/p1' } }),
      { status: 201 },
    )));
    await expect(createVisualEmbedding('https://example.com/d.webp', {
      token: 't', model: 'someone/clip-test:pinned', timeoutMs: 0,
    })).rejects.toThrow('Replicate timed out while the embedding model was starting up');
  });

  it('uses a pinned version without looking it up', async () => {
    const calls = stubReplicate();
    await createVisualEmbedding('https://example.com/c.webp', { token: 't', model: 'someone/clip-test:pinned' });
    expect(calls).toHaveLength(1);
    expect(calls[0].body.version).toBe('pinned');
  });
});

// One deadline for the whole embedding (17 Oct 2026). Before it, the
// prediction request waited up to 60 s with no way to stop it and a separate
// 52 s poll followed, so a cold model could hold a Morph ID run for 115 s.
describe('createVisualEmbedding with a deadline', () => {
  const NOW = Date.parse('2026-10-17T12:00:00Z');
  const pinned = 'someone/clip-test:pinned';
  // A fetch that answers only by failing when its signal aborts (at once if
  // it already has, as a real fetch does).
  const hangingFetch = () => vi.fn((url, init) => new Promise((_resolve, reject) => {
    const fail = () => reject(new DOMException('aborted', 'AbortError'));
    if (init.signal.aborted) fail();
    init.signal.addEventListener('abort', fail);
  }));

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function startClock() {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  }

  it('aborts a prediction request that never answers at the deadline', async () => {
    startClock();
    const fetch = hangingFetch();
    vi.stubGlobal('fetch', fetch);
    const result = createVisualEmbedding('https://example.com/a.webp', {
      token: 't', model: pinned, deadline: NOW + 75_000,
    });
    const settled = expect(result).rejects.toThrow('Replicate timed out while the embedding model was starting up');
    await vi.advanceTimersByTimeAsync(74_999);
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await settled;
    expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
  });

  it('asks Replicate to hold the request for the seconds left, at most 60', async () => {
    startClock();
    const prefers = [];
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      prefers.push(init.headers.Prefer);
      return new Response(JSON.stringify({ status: 'succeeded', output: vector }), { status: 201 });
    }));
    await createVisualEmbedding('https://example.com/a.webp', { token: 't', model: pinned, deadline: NOW + 75_000 });
    await createVisualEmbedding('https://example.com/a.webp', { token: 't', model: pinned, deadline: NOW + 12_000 });
    await createVisualEmbedding('https://example.com/a.webp', { token: 't', model: pinned });
    expect(prefers).toEqual(['wait=60', 'wait=12', 'wait=60']);
  });

  it('stops polling at the deadline and says the model was still starting up', async () => {
    startClock();
    const polls = [];
    const starting = { status: 'starting', urls: { get: 'https://api.replicate.com/v1/predictions/p1' } };
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      if (init.method !== 'POST') polls.push(Date.now());
      return new Response(JSON.stringify(starting), { status: init.method === 'POST' ? 201 : 200 });
    }));
    const result = createVisualEmbedding('https://example.com/a.webp', { token: 't', model: pinned, deadline: NOW + 10_000 });
    const settled = expect(result).rejects.toThrow('Replicate timed out while the embedding model was starting up');
    await vi.advanceTimersByTimeAsync(20_000);
    await settled;
    expect(polls.length).toBeGreaterThan(5);
    expect(Math.max(...polls)).toBeLessThan(NOW + 10_000);
    const count = polls.length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(polls).toHaveLength(count);
  });

  it('stops when the caller no longer needs the result', async () => {
    startClock();
    vi.stubGlobal('fetch', hangingFetch());
    const caller = new AbortController();
    const result = createVisualEmbedding('https://example.com/a.webp', {
      token: 't', model: pinned, deadline: NOW + 75_000, signal: caller.signal,
    });
    caller.abort();
    await expect(result).rejects.toThrow('Embedding request canceled');
  });

  it('waits once for Retry-After when the deadline allows, then returns the embedding', async () => {
    startClock();
    const posts = [];
    vi.stubGlobal('fetch', vi.fn(async () => {
      posts.push(Date.now());
      if (posts.length === 1) {
        return new Response(JSON.stringify({ detail: 'throttled' }), { status: 429, headers: { 'retry-after': '2' } });
      }
      return new Response(JSON.stringify({ status: 'succeeded', output: vector }), { status: 201 });
    }));
    const result = createVisualEmbedding('https://example.com/a.webp', {
      token: 't', model: pinned, deadline: NOW + 75_000, rateLimitAttempts: 2,
    });
    await vi.advanceTimersByTimeAsync(2_000);
    const { embedding } = await result;
    expect(embedding).toHaveLength(768);
    expect(posts).toEqual([NOW, NOW + 2_000]);
  });

  it('throws the same throttled error as before when the wait does not fit before the deadline', async () => {
    startClock();
    const fetch = vi.fn(async () => new Response(JSON.stringify({ detail: 'Request was throttled.' }), {
      status: 429,
      headers: { 'retry-after': '10' },
    }));
    vi.stubGlobal('fetch', fetch);
    await expect(createVisualEmbedding('https://example.com/a.webp', {
      token: 't', model: pinned, deadline: NOW + 12_000, rateLimitAttempts: 2,
    })).rejects.toThrow('Replicate 429: {"detail":"Request was throttled."}');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

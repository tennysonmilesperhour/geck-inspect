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

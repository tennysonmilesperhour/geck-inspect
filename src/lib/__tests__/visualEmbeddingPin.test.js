// The Replicate image-embedding model runs at a pinned version, not
// "latest" (engineering cleanup, 16 Oct 2026). A new version with other
// weights would put new photos in a different vector space from the
// stored ones and quietly break Morph ID's photo matching.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const vector = Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0));

async function load() {
  vi.resetModules();
  return import('../../../supabase/functions/_shared/visual-embedding.ts');
}

function stubReplicate({ refuse = null, refusal = { status: 422, body: { detail: 'Invalid version or not permitted' } } } = {}) {
  const calls = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, method: init.method || 'GET', body });
    if (!init.method) {
      return new Response(JSON.stringify({ latest_version: { id: 'latest-v' } }), { status: 200 });
    }
    if (refuse && body?.version === refuse) {
      return new Response(JSON.stringify(refusal.body), { status: refusal.status });
    }
    return new Response(JSON.stringify({ status: 'succeeded', output: vector }), { status: 201 });
  }));
  return calls;
}

let warn;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  warn.mockRestore();
});

describe('pinned Replicate version', () => {
  it('pins the default model to a full 64-character version id', async () => {
    const mod = await load();
    const pin = mod.PINNED_VISUAL_EMBEDDING_VERSIONS[mod.DEFAULT_VISUAL_EMBEDDING_MODEL];
    expect(pin).toMatch(/^[0-9a-f]{64}$/);
    expect(pin.startsWith('1c037107')).toBe(true);
  });

  it('runs the default model at the pinned version, with no "latest" lookup', async () => {
    const mod = await load();
    const calls = stubReplicate();
    const result = await mod.createVisualEmbedding('https://example.com/a.webp', { token: 't' });
    const pin = mod.PINNED_VISUAL_EMBEDDING_VERSIONS[mod.DEFAULT_VISUAL_EMBEDDING_MODEL];
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: 'POST', url: 'https://api.replicate.com/v1/predictions' });
    expect(calls[0].body.version).toBe(pin);
    expect(result).toMatchObject({ model: 'krthr/clip-embeddings', version: pin });
    expect(result.embedding).toHaveLength(768);
  });

  it('falls back to the latest version once if Replicate refuses the pin, and says so', async () => {
    const mod = await load();
    const pin = mod.PINNED_VISUAL_EMBEDDING_VERSIONS[mod.DEFAULT_VISUAL_EMBEDDING_MODEL];
    const calls = stubReplicate({ refuse: pin });

    const first = await mod.createVisualEmbedding('https://example.com/a.webp', { token: 't' });
    expect(first.version).toBe('latest-v');
    expect(calls.map((c) => c.method)).toEqual(['POST', 'GET', 'POST']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`refused pinned version ${pin}`));

    // The next photo goes straight to the working version.
    await mod.createVisualEmbedding('https://example.com/b.webp', { token: 't' });
    expect(calls.slice(3).map((c) => [c.method, c.body?.version])).toEqual([['POST', 'latest-v']]);
  });

  it('a model named with its own version keeps that version', async () => {
    const mod = await load();
    const calls = stubReplicate();
    const result = await mod.createVisualEmbedding('https://example.com/c.webp', { token: 't', model: 'someone/clip:abc' });
    expect(calls).toHaveLength(1);
    expect(calls[0].body.version).toBe('abc');
    expect(result.version).toBe('abc');
  });

  it('a model with no pin still looks its latest version up, once', async () => {
    const mod = await load();
    const calls = stubReplicate();
    await mod.createVisualEmbedding('https://example.com/d.webp', { token: 't', model: 'someone/other-clip' });
    await mod.createVisualEmbedding('https://example.com/e.webp', { token: 't', model: 'someone/other-clip' });
    expect(calls.filter((c) => c.method === 'GET')).toHaveLength(1);
    expect(calls.filter((c) => c.method === 'POST').every((c) => c.body.version === 'latest-v')).toBe(true);
  });

  it('a 404 for the pinned version also falls back to the latest version', async () => {
    const mod = await load();
    const pin = mod.PINNED_VISUAL_EMBEDDING_VERSIONS[mod.DEFAULT_VISUAL_EMBEDDING_MODEL];
    stubReplicate({ refuse: pin, refusal: { status: 404, body: { detail: 'Not found.' } } });
    const result = await mod.createVisualEmbedding('https://example.com/f.webp', { token: 't' });
    expect(result.version).toBe('latest-v');
  });

  // Replicate also answers 422 for a bad input. One odd photo must not move
  // the instance off the pin (and maybe into another vector space) for
  // every later photo: that photo fails on its own and the pin stays.
  it('an input error is that photo\'s error and keeps the pin', async () => {
    const mod = await load();
    const pin = mod.PINNED_VISUAL_EMBEDDING_VERSIONS[mod.DEFAULT_VISUAL_EMBEDDING_MODEL];
    const calls = stubReplicate({
      refuse: pin,
      refusal: {
        status: 422,
        body: {
          title: 'Input validation failed',
          detail: '- input.image: Does not match format uri',
          invalid_fields: [{ type: 'format', field: 'input.image', description: 'Does not match format uri' }],
        },
      },
    });
    await expect(mod.createVisualEmbedding('not a url', { token: 't' })).rejects.toThrow(/Replicate 422: .*Input validation failed/);
    expect(calls.map((c) => c.method)).toEqual(['POST']);
    expect(warn).not.toHaveBeenCalled();

    // The next photo still runs at the pinned version.
    vi.unstubAllGlobals();
    const next = stubReplicate();
    const result = await mod.createVisualEmbedding('https://example.com/g.webp', { token: 't' });
    expect(next[0].body.version).toBe(pin);
    expect(result.version).toBe(pin);
  });

  it('tells a refused version from other refusals', async () => {
    const mod = await load();
    const answer = (status, body) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status });
    expect(await mod.refusedVersion(answer(404, { detail: 'Not found.' }))).toBe(true);
    expect(await mod.refusedVersion(answer(422, { title: 'Invalid version or not permitted', detail: 'The specified version does not exist (or perhaps you do not have permission to use it?)' }))).toBe(true);
    expect(await mod.refusedVersion(answer(422, 'Invalid version'))).toBe(true);
    // An input error stays an input error even if a field mentions "version".
    expect(await mod.refusedVersion(answer(422, { title: 'Input validation failed', detail: 'image', invalid_fields: [{ field: 'input.version' }] }))).toBe(false);
    expect(await mod.refusedVersion(answer(422, { title: 'Unprocessable', detail: 'image could not be read' }))).toBe(false);
    expect(await mod.refusedVersion(answer(429, { detail: 'throttled' }))).toBe(false);
    expect(await mod.refusedVersion(answer(500, 'version'))).toBe(false);
  });
});

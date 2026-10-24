// Waking Morph ID's photo-matching model while the member picks photos
// (17 Oct 2026). The server side is supabase/functions/_shared/morph-warm.ts,
// the page side src/lib/morphIdWarmup.js. No member photo is ever part of it.
import { existsSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_WARM_IMAGE_URL,
  WARM_MIN_GAP_MS,
  WARM_SURFACE,
  buildWarmRequest,
  isWarmRequest,
  shouldWarm,
  warmVersionFor,
} from '../../../supabase/functions/_shared/morph-warm.ts';
import {
  DEFAULT_VISUAL_EMBEDDING_MODEL,
  PINNED_VISUAL_EMBEDDING_VERSIONS,
} from '../../../supabase/functions/_shared/visual-embedding.ts';
import { WARM_GAP_MS, resetMorphIdWarmup, warmMorphId } from '../morphIdWarmup.js';

const MEMBER_PHOTO = 'https://mmuglfphhwlaluyfyxsp.supabase.co/storage/v1/object/public/uploads/member-top.webp';
const OPTIONS = { token: 'r8_test', model: DEFAULT_VISUAL_EMBEDDING_MODEL, imageUrl: DEFAULT_WARM_IMAGE_URL };

describe('buildWarmRequest', () => {
  it('posts the pinned version and the project photo to /v1/predictions', () => {
    const request = buildWarmRequest({ action: 'warm' }, OPTIONS);
    expect(request.url).toBe('https://api.replicate.com/v1/predictions');
    expect(request.init.method).toBe('POST');
    expect(JSON.parse(request.init.body)).toEqual({
      version: PINNED_VISUAL_EMBEDDING_VERSIONS[DEFAULT_VISUAL_EMBEDDING_MODEL],
      input: { image: DEFAULT_WARM_IMAGE_URL },
    });
    expect(request.init.headers.Authorization).toBe('Token r8_test');
  });

  it('sends no Prefer header, so Replicate answers as soon as it queues the prediction', () => {
    const { headers } = buildWarmRequest({ action: 'warm' }, OPTIONS).init;
    expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain('prefer');
  });

  it('ignores any photo URLs in the body', () => {
    const request = buildWarmRequest({ action: 'warm', imageUrls: [MEMBER_PHOTO], imageUrl: MEMBER_PHOTO }, OPTIONS);
    expect(request.init.body).not.toContain(MEMBER_PHOTO);
    expect(JSON.parse(request.init.body).input).toEqual({ image: DEFAULT_WARM_IMAGE_URL });
  });

  it('is only for a warm-up body, and only for a model with a known version', () => {
    expect(buildWarmRequest({ imageUrls: [MEMBER_PHOTO] }, OPTIONS)).toBeNull();
    expect(buildWarmRequest(null, OPTIONS)).toBeNull();
    expect(buildWarmRequest({ action: 'warm' }, { ...OPTIONS, model: 'someone/unpinned' })).toBeNull();
    expect(warmVersionFor('someone/model:abc123')).toBe('abc123');
    expect(isWarmRequest({ action: 'warm' })).toBe(true);
    expect(isWarmRequest({ action: 'identify' })).toBe(false);
  });

  it('warms with a photo the project serves from public/', () => {
    const url = new URL(DEFAULT_WARM_IMAGE_URL);
    expect(url.hostname).toBe('geckinspect.com');
    expect(existsSync(new URL(`../../../public${url.pathname}`, import.meta.url))).toBe(true);
  });

  it('logs under its own surface, which the per-network cap never counts', () => {
    expect(WARM_SURFACE).toBe('morph_id_warm');
    expect(WARM_SURFACE).not.toBe('morph_id_production');
  });
});

describe('shouldWarm', () => {
  const now = Date.parse('2026-10-17T12:00:00Z');

  it('skips when the newest warm-up is under 60 s old', () => {
    expect(WARM_MIN_GAP_MS).toBe(60_000);
    expect(shouldWarm('2026-10-17T11:59:30Z', now)).toBe(false);
    expect(shouldWarm('2026-10-17T11:59:00.001Z', now)).toBe(false);
  });

  it('sends when the newest is older or missing', () => {
    expect(shouldWarm('2026-10-17T11:59:00Z', now)).toBe(true);
    expect(shouldWarm('2026-10-17T11:00:00Z', now)).toBe(true);
    expect(shouldWarm(null, now)).toBe(true);
    expect(shouldWarm(undefined, now)).toBe(true);
    expect(shouldWarm('not a date', now)).toBe(true);
  });
});

describe('warmMorphId (page side)', () => {
  let invoke;
  let client;
  let confirm;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-17T12:00:00Z'));
    resetMorphIdWarmup();
    invoke = vi.fn(async () => ({ data: { warmed: true }, error: null }));
    client = { functions: { invoke } };
    confirm = vi.fn(() => true);
    vi.stubGlobal('window', { confirm });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('sends { action: "warm" } on mount, and again on a top-view pick only after 3 minutes', () => {
    expect(WARM_GAP_MS).toBe(180_000);
    // Page opens.
    expect(warmMorphId({ client })).toBe(true);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith('recognize-gecko-morph', { body: { action: 'warm' } });
    // Top view picked a minute later: the model is still warm, nothing sent.
    vi.advanceTimersByTime(60_000);
    expect(warmMorphId({ client })).toBe(false);
    expect(invoke).toHaveBeenCalledTimes(1);
    // Picked again after the member lingered past 3 minutes.
    vi.advanceTimersByTime(120_000);
    expect(warmMorphId({ client })).toBe(true);
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(invoke.mock.calls[1]).toEqual(['recognize-gecko-morph', { body: { action: 'warm' } }]);
  });

  it('never asks for AI consent, because no member data is sent', () => {
    warmMorphId({ client });
    expect(confirm).not.toHaveBeenCalled();
  });

  it('ignores a rejected or throwing call', async () => {
    invoke.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    expect(() => warmMorphId({ client })).not.toThrow();
    await Promise.resolve();
    resetMorphIdWarmup();
    const throwing = { functions: { invoke: () => { throw new Error('no client'); } } };
    expect(() => warmMorphId({ client: throwing })).not.toThrow();
  });
});

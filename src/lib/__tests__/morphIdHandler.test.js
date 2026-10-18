// recognize-gecko-morph end to end, with the database and the providers
// replaced by fakes (17 Oct 2026). The function's own source is loaded with
// its URL imports swapped for the real shared modules, so the request
// handler that runs here is the one that deploys. It checks the parts the
// step tests cannot: the answer the page and the share card read, the
// Server-Timing header, the warm-up, the fail-fast timeout and the retry of
// a cut-off answer.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
// TypeScript 5's compiler API (see edgeHarness.js).
import ts from 'typescript5';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeSupabase, payloadOf, postJson } from './edgeHarness.js';
import * as taxonomy from '../../../supabase/functions/recognize-gecko-morph/taxonomy.ts';
import * as request from '../../../supabase/functions/recognize-gecko-morph/request.ts';
import * as evidence from '../../../supabase/functions/_shared/morph-evidence.ts';
import * as naming from '../../../supabase/functions/_shared/morph-naming.ts';
import * as upstream from '../../../supabase/functions/_shared/morph-upstream.ts';
import * as refund from '../../../supabase/functions/_shared/morph-refund.ts';
import * as clientIpModule from '../../../supabase/functions/_shared/client-ip.ts';
import * as modelCost from '../../../supabase/functions/_shared/model-cost.ts';
import * as embedding from '../../../supabase/functions/_shared/visual-embedding.ts';
import * as budget from '../../../supabase/functions/_shared/morph-budget.ts';
import * as timing from '../../../supabase/functions/_shared/morph-timing.ts';
import * as steps from '../../../supabase/functions/_shared/morph-steps.ts';
import * as warm from '../../../supabase/functions/_shared/morph-warm.ts';

const ENV = {
  SUPABASE_URL: 'https://proj.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-key',
  ANTHROPIC_API_KEY: 'sk-ant-test',
  REPLICATE_API_TOKEN: 'r8_test',
};
const MEMBER = { id: 'user-1', email: 'member@example.com', app_metadata: {} };
const TOP = 'https://proj.supabase.co/storage/v1/object/public/uploads/top.webp';
const SIDE = 'https://proj.supabase.co/storage/v1/object/public/uploads/side.webp';
const VECTOR = Array.from({ length: 768 }, (_, i) => (i === 0 ? 1 : 0));
const NEIGHBORS = ['harlequin', 'extreme_harlequin', 'pinstripe'].map((morph, i) => ({
  id: `n${i}`,
  image_url: `https://ref.example.com/n${i}.webp`,
  primary_morph: morph,
  genetic_traits: [],
  secondary_traits: [],
  base_color: null,
  similarity: 0.8 - i * 0.05,
  label_weight: 0.9,
  label_source: 'geck-data-scraper',
  source_cluster: `seller:${i}`,
}));
const ANSWER = {
  primary_morph: 'harlequin',
  confidence_score: 70,
  candidate_morphs: [{ morph: 'harlequin', score: 70, why: 'Cream on the flanks and legs' }],
  visual_profile: { pattern_family: 'harlequin', pinning: 'none', banding: 'none', spotting: 'none', white_cream_traits: [] },
  evidence_markers: ['Flank pattern'],
  uncertainty_reasons: [],
  photo_observations: [{ photo_number: 1, view: 'dorsal', quality_grade: 'good', contributes_to_result: true, evidence_signal: 70, visible_features: [], limitations: [] }],
  photo_assessment: { subject_is_crested_gecko: true, usable_for_id: true, quality_grade: 'good', issues: [], next_photo_needed: '' },
  explanation: 'Cream pattern on the flanks and legs.',
};

function anthropicOk(input = ANSWER) {
  return { status: 200, body: { content: [{ type: 'tool_use', input }], usage: { input_tokens: 1600, output_tokens: 1400 }, stop_reason: 'tool_use' } };
}

function database({ lastWarm = null } = {}) {
  return fakeSupabase((call) => {
    if (call.table === 'profiles') return { data: { membership_tier: 'keeper', role: null, subscription_status: null, morph_id_show_value_estimate: false }, error: null };
    if (call.rpc === 'effective_tier_for_current_user') return { data: 'keeper', error: null };
    if (call.rpc === 'consume_morph_id_credit') return { data: { credits_consumed: 1 }, error: null };
    if (call.rpc === 'morph_id_scans_remaining') return { data: { remaining: 2 }, error: null };
    if (call.rpc === 'refund_morph_id_credit') return { data: true, error: null };
    if (call.rpc === 'morph_visual_neighbors') return { data: NEIGHBORS, error: null };
    if (call.table === 'model_invocations' && call.ops[0][0] === 'select') return { data: lastWarm ? { called_at: lastWarm } : null, error: null };
    return { data: null, error: null };
  }, { user: MEMBER });
}

function load({ db = database(), answer = () => ({ status: 201, body: { status: 'succeeded', output: VECTOR } }) } = {}) {
  const requests = [];
  const fetch = vi.fn(async (url, init = {}) => {
    const entry = { url: String(url), init, body: init.body ? JSON.parse(init.body) : null };
    requests.push(entry);
    const reply = await answer(entry);
    return new Response(JSON.stringify(reply.body), { status: reply.status, headers: { 'content-type': 'application/json', ...(reply.headers || {}) } });
  });
  vi.stubGlobal('fetch', fetch);
  const logs = [];
  let handler = null;
  const src = readFileSync(new URL('../../../supabase/functions/recognize-gecko-morph/index.ts', import.meta.url), 'utf8')
    .replace(/^import[\s\S]*?;\n/gm, '');
  const context = vm.createContext({
    Deno: { env: { get: (key) => ENV[key] } },
    serve: (fn) => { handler = fn; },
    createClient: () => db.client,
    fetch,
    Response, Request, Headers, URL, TextEncoder, crypto, Date, JSON, Math, Promise, Error, Array, Object, Number, String, Set, Map,
    AbortController, AbortSignal, DOMException, setTimeout, clearTimeout,
    console: { log: (line) => logs.push(line), warn() {}, error() {}, info() {} },
    ...taxonomy, ...request, ...evidence, ...naming, ...upstream, ...refund, ...clientIpModule, ...modelCost,
    ...embedding, ...budget, ...timing, ...steps, ...warm,
  });
  vm.runInContext(ts.transpile(src, { target: ts.ScriptTarget.ES2022 }), context);
  return { handle: (req) => handler(req), requests, db, logs };
}

const post = (body) => postJson('https://proj.supabase.co/functions/v1/recognize-gecko-morph', body, { authorization: 'Bearer member-jwt' });
const anthropicCalls = (requests) => requests.filter((r) => r.url.startsWith('https://api.anthropic.com/'));
const replicateCalls = (requests) => requests.filter((r) => r.url.startsWith('https://api.replicate.com/'));

describe('recognize-gecko-morph handler', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('answers with the same fields as before, a Server-Timing header and the request key settled', async () => {
    const fn = load({
      answer: (r) => (r.url.startsWith('https://api.anthropic.com/') ? anthropicOk() : { status: 201, body: { status: 'succeeded', output: VECTOR } }),
    });
    const res = await fn.handle(post({ imageUrls: [TOP, SIDE], request_key: 'key-12345678', age_stage: 'juvenile' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body)).toEqual([
      'success', 'analysis', 'model', 'photo_count', 'few_shot_count', 'tier', 'is_admin',
      'credits_included', 'credits_consumed', 'credits_remaining', 'credit_refunded',
      'value_estimate_included', 'image_urls',
    ]);
    expect(body).toMatchObject({ success: true, tier: 'keeper', credits_consumed: 1, credits_remaining: 2, credit_refunded: false, image_urls: [TOP, SIDE] });
    expect(body.analysis.visual_evidence.status).toBe('available');
    expect(body.analysis.age_stage).toBe('juvenile');

    const header = res.headers.get('server-timing');
    for (const step of ['auth', 'db', 'embed', 'neighbors', 'claude', 'writes', 'total']) {
      expect(header).toMatch(new RegExp(`${step};dur=\\d+`));
    }
    expect(res.headers.get('access-control-expose-headers')).toContain('Server-Timing');

    // The analyzer read the same request the snapshot guards, with the new ceiling.
    const [call] = anthropicCalls(fn.requests);
    expect(call.body.max_tokens).toBe(4096);
    expect(call.body.messages[0].content.filter((b) => b.type === 'image')).toHaveLength(5);

    const settle = fn.db.table('morph_id_requests').find((c) => c.ops[0][0] === 'update');
    expect(payloadOf(settle)).toMatchObject({ status: 'done', response: body });
    const spend = fn.db.table('model_invocations').find((c) => c.ops[0][0] === 'insert');
    expect(payloadOf(spend)).toMatchObject({ surface: 'morph_id_production', error_code: null, photo_count: 2 });

    // One timing line, with no URL or member detail in it.
    const line = fn.logs.find((l) => typeof l === 'string' && l.includes('morph_id_timing'));
    expect(JSON.parse(line)).toMatchObject({ outcome: 'ok', status: 200, photos: 2 });
    expect(line).not.toMatch(/https?:|@|user-1/);
  });

  it('warms the model with the project photo, takes no credit and logs a zero-cost row', async () => {
    const fn = load({ answer: () => ({ status: 201, body: { id: 'pred-1', status: 'starting' } }) });
    const res = await fn.handle(post({ action: 'warm', imageUrls: [TOP] }));
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ warmed: true });
    const calls = replicateCalls(fn.requests);
    expect(calls).toHaveLength(1);
    expect(calls[0].body.input).toEqual({ image: warm.DEFAULT_WARM_IMAGE_URL });
    expect(JSON.stringify(fn.requests)).not.toContain(TOP);
    expect(Object.keys(calls[0].init.headers).map((h) => h.toLowerCase())).not.toContain('prefer');
    expect(anthropicCalls(fn.requests)).toHaveLength(0);
    expect(fn.db.rpcCalls('consume_morph_id_credit')).toHaveLength(0);
    expect(fn.db.table('profiles')).toHaveLength(0);
    expect(fn.db.table('morph_id_requests')).toHaveLength(0);
    const row = payloadOf(fn.db.table('model_invocations').find((c) => c.ops[0][0] === 'insert'));
    expect(row).toMatchObject({ surface: 'morph_id_warm', est_cost_cents: 0, input_tokens: 0, output_tokens: 0, user_id: 'user-1', request_id: 'pred-1', error_code: null });
  });

  it('skips the warm-up when another one went out in the last minute', async () => {
    const fn = load({ db: database({ lastWarm: new Date(Date.now() - 20_000).toISOString() }) });
    const res = await fn.handle(post({ action: 'warm' }));
    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ warmed: false, reason: 'recent' });
    expect(replicateCalls(fn.requests)).toHaveLength(0);
  });

  it('does not call the analyzer when the photo-matching model is still booting, and hands the scan back', async () => {
    const fn = load({
      // Replicate still starting, with no way to poll: the embedding gives up
      // the way it does at its deadline.
      answer: (r) => (r.url.startsWith('https://api.anthropic.com/') ? anthropicOk() : { status: 201, body: { status: 'starting' } }),
    });
    const res = await fn.handle(post({ imageUrls: [TOP, SIDE], request_key: 'key-12345678' }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body).toMatchObject({
      code: 'upstream_timeout',
      user_message: upstream.PROVIDER_UNAVAILABLE_MESSAGE,
      credit_refunded: true,
      failure_kind: 'provider_unavailable',
    });
    expect(anthropicCalls(fn.requests)).toHaveLength(0);
    expect(fn.db.rpcCalls('refund_morph_id_credit')).toHaveLength(1);
    const settle = fn.db.table('morph_id_requests').find((c) => c.ops[0][0] === 'update');
    expect(payloadOf(settle)).toMatchObject({ status: 'failed' });
    const row = payloadOf(fn.db.table('model_invocations').find((c) => c.ops[0][0] === 'insert'));
    expect(row).toMatchObject({ error_code: 'upstream_timeout', duration_ms: 0 });
  });

  it('answers without references when the embedding fails outright, as before', async () => {
    const fn = load({
      answer: (r) => (r.url.startsWith('https://api.anthropic.com/') ? anthropicOk() : { status: 422, body: { detail: 'Input validation failed', invalid_fields: ['image'] } }),
    });
    const res = await fn.handle(post({ imageUrls: [TOP] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.analysis.visual_evidence.status).toBe('unavailable');
    expect(anthropicCalls(fn.requests)).toHaveLength(1);
  });

  it('retries an answer cut off at the ceiling with twice the room and nothing else changed', async () => {
    let calls = 0;
    const fn = load({
      answer: (r) => {
        if (!r.url.startsWith('https://api.anthropic.com/')) return { status: 201, body: { status: 'succeeded', output: VECTOR } };
        calls += 1;
        return calls === 1
          ? { status: 200, body: { content: [{ type: 'tool_use', input: {} }], usage: { input_tokens: 1, output_tokens: 4096 }, stop_reason: 'max_tokens' } }
          : anthropicOk();
      },
    });
    const res = await fn.handle(post({ imageUrls: [TOP] }));
    expect(res.status).toBe(200);
    const [first, second] = anthropicCalls(fn.requests);
    expect(first.body.max_tokens).toBe(4096);
    expect(second.body.max_tokens).toBe(8192);
    const { max_tokens: _a, ...firstRest } = first.body;
    const { max_tokens: _b, ...secondRest } = second.body;
    expect(JSON.stringify(secondRest)).toBe(JSON.stringify(firstRest));
  });

  it('answers a repeat from the stored result without a credit or the analyzer', async () => {
    const stored = { success: true, analysis: { primary_morph: 'harlequin' } };
    const db = fakeSupabase((call) => {
      if (call.table === 'profiles') return { data: { membership_tier: 'keeper' }, error: null };
      if (call.rpc === 'effective_tier_for_current_user') return { data: 'keeper', error: null };
      if (call.table === 'morph_id_requests' && call.ops[0][0] === 'insert') return { error: { code: '23505', message: 'duplicate' } };
      if (call.table === 'morph_id_requests' && call.ops[0][0] === 'select') return { data: { status: 'done', response: stored, updated_at: new Date().toISOString() }, error: null };
      return { data: null, error: null };
    }, { user: MEMBER });
    const fn = load({ db });
    const res = await fn.handle(post({ imageUrls: [TOP], request_key: 'key-12345678' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ...stored, replayed: true });
    expect(db.rpcCalls('consume_morph_id_credit')).toHaveLength(0);
    expect(anthropicCalls(fn.requests)).toHaveLength(0);
    // The repeat's photo never goes to Replicate.
    expect(replicateCalls(fn.requests)).toHaveLength(0);
  });

  it('never sends a photo to Replicate when the member has no scans left', async () => {
    const db = fakeSupabase((call) => {
      if (call.table === 'profiles') return { data: { membership_tier: 'free' }, error: null };
      if (call.rpc === 'effective_tier_for_current_user') return { data: 'free', error: null };
      if (call.rpc === 'consume_morph_id_credit') return { data: null, error: { message: 'morph_id_credits_exhausted' } };
      return { data: null, error: null };
    }, { user: MEMBER });
    const fn = load({ db });
    const res = await fn.handle(post({ imageUrls: [TOP], request_key: 'key-12345678' }));
    expect(res.status).toBe(402);
    expect((await res.json()).code).toBe('morph_id_credits_exhausted');
    expect(replicateCalls(fn.requests)).toHaveLength(0);
    expect(anthropicCalls(fn.requests)).toHaveLength(0);
  });

  it('gives the embedding less time when Claude will read more photos', async () => {
    const preferFor = async (imageUrls) => {
      const fn = load({
        answer: (r) => (r.url.startsWith('https://api.anthropic.com/') ? anthropicOk() : { status: 201, body: { status: 'succeeded', output: VECTOR } }),
      });
      const res = await fn.handle(post({ imageUrls }));
      expect(res.status).toBe(200);
      const [embed] = replicateCalls(fn.requests);
      return embed.init.headers.Prefer;
    };
    // One photo: the embedding has until 69.5 s, so Replicate's full 60 s hold.
    expect(await preferFor([TOP])).toBe('wait=60');
    // Five photos: until 59 s from arrival, so the whole seconds left of that
    // once the request has been read (59 when that takes under a millisecond,
    // 58, or 57 on a slow machine), always under one photo's 60.
    const fivePhotos = Number((await preferFor([TOP, SIDE, TOP, SIDE, TOP])).replace('wait=', ''));
    expect(fivePhotos).toBeLessThanOrEqual(59);
    expect(fivePhotos).toBeGreaterThanOrEqual(57);
  });

  it('refuses a signed-out caller before any lookup starts', async () => {
    const db = fakeSupabase(() => ({ data: null, error: null }), { user: null });
    const fn = load({ db });
    const res = await fn.handle(post({ imageUrls: [TOP] }));
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe('auth_required');
    expect(fn.requests).toHaveLength(0);
  });
});

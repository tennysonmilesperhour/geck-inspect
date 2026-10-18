// The order of Morph ID's steps before the analyzer call
// (supabase/functions/_shared/morph-steps.ts, 17 Oct 2026): independent
// database reads run together, a repeat never spends a credit, and the photo
// lookup (a Replicate prediction for the caller's photo) starts only once the
// call will reach the analyzer, so no early exit ever reaches Replicate.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  finishAfterResponse,
  newStepState,
  runMorphSteps,
} from '../../../supabase/functions/_shared/morph-steps.ts';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Lets every pending promise callback run.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const USER = { id: 'user-1', email: 'member@example.com', app_metadata: {} };
const BODY = { imageUrls: ['https://storage.example.com/top.webp'], request_key: 'key-12345678' };

const POLICY = {
  configured: true,
  ipHash: 'hash-1',
  parseRequest: (body) => (Array.isArray(body.imageUrls) && body.imageUrls.length
    ? { imageUrls: body.imageUrls, ageStage: 'unknown', firedState: 'unknown', requestKey: body.request_key ?? null }
    : null),
  resolveTier: (profile) => profile.membership_tier || 'free',
  creditsFor: () => 1,
  resolveModel: () => 'claude-sonnet-4-6',
  resolveSurface: () => 'morph_id_production',
};

// Each network call is a deferred promise the test resolves by hand, and
// every call is recorded in order.
function harness(overrides = {}) {
  const log = [];
  const calls = {};
  const step = (name) => (...args) => {
    log.push(name);
    calls[name] = { args, ...deferred() };
    return calls[name].promise;
  };
  const deps = {
    getUser: step('getUser'),
    readBody: step('readBody'),
    startEvidence: vi.fn((imageUrls, signal) => {
      log.push('startEvidence');
      calls.startEvidence = { imageUrls, signal, ...deferred() };
      return calls.startEvidence.promise;
    }),
    loadProfileRow: step('loadProfileRow'),
    loadEffectiveTier: step('loadEffectiveTier'),
    fetchPerIpCap: step('fetchPerIpCap'),
    countIpCalls: step('countIpCalls'),
    claimRequestKey: step('claimRequestKey'),
    consumeCredit: step('consumeCredit'),
    readScansRemaining: step('readScansRemaining'),
    settleRequestKey: vi.fn(async (...args) => {
      log.push('settleRequestKey');
      calls.settleRequestKey = { args };
    }),
    ...overrides,
  };
  const state = newStepState('claude-sonnet-4-6');
  const run = runMorphSteps(deps, POLICY, state);
  return { log, calls, deps, state, run };
}

// Walks a request up to the claim, resolving each step in turn.
async function upToClaim(h, { body = BODY } = {}) {
  await flush();
  h.calls.getUser.resolve(USER);
  h.calls.readBody.resolve(body);
  await flush();
  h.calls.loadProfileRow.resolve({ membership_tier: 'keeper', role: null });
  h.calls.loadEffectiveTier.resolve({ data: 'keeper', error: null });
  await flush();
  h.calls.fetchPerIpCap.resolve(10);
  h.calls.countIpCalls.resolve(1);
  await flush();
}

describe('runMorphSteps', () => {
  it('reads the sign-in and the body together', async () => {
    const h = harness();
    await flush();
    expect(h.log).toEqual(['getUser', 'readBody']);
    h.calls.getUser.resolve(null);
    h.calls.readBody.resolve(BODY);
    await expect(h.run).resolves.toEqual({ kind: 'auth_failed', error: 'auth required' });
  });

  it('starts the embedding only once the scan is reserved, together with the scans-left read', async () => {
    const h = harness();
    await upToClaim(h);
    expect(h.deps.startEvidence).not.toHaveBeenCalled();
    h.calls.claimRequestKey.resolve({ kind: 'claimed' });
    await flush();
    expect(h.deps.startEvidence).not.toHaveBeenCalled();
    h.calls.consumeCredit.resolve({ data: { credits_consumed: 1 }, error: null });
    const outcome = await h.run;
    expect(outcome.kind).toBe('ready');
    expect(h.log.slice(-4)).toEqual(['claimRequestKey', 'consumeCredit', 'startEvidence', 'readScansRemaining']);
    expect(h.calls.startEvidence.imageUrls).toEqual(BODY.imageUrls);
    expect(h.deps.startEvidence).toHaveBeenCalledTimes(1);
  });

  it('starts profile, plan and the two per-network reads together', async () => {
    const h = harness();
    await flush();
    h.calls.getUser.resolve(USER);
    h.calls.readBody.resolve(BODY);
    await flush();
    // All four started while none has answered.
    expect(h.log).toEqual(['getUser', 'readBody', 'fetchPerIpCap', 'countIpCalls', 'loadProfileRow', 'loadEffectiveTier']);
    expect(h.calls.countIpCalls.args).toEqual(['hash-1']);
    h.calls.fetchPerIpCap.resolve(10);
    h.calls.countIpCalls.resolve(1);
    h.calls.loadProfileRow.resolve({ membership_tier: 'keeper' });
    await flush();
    // The claim waits for the plan.
    expect(h.calls.claimRequestKey).toBeUndefined();
    h.calls.loadEffectiveTier.resolve({ data: 'keeper', error: null });
    await flush();
    expect(h.calls.claimRequestKey).toBeDefined();
    expect(h.deps.startEvidence).not.toHaveBeenCalled();
  });

  it('waits for the per-network reads before the claim when they are slower than the plan', async () => {
    const h = harness();
    await flush();
    h.calls.getUser.resolve(USER);
    h.calls.readBody.resolve(BODY);
    await flush();
    h.calls.loadProfileRow.resolve({ membership_tier: 'keeper' });
    h.calls.loadEffectiveTier.resolve({ data: 'keeper', error: null });
    await flush();
    expect(h.calls.claimRequestKey).toBeUndefined();
    h.calls.fetchPerIpCap.resolve(10);
    h.calls.countIpCalls.resolve(1);
    await flush();
    expect(h.calls.claimRequestKey).toBeDefined();
  });

  it('claims the key before the credit and has the credit taken before it reports ready', async () => {
    const h = harness();
    await upToClaim(h);
    expect(h.log.at(-1)).toBe('claimRequestKey');
    expect(h.calls.consumeCredit).toBeUndefined();
    h.calls.claimRequestKey.resolve({ kind: 'claimed' });
    await flush();
    expect(h.log.at(-1)).toBe('consumeCredit');
    expect(h.calls.consumeCredit.args).toEqual(['user-1', 'keeper', 1]);
    let settled = false;
    h.run.then(() => { settled = true; });
    await flush();
    expect(settled).toBe(false);
    h.calls.consumeCredit.resolve({ data: { credits_consumed: 2 }, error: null });
    const outcome = await h.run;
    expect(outcome.kind).toBe('ready');
    expect(h.state.creditWasConsumed).toBe(true);
    expect(h.state.creditsConsumed).toBe(2);
    expect(h.state.claimedKey).toBe('key-12345678');
    // The scans-left read started after the credit and does not hold up ready.
    expect(h.log.indexOf('readScansRemaining')).toBeGreaterThan(h.log.indexOf('consumeCredit'));
    expect(outcome.scansRemaining).toBeInstanceOf(Promise);
    h.calls.readScansRemaining.resolve(4);
    await expect(outcome.scansRemaining).resolves.toBe(4);
    // The embedding started after the credit and is still wanted.
    expect(h.log.indexOf('startEvidence')).toBeGreaterThan(h.log.indexOf('consumeCredit'));
    expect(h.calls.startEvidence.signal.aborted).toBe(false);
    h.calls.startEvidence.resolve({ evidence: { status: 'available' }, timedOut: false });
    await expect(outcome.evidence).resolves.toMatchObject({ timedOut: false });
  });

  it('never takes a credit or reaches Replicate after a replay', async () => {
    const h = harness();
    await upToClaim(h);
    h.calls.claimRequestKey.resolve({ kind: 'replay', response: { success: true } });
    await expect(h.run).resolves.toEqual({ kind: 'replay', response: { success: true } });
    expect(h.calls.consumeCredit).toBeUndefined();
    expect(h.deps.startEvidence).not.toHaveBeenCalled();
  });

  it('never takes a credit or reaches Replicate while the first run is still going (409)', async () => {
    // A double tap: the second request must not post a prediction that
    // competes with the first one's under Replicate's one-at-a-time limit.
    const h = harness();
    await upToClaim(h);
    h.calls.claimRequestKey.resolve({ kind: 'running' });
    await expect(h.run).resolves.toEqual({ kind: 'running' });
    expect(h.calls.consumeCredit).toBeUndefined();
    expect(h.deps.startEvidence).not.toHaveBeenCalled();
  });

  it('never reaches Replicate on the per-network limit, and takes no claim or credit', async () => {
    const h = harness();
    await flush();
    h.calls.getUser.resolve(USER);
    h.calls.readBody.resolve(BODY);
    await flush();
    h.calls.loadProfileRow.resolve({});
    h.calls.loadEffectiveTier.resolve({ data: 'free', error: null });
    await flush();
    h.calls.fetchPerIpCap.resolve(3);
    h.calls.countIpCalls.resolve(3);
    await expect(h.run).resolves.toEqual({ kind: 'ip_limited', cap: 3, used: 3 });
    expect(h.calls.claimRequestKey).toBeUndefined();
    expect(h.deps.startEvidence).not.toHaveBeenCalled();
  });

  it('never reaches Replicate when the scans are used up (402) or the credit check fails, and settles the key', async () => {
    for (const [message, kind] of [
      ['morph_id_credits_exhausted', 'credits_exhausted'],
      ['connection reset', 'credit_check_failed'],
    ]) {
      const h = harness();
      await upToClaim(h);
      h.calls.claimRequestKey.resolve({ kind: 'claimed' });
      await flush();
      h.calls.consumeCredit.resolve({ data: null, error: { message } });
      const outcome = await h.run;
      expect(outcome.kind).toBe(kind);
      expect(h.deps.settleRequestKey).toHaveBeenCalledWith('user-1', 'key-12345678', 'failed', null);
      expect(h.state.creditWasConsumed).toBe(false);
      expect(h.deps.startEvidence).not.toHaveBeenCalled();
      expect(h.calls.readScansRemaining).toBeUndefined();
    }
  });

  it('never starts the embedding when sign-in fails', async () => {
    for (const fail of [(c) => c.getUser.resolve(null), (c) => c.getUser.reject(new Error('jwt expired'))]) {
      const h = harness();
      await flush();
      fail(h.calls);
      h.calls.readBody.resolve(BODY);
      const outcome = await h.run;
      expect(outcome.kind).toBe('auth_failed');
      expect(h.deps.startEvidence).not.toHaveBeenCalled();
    }
  });

  it('never reaches Replicate when the plan cannot be verified', async () => {
    const h = harness();
    await flush();
    h.calls.getUser.resolve(USER);
    h.calls.readBody.resolve(BODY);
    await flush();
    h.calls.loadProfileRow.resolve({});
    h.calls.loadEffectiveTier.resolve({ data: null, error: { message: 'rpc failed' } });
    await expect(h.run).resolves.toEqual({
      kind: 'auth_failed',
      error: 'auth lookup failed: Could not verify membership access',
    });
    expect(h.deps.startEvidence).not.toHaveBeenCalled();
  });

  it('answers a warm-up after sign-in alone, without the embedding, profile or credit', async () => {
    const h = harness();
    await flush();
    h.calls.getUser.resolve(USER);
    h.calls.readBody.resolve({ action: 'warm', imageUrls: ['https://storage.example.com/top.webp'] });
    const outcome = await h.run;
    expect(outcome.kind).toBe('warm');
    expect(h.log).toEqual(['getUser', 'readBody']);
    expect(h.deps.startEvidence).not.toHaveBeenCalled();
  });

  it('rejects a request with no usable photo before starting anything', async () => {
    const h = harness();
    await flush();
    h.calls.getUser.resolve(USER);
    h.calls.readBody.resolve({ imageUrls: [] });
    await expect(h.run).resolves.toEqual({ kind: 'bad_request' });
    expect(h.deps.startEvidence).not.toHaveBeenCalled();
  });

  it('skips the claim and the credit for admin and evaluation calls', async () => {
    const h = harness();
    await flush();
    h.calls.getUser.resolve({ ...USER, app_metadata: { morph_eval: true } });
    h.calls.readBody.resolve(BODY);
    await flush();
    h.calls.loadProfileRow.resolve({ role: null });
    h.calls.loadEffectiveTier.resolve({ data: 'free', error: null });
    await flush();
    h.calls.fetchPerIpCap.resolve(null);
    h.calls.countIpCalls.resolve(0);
    const outcome = await h.run;
    expect(outcome.kind).toBe('ready');
    expect(outcome.scansRemaining).toBeNull();
    expect(h.calls.claimRequestKey).toBeUndefined();
    expect(h.calls.consumeCredit).toBeUndefined();
    expect(h.calls.readScansRemaining).toBeUndefined();
    expect(h.state.isEvalAccount).toBe(true);
    // No scan to wait for: the embedding starts right after the cap check.
    expect(h.log.at(-1)).toBe('startEvidence');
  });

  it('does not wait for the per-network reads when the cap does not apply (admin), and ignores their failure', async () => {
    const h = harness();
    await flush();
    h.calls.getUser.resolve(USER);
    h.calls.readBody.resolve(BODY);
    await flush();
    h.calls.loadProfileRow.resolve({ role: 'admin' });
    h.calls.loadEffectiveTier.resolve({ data: 'enterprise', error: null });
    const outcome = await h.run;
    expect(outcome.kind).toBe('ready');
    expect(h.state.isAdmin).toBe(true);
    expect(h.calls.claimRequestKey).toBeUndefined();
    expect(h.calls.consumeCredit).toBeUndefined();
    expect(h.deps.startEvidence).toHaveBeenCalledTimes(1);
    // Rejecting a read nobody awaits must not surface as an unhandled rejection.
    h.calls.fetchPerIpCap.reject(new Error('cap read failed'));
    h.calls.countIpCalls.reject(new Error('count failed'));
    await flush();
  });

  it('rethrows when a step throws, before the embedding starts', async () => {
    const h = harness();
    await upToClaim(h);
    h.calls.claimRequestKey.resolve({ kind: 'claimed' });
    await flush();
    h.calls.consumeCredit.reject(new Error('socket hang up'));
    await expect(h.run).rejects.toThrow('socket hang up');
    expect(h.deps.startEvidence).not.toHaveBeenCalled();
    expect(h.state.claimedKey).toBe('key-12345678');
    expect(h.state.creditWasConsumed).toBe(false);
  });
});

describe('finishAfterResponse', () => {
  afterEach(() => {
    delete globalThis.EdgeRuntime;
  });

  it('hands the write to EdgeRuntime.waitUntil and returns at once', async () => {
    const waitUntil = vi.fn();
    globalThis.EdgeRuntime = { waitUntil };
    const write = deferred();
    let done = false;
    finishAfterResponse(write.promise).then(() => { done = true; });
    await flush();
    expect(done).toBe(true);
    expect(waitUntil).toHaveBeenCalledTimes(1);
    write.resolve();
    await expect(waitUntil.mock.calls[0][0]).resolves.toBeUndefined();
  });

  it('waits for the write when there is no EdgeRuntime', async () => {
    const write = deferred();
    let done = false;
    finishAfterResponse(write.promise).then(() => { done = true; });
    await flush();
    expect(done).toBe(false);
    write.resolve();
    await flush();
    expect(done).toBe(true);
  });

  it('never lets a failed write reach the response', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(finishAfterResponse(Promise.reject(new Error('insert failed')))).resolves.toBeUndefined();
    const waitUntil = vi.fn();
    globalThis.EdgeRuntime = { waitUntil };
    await expect(finishAfterResponse(Promise.reject(new Error('insert failed')))).resolves.toBeUndefined();
    await expect(waitUntil.mock.calls[0][0]).resolves.toBeUndefined();
    error.mockRestore();
  });
});

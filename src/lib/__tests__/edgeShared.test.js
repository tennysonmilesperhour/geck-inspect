// The shared edge-function helpers (supabase/functions/_shared/http.ts and
// caller.ts) and the three functions moved onto them in October 2026:
// stripe-billing-portal, iot-poll and send-push. Each function test checks
// the answers the function gave before the move (status, body, headers,
// who the database client acts as), so the move changed no behaviour.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { actionOf, fakeFetch, fakeSupabase, filterValue, loadFunction, postJson } from './edgeHarness';

// Loads one _shared module the way the harness loads a function: imports
// dropped (the test hands in what they provided), compiled, run in a
// sandbox. Returns its exports.
function loadShared(name, globals = {}) {
  const src = readFileSync(new URL(`../../../supabase/functions/_shared/${name}.ts`, import.meta.url), 'utf8')
    .replace(/^import [^;\n]*;\n/gm, '')
    .replace(/^export (type )?\{[^}]*\} from [^;\n]*;\n/gm, '');
  const exports = {};
  const context = vm.createContext({
    exports, Response, Request, Headers, URL, TextEncoder,
    console: { log() {}, warn() {}, error() {}, info() {} },
    ...globals,
  });
  vm.runInContext(ts.transpile(src, { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS }), context);
  return exports;
}

// A createClient stand-in that hands out one fake database and remembers
// how each client was made (which key, which Authorization header).
function clientFactory(db) {
  const made = [];
  const createClient = (url, key, options = {}) => {
    made.push({ url, key, authorization: options?.global?.headers?.Authorization || null });
    return db.client;
  };
  return { createClient, made };
}

function sharedGlobals(createClient) {
  const http = loadShared('http');
  const caller = loadShared('caller', { createClient, bearerToken: http.bearerToken });
  // iot-poll and send-push import json under the name jsonWith, because
  // each keeps a local json() that adds its CORS headers.
  return { ...http, jsonWith: http.json, ...caller, createClient };
}

const ENV = {
  SUPABASE_URL: 'https://project.example.test',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
};
const MEMBER = { id: 'u1', email: 'keeper@example.test' };
const bearer = (token) => ({ authorization: `Bearer ${token}` });

describe('_shared/http.ts', () => {
  const http = loadShared('http');

  it('json() sets the content type and keeps extra headers', async () => {
    const res = http.json({ ok: true }, 201, http.CORS_HEADERS);
    expect(res.status).toBe(201);
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(await res.json()).toEqual({ ok: true });
  });

  it('preflight() answers OPTIONS with "ok" and lets anything else through', async () => {
    const pre = http.preflight(new Request('https://x.test', { method: 'OPTIONS' }));
    expect(pre.status).toBe(200);
    expect(await pre.text()).toBe('ok');
    expect(pre.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS');
    expect(http.preflight(new Request('https://x.test', { method: 'POST' }))).toBeNull();
  });

  it('bearerToken() reads "Bearer <token>" in any letter case, and nothing else', () => {
    const req = (value) => new Request('https://x.test', { headers: value ? { authorization: value } : {} });
    expect(http.bearerToken(req('Bearer abc'))).toBe('abc');
    expect(http.bearerToken(req('bearer  abc '))).toBe('abc');
    expect(http.bearerToken(req('Token abc'))).toBe('');
    expect(http.bearerToken(req(null))).toBe('');
  });
});

describe('_shared/caller.ts', () => {
  it('constantTimeEqual compares exactly', () => {
    const { constantTimeEqual } = sharedGlobals(() => null);
    expect(constantTimeEqual('abc', 'abc')).toBe(true);
    expect(constantTimeEqual('abc', 'abd')).toBe(false);
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });

  it('signedInCaller gives the member and a client acting as them', async () => {
    const db = fakeSupabase(() => undefined, { user: MEMBER });
    const { createClient, made } = clientFactory(db);
    const { signedInCaller } = sharedGlobals(createClient);
    const caller = await signedInCaller(postJson('https://x.test', {}, bearer('jwt-1')), { supabaseUrl: ENV.SUPABASE_URL, apiKey: 'anon-key' });
    expect(caller.user).toEqual(MEMBER);
    expect(caller.token).toBe('jwt-1');
    expect(made).toEqual([{ url: ENV.SUPABASE_URL, key: 'anon-key', authorization: 'Bearer jwt-1' }]);
  });

  it('signedInCaller is null with no token or a token the auth server rejects', async () => {
    const db = fakeSupabase(() => undefined, { user: null });
    const { signedInCaller } = sharedGlobals(clientFactory(db).createClient);
    const opts = { supabaseUrl: ENV.SUPABASE_URL, apiKey: 'anon-key' };
    expect(await signedInCaller(postJson('https://x.test', {}), opts)).toBeNull();
    expect(await signedInCaller(postJson('https://x.test', {}, bearer('expired')), opts)).toBeNull();
  });

  it('isTrustedServerCaller takes the service-role key or the dispatch secret, nothing else', async () => {
    const db = fakeSupabase((call) => (call.rpc === 'verify_notification_dispatch_secret'
      ? { data: call.args.p_secret === 'vault-secret', error: null }
      : undefined));
    const { isTrustedServerCaller } = sharedGlobals(clientFactory(db).createClient);
    const opts = { supabaseUrl: ENV.SUPABASE_URL, serviceRoleKey: 'service-role-key' };
    expect(await isTrustedServerCaller('service-role-key', opts)).toBe(true);
    expect(db.rpcCalls('verify_notification_dispatch_secret')).toHaveLength(0);
    expect(await isTrustedServerCaller('vault-secret', opts)).toBe(true);
    expect(await isTrustedServerCaller('member-jwt', opts)).toBe(false);
    expect(await isTrustedServerCaller('', opts)).toBe(false);
  });

  it('isTrustedServerCaller says no when the check itself fails', async () => {
    const db = fakeSupabase((call) => (call.rpc ? { data: null, error: { message: 'down' } } : undefined));
    const { isTrustedServerCaller } = sharedGlobals(clientFactory(db).createClient);
    expect(await isTrustedServerCaller('anything', { supabaseUrl: ENV.SUPABASE_URL, serviceRoleKey: 'k' })).toBe(false);
  });
});

describe('stripe-billing-portal on the shared helpers', () => {
  function portal({ profile, user = MEMBER } = {}) {
    const db = fakeSupabase((call) => (call.table === 'profiles' ? { data: profile, error: null } : undefined), { user });
    const { createClient, made } = clientFactory(db);
    const stripe = fakeFetch(() => ({ body: { url: 'https://billing.stripe.test/session' } }));
    const fn = loadFunction('stripe-billing-portal', {
      env: { ...ENV, STRIPE_SECRET_KEY: 'sk_test' },
      globals: { ...sharedGlobals(createClient), fetch: stripe.fetch },
    });
    return { fn, db, made, stripe };
  }

  it('answers the CORS preflight', async () => {
    const { fn } = portal();
    const res = await fn.handle(new Request('https://x.test', { method: 'OPTIONS' }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('refuses other methods and callers with no session', async () => {
    const { fn } = portal({ user: null });
    expect((await fn.handle(new Request('https://x.test', { method: 'GET' }))).status).toBe(405);
    const noAuth = await fn.handle(postJson('https://x.test', {}));
    expect(noAuth.status).toBe(401);
    expect(await noAuth.json()).toEqual({ error: 'unauthenticated' });
    const badToken = await fn.handle(postJson('https://x.test', {}, bearer('expired')));
    expect(badToken.status).toBe(401);
  });

  it('opens a portal session for the member, back to our own site only', async () => {
    const { fn, made, stripe, db } = portal({ profile: { stripe_customer_id: 'cus_1', subscription_status: 'active', membership_billing_cycle: 'monthly' } });
    const res = await fn.handle(postJson('https://x.test', { returnUrl: 'https://evil.test/' }, bearer('jwt-1')));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://billing.stripe.test/session' });
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    // The member is identified with the service-role key plus their token.
    expect(made[0]).toEqual({ url: ENV.SUPABASE_URL, key: 'service-role-key', authorization: 'Bearer jwt-1' });
    expect(filterValue(db.table('profiles')[0], 'eq', 'email')).toBe(MEMBER.email);
    const form = new URLSearchParams(stripe.requests[0].init.body.toString());
    expect(stripe.requests[0].url).toBe('https://api.stripe.com/v1/billing_portal/sessions');
    expect(form.get('customer')).toBe('cus_1');
    expect(form.get('return_url')).toBe('https://geckinspect.com/Membership');
  });

  it('keeps its plain answers for lifetime, grandfathered and no billing record', async () => {
    const lifetime = await portal({ profile: { stripe_customer_id: 'cus_1', membership_billing_cycle: 'lifetime' } })
      .fn.handle(postJson('https://x.test', {}, bearer('jwt-1')));
    expect(lifetime.status).toBe(400);
    expect((await lifetime.json()).error).toBe('lifetime');
    const grand = await portal({ profile: { subscription_status: 'grandfathered' } })
      .fn.handle(postJson('https://x.test', {}, bearer('jwt-1')));
    expect((await grand.json()).error).toBe('grandfathered');
    const none = await portal({ profile: null }).fn.handle(postJson('https://x.test', {}, bearer('jwt-1')));
    expect(none.status).toBe(404);
    expect((await none.json()).error).toBe('no_billing_account');
  });
});

describe('iot-poll on the shared helpers', () => {
  function poll({ tier = 'keeper', user = MEMBER, conn = { id: 'c1', api_key: 'govee-key' }, role = 'user' } = {}) {
    const db = fakeSupabase((call) => {
      if (call.rpc === 'effective_tier_for_current_user') return { data: tier, error: null };
      if (call.rpc === 'consume_feature_credit') return { data: { credits_included: 200, credits_consumed: 5 }, error: null };
      if (call.table === 'profiles') return { data: { role }, error: null };
      if (call.table === 'iot_connections' && actionOf(call) === 'select') return { data: conn, error: null };
      return undefined;
    }, { user });
    const { createClient, made } = clientFactory(db);
    const govee = fakeFetch((req) => (req.url.endsWith('/devices')
      ? { body: { data: { devices: [{ device: 'd1', model: 'H5075', deviceName: 'Rack A' }] } } }
      : { body: { data: { properties: [{ temperature: 77 }, { humidity: 65 }] } } }));
    const fn = loadFunction('iot-poll', { env: ENV, globals: { ...sharedGlobals(createClient), fetch: govee.fetch } });
    return { fn, db, made, govee };
  }

  it('asks for a sign-in with no session', async () => {
    const res = await poll({ user: null }).fn.handle(postJson('https://x.test', {}));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Sign in to read sensors.', code: 'unauthenticated' });
  });

  it('is a paid feature on Free', async () => {
    const res = await poll({ tier: 'free' }).fn.handle(postJson('https://x.test', {}, bearer('jwt-1')));
    expect(res.status).toBe(402);
    expect((await res.json()).code).toBe('iot_polls_credits_exhausted');
  });

  it('reads the sensors as the member, spending one credit', async () => {
    const { fn, db, made, govee } = poll();
    const res = await fn.handle(postJson('https://x.test', {}, bearer('jwt-1')));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.credits_remaining).toBe(195);
    expect(body.devices[0]).toMatchObject({ device: 'd1', name: 'Rack A', supported: true, readings: { temp_f: 77, temp_c: 25, humidity: 65 } });
    // The tier and credit checks run on the member's own client.
    expect(made[0]).toEqual({ url: ENV.SUPABASE_URL, key: 'anon-key', authorization: 'Bearer jwt-1' });
    expect(db.rpcCalls('consume_feature_credit')[0].args).toMatchObject({ p_feature: 'iot_poll', p_tier: 'keeper', p_included: 200, p_cost: 1 });
    expect(govee.requests[0].init.headers['Govee-API-Key']).toBe('govee-key');
  });
});

describe('send-push on the shared helpers', () => {
  function push({ profile = { push_notifications_enabled: true, push_notification_types: ['new_message'] }, subs = [{ id: 's1', endpoint: 'https://push.test/1', p256dh: 'k', auth: 'a' }] } = {}) {
    const db = fakeSupabase((call) => {
      if (call.rpc === 'verify_notification_dispatch_secret') return { data: call.args.p_secret === 'vault-secret', error: null };
      if (call.table === 'profiles') return { data: profile, error: null };
      if (call.table === 'push_subscriptions' && actionOf(call) === 'select') return { data: subs, error: null };
      return undefined;
    });
    const sent = [];
    const webpush = {
      setVapidDetails() {},
      sendNotification: async (sub, payload) => { sent.push({ sub, payload: JSON.parse(payload) }); },
    };
    const fn = loadFunction('send-push', {
      env: { ...ENV, VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv' },
      globals: { ...sharedGlobals(clientFactory(db).createClient), webpush },
    });
    return { fn, db, sent };
  }
  const payload = { user_email: 'Keeper@Example.test', type: 'new_message', title: 'New message', body: 'Hi', url: '/Messages' };

  it('refuses a caller that is neither the server key nor the dispatch secret', async () => {
    const { fn, sent } = push();
    expect((await fn.handle(postJson('https://x.test', payload))).status).toBe(401);
    expect((await fn.handle(postJson('https://x.test', payload, bearer('member-jwt')))).status).toBe(401);
    expect(sent).toHaveLength(0);
  });

  it('delivers for the database trigger, which sends the dispatch secret', async () => {
    const { fn, sent, db } = push();
    const res = await fn.handle(postJson('https://x.test', payload, bearer('vault-secret')));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ delivered: 1, pruned: 0 });
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(sent[0].payload).toMatchObject({ title: 'New message', body: 'Hi', url: '/Messages', data: { type: 'new_message' } });
    expect(filterValue(db.table('profiles')[0], 'eq', 'email')).toBe('keeper@example.test');
  });

  it('accepts the service-role key and still honours the member switches', async () => {
    const { fn, sent } = push({ profile: { push_notifications_enabled: false } });
    const res = await fn.handle(postJson('https://x.test', payload, bearer('service-role-key')));
    expect(await res.json()).toEqual({ delivered: 0, pruned: 0, skipped: 'master-off' });
    expect(sent).toHaveLength(0);
  });

  it('answers the CORS preflight', async () => {
    const res = await push().fn.handle(new Request('https://x.test', { method: 'OPTIONS' }));
    expect(await res.text()).toBe('ok');
  });
});

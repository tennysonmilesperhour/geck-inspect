// Test harness for the Supabase Edge Functions (Deno code under
// supabase/functions). The functions cannot be imported by Vitest because
// they import from URLs and call Deno.serve, so this loads a function's
// source, drops its single-line imports, compiles it with TypeScript and
// runs it in a sandbox where the imports and Deno are replaced with fakes.
// The request handler it registers is captured so a test can send it a
// real Request and read the real Response.
//
// fakeSupabase records every database call (table or RPC, the chained
// filters, the payload) and answers each one from a function the test
// provides, so a test can say "this write fails" and check what the
// function does about it.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
// TypeScript 5's compiler API: TypeScript 7 (the typecheck) has none yet.
import ts from 'typescript5';

export function functionSource(name) {
  return readFileSync(new URL(`../../../supabase/functions/${name}/index.ts`, import.meta.url), 'utf8');
}

// The first chained call says what kind of query it is.
export const actionOf = (call) => call.ops[0]?.[0];
export const payloadOf = (call) => call.ops[0]?.[1];
export const optionsOf = (call) => call.ops[0]?.[2];
export const filterValue = (call, method, column) =>
  call.ops.find(([op, col]) => op === method && col === column)?.[2];

export function fakeSupabase(respond = () => undefined, { user = null } = {}) {
  const calls = [];
  const builder = (base) => {
    const call = { ...base, ops: [] };
    const proxy = new Proxy({}, {
      get(_target, prop) {
        if (prop === 'then') {
          return (onOk, onErr) => {
            calls.push(call);
            return Promise.resolve()
              .then(() => respond(call))
              .then((result) => result ?? { data: null, error: null })
              .then(onOk, onErr);
          };
        }
        return (...args) => {
          call.ops.push([prop, ...args]);
          return proxy;
        };
      },
    });
    return proxy;
  };
  const client = {
    from: (table) => builder({ table }),
    rpc: (fn, args) => builder({ rpc: fn, args }),
    auth: {
      getUser: async () => ({ data: { user }, error: user ? null : { message: 'no user' } }),
    },
  };
  const of = (pred) => calls.filter(pred);
  return {
    client,
    calls,
    table: (name) => of((c) => c.table === name),
    rpcCalls: (name) => of((c) => c.rpc === name),
  };
}

// Loads one function. env is what Deno.env.get returns; globals adds or
// replaces sandbox globals (fetch, createClient, helper imports).
export function loadFunction(name, { env = {}, globals = {} } = {}) {
  let handler = null;
  const capture = (fn) => {
    handler = fn;
  };
  const src = functionSource(name).replace(/^import [^;\n]*;\n/gm, '');
  const context = vm.createContext({
    Deno: { env: { get: (key) => env[key] }, serve: capture },
    serve: capture,
    Response,
    Request,
    Headers,
    TextEncoder,
    URL,
    URLSearchParams,
    crypto,
    // The test's own Date, so a clock frozen with vi.setSystemTime (or
    // moved by scripts/test-clock-drift.mjs) is the function's clock too.
    // A fresh vm context would otherwise bring its own, real Date.
    Date,
    console: { log() {}, warn() {}, error() {}, info() {} },
    // Waits (the email burst spreading, retries) run at once in tests.
    setTimeout: (fn) => {
      fn();
      return 0;
    },
    clearTimeout: () => {},
    ...globals,
  });
  vm.runInContext(ts.transpile(src, { target: ts.ScriptTarget.ES2020 }), context);
  return {
    context,
    handle: (req) => {
      if (!handler) throw new Error(`${name} registered no handler`);
      return handler(req);
    },
  };
}

// A fetch stand-in that records requests and answers from a function.
export function fakeFetch(answer = () => ({ status: 200, body: {} })) {
  const requests = [];
  const fetch = async (url, init = {}) => {
    const request = { url: String(url), init, body: init.body ? safeJson(init.body) : null };
    requests.push(request);
    const { status = 200, body = {} } = (await answer(request)) || {};
    return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  };
  return { fetch, requests };
}

function safeJson(body) {
  if (typeof body !== 'string') return body;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

export function postJson(url, body, headers = {}) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

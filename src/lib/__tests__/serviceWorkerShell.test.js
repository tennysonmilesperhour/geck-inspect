import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

// Loads the real public/sw.js with stand-in caches and network, then walks
// through the case that broke offline logging: a member opens their shared
// Morph ID card (a page the server builds without the app), then opens
// /log with no signal. The worker must still hand back the app.
const swSource = readFileSync(fileURLToPath(new URL('../../../public/sw.js', import.meta.url)), 'utf8');

const APP_HTML = '<!doctype html><title>Geck Inspect</title><div id="root"></div><script type="module" src="/assets/index-abc.js"></script>';

function pageFor(pathname) {
  if (pathname.startsWith('/morph-id/r/')) {
    return {
      body: '<!doctype html><title>Likely Harlequin crested gecko | Geck Inspect Morph ID</title><main class="card">card</main>',
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'private, no-store' },
    };
  }
  if (pathname.startsWith('/api/share')) {
    return { body: '<!doctype html><title>Shared gecko</title>', headers: { 'content-type': 'text/html; charset=utf-8' } };
  }
  if (pathname === '/llms.txt') {
    return { body: '# Geck Inspect', headers: { 'content-type': 'text/plain; charset=utf-8' } };
  }
  return { body: APP_HTML, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=0, must-revalidate' } };
}

function loadWorker(stores = new Map()) {
  const keyOf = (req) => (typeof req === 'string' ? req : new URL(req.url).pathname);
  const state = { online: true };
  const fetchImpl = async (req) => {
    if (!state.online) throw new TypeError('Failed to fetch');
    const { pathname } = new URL(req.url);
    const { body, headers } = pathname.startsWith('/assets/')
      ? { body: 'console.log("app")', headers: { 'content-type': 'text/javascript' } }
      : pageFor(pathname);
    const res = new Response(body, { status: 200, headers });
    Object.defineProperty(res, 'type', { value: 'basic' });
    return res;
  };
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      const cache = {
        async put(req, res) { store.set(keyOf(req), { body: await res.text(), headers: Object.fromEntries(res.headers) }); },
        async match(req) {
          const hit = store.get(keyOf(req));
          return hit ? new Response(hit.body, { headers: hit.headers }) : undefined;
        },
        async add(url) { await cache.put(url, await fetchImpl({ url: `https://geckinspect.com${url}` })); },
      };
      return cache;
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  const listeners = {};
  const self = {
    addEventListener: (type, fn) => { listeners[type] = fn; },
    location: { origin: 'https://geckinspect.com' },
    skipWaiting() {},
    clients: { claim: async () => {} },
  };
  vm.runInNewContext(swSource, { self, caches, fetch: fetchImpl, URL, Response, console });

  async function request(path, mode) {
    let responded;
    const req = { method: 'GET', mode, url: `https://geckinspect.com${path}` };
    listeners.fetch({ request: req, respondWith: (p) => { responded = p; } });
    return (await responded).text();
  }
  const navigate = (path) => request(path, 'navigate');
  const asset = (path) => request(path, 'cors');
  async function lifecycle(type) {
    const waits = [];
    listeners[type]({ waitUntil: (p) => waits.push(p) });
    await Promise.all(waits);
  }
  return { navigate, asset, lifecycle, state, stores };
}

describe('service worker offline shell', () => {
  it('still opens the app offline after a shared Morph ID card was viewed', async () => {
    const sw = loadWorker();
    expect(await sw.navigate('/Dashboard')).toBe(APP_HTML);
    expect(await sw.navigate('/morph-id/r/0123456789abcdef')).toContain('Likely Harlequin');
    sw.state.online = false;
    const offline = await sw.navigate('/log?type=weight&gecko=g1');
    expect(offline).toBe(APP_HTML);
  });

  it('never stores a server page, a no-store page or a plain file as the shell', async () => {
    const sw = loadWorker();
    await sw.navigate('/MyGeckos');
    await sw.navigate('/api/share?gecko=abc');
    await sw.navigate('/llms.txt');
    await sw.navigate('/morph-id/r/0123456789abcdef');
    sw.state.online = false;
    expect(await sw.navigate('/FieldMode')).toBe(APP_HTML);
  });

  it('on update, drops a shell the old worker stored but keeps the app files for offline use', async () => {
    // What the old worker left behind: a share card stored as the shell,
    // and the app's own files.
    const stores = new Map([
      ['geck-shell-v1', new Map([['/', { body: '<title>Likely Harlequin crested gecko</title>', headers: { 'content-type': 'text/html' } }]])],
      ['geck-static-v1', new Map([['/assets/index-abc.js', { body: 'console.log("app")', headers: { 'content-type': 'text/javascript' } }]])],
    ]);
    const sw = loadWorker(stores);
    await sw.lifecycle('install');
    await sw.lifecycle('activate');
    expect(stores.has('geck-shell-v1')).toBe(false);
    expect(stores.has('geck-static-v1')).toBe(true);
    sw.state.online = false;
    expect(await sw.navigate('/log?type=feeding&gecko=g1')).toBe(APP_HTML);
    // The visit that installed the worker did not fetch the app's files
    // again, so they must still be there for the first offline visit.
    expect(await sw.asset('/assets/index-abc.js')).toBe('console.log("app")');
  });
});

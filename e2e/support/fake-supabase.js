// An in-memory stand-in for Supabase, answered inside the browser by
// Playwright, so the member flow runs with no project, no keys and no
// network (plan item E3 30). It covers what the flow touches: email sign
// up and sign in, PostgREST reads and writes with the common filters, the
// RPCs the flow calls, edge functions, storage and the Realtime socket.
//
// It is deliberately simple. Rows live in plain arrays per table; reads
// apply eq, neq, in, is, gt, gte, lt, lte, like, ilike and `or` filters,
// order and limit; anything it does not understand returns every row of
// the table, which is enough for a smoke flow and never throws.
//
// Every request is recorded in `calls`, so a test can assert what the app
// actually wrote (the feeding row, the transfer request).

export const FAKE_SUPABASE_URL = 'https://e2e.supabase.test';
// supabase-js keeps the session under sb-<first label of the host>-auth-token.
export const FAKE_STORAGE_KEY = 'sb-e2e-auth-token';

const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

function makeJwt(user, expiresAt) {
  return [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', exp: expiresAt }),
    'e2e-signature',
  ].join('.');
}

let idCounter = 0;
const uuid = () => {
  idCounter += 1;
  return `00000000-0000-4000-8000-${String(idCounter).padStart(12, '0')}`;
};

// ---------------------------------------------------------------------------
// PostgREST filtering

function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

function compare(value, op, raw) {
  const text = raw === undefined ? '' : decodeURIComponent(raw);
  const asNumber = Number(text);
  const numeric = text !== '' && Number.isFinite(asNumber) && typeof value === 'number';
  const rhs = numeric ? asNumber : text;
  switch (op) {
    case 'eq':
      return String(value) === String(rhs);
    case 'neq':
      return String(value) !== String(rhs);
    case 'gt':
      return value != null && value > rhs;
    case 'gte':
      return value != null && value >= rhs;
    case 'lt':
      return value != null && value < rhs;
    case 'lte':
      return value != null && value <= rhs;
    case 'is':
      if (text === 'null') return value === null || value === undefined;
      if (text === 'true') return value === true;
      if (text === 'false') return value === false;
      return true;
    case 'in': {
      const list = text.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, ''));
      return list.includes(String(value));
    }
    case 'like':
    case 'ilike': {
      const pattern = new RegExp(`^${text.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*')}$`, op === 'ilike' ? 'i' : '');
      return pattern.test(String(value ?? ''));
    }
    default:
      return true; // unknown operator: do not filter
  }
}

function matchesCondition(row, column, expr) {
  let negate = false;
  let rest = expr;
  if (rest.startsWith('not.')) {
    negate = true;
    rest = rest.slice(4);
  }
  const dot = rest.indexOf('.');
  const op = dot === -1 ? rest : rest.slice(0, dot);
  const raw = dot === -1 ? undefined : rest.slice(dot + 1);
  const result = compare(row?.[column], op, raw);
  return negate ? !result : result;
}

function matchesOr(row, groupText) {
  // or=(a.eq.1,b.eq.2) ; nested and(...) is treated as all-of.
  const inner = groupText.replace(/^\(|\)$/g, '');
  return splitTopLevel(inner).some((part) => {
    if (part.startsWith('and(')) {
      return splitTopLevel(part.slice(4, -1)).every((p) => matchesPart(row, p));
    }
    return matchesPart(row, part);
  });
}

function matchesPart(row, part) {
  const dot = part.indexOf('.');
  if (dot === -1) return true;
  return matchesCondition(row, part.slice(0, dot), part.slice(dot + 1));
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

function applyFilters(rows, params) {
  return rows.filter((row) => {
    for (const [key, value] of params) {
      if (RESERVED.has(key)) continue;
      if (key === 'or') {
        if (!matchesOr(row, value)) return false;
        continue;
      }
      if (key === 'and') {
        if (!splitTopLevel(value.replace(/^\(|\)$/g, '')).every((p) => matchesPart(row, p))) return false;
        continue;
      }
      if (key.includes('.')) continue; // embedded resource filter: ignore
      if (!matchesCondition(row, key, value)) return false;
    }
    return true;
  });
}

function applyOrderAndLimit(rows, params) {
  let out = [...rows];
  const order = params.get('order');
  if (order) {
    const keys = order.split(',').map((term) => {
      const [col, dir = 'asc'] = term.split('.');
      return { col, desc: dir === 'desc' };
    });
    out.sort((a, b) => {
      for (const { col, desc } of keys) {
        const x = a[col];
        const y = b[col];
        if (x === y) continue;
        if (x == null) return 1;
        if (y == null) return -1;
        return (x < y ? -1 : 1) * (desc ? -1 : 1);
      }
      return 0;
    });
  }
  const offset = Number(params.get('offset') || 0);
  const limit = params.get('limit');
  out = out.slice(offset, limit ? offset + Number(limit) : undefined);
  return out;
}

// ---------------------------------------------------------------------------

/**
 * Builds the fake. `seed` pre-fills tables, `rpc` adds or replaces RPC
 * handlers (name -> (args, db) => result).
 */
export function createFakeSupabase({ seed = {}, rpc = {} } = {}) {
  const tables = new Map(Object.entries(seed).map(([name, rows]) => [name, rows.map((r) => ({ ...r }))]));
  const table = (name) => {
    if (!tables.has(name)) tables.set(name, []);
    return tables.get(name);
  };
  const accounts = new Map(); // email -> { user, password }
  const calls = [];
  let currentUser = null;

  const nowIso = () => new Date().toISOString();

  function sessionFor(user) {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    return {
      access_token: makeJwt(user, expiresAt),
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: expiresAt,
      refresh_token: `refresh-${user.id}`,
      user,
    };
  }

  function profileFor(user) {
    let profile = table('profiles').find((p) => p.email === user.email);
    if (!profile) {
      profile = {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.email,
        role: 'user',
        membership_tier: 'free',
        subscription_status: null,
        created_date: nowIso(),
        extra_data: {},
      };
      table('profiles').push(profile);
    }
    return profile;
  }

  const rpcHandlers = {
    // The atomic gecko save (GeckoForm, Quick Add, the first gecko flow).
    save_gecko_record: (args) => {
      const record = { ...(args.p_record || {}) };
      const rows = table('geckos');
      if (args.p_gecko_id) {
        const row = rows.find((g) => g.id === args.p_gecko_id);
        Object.assign(row, record, { updated_date: nowIso() });
        return row;
      }
      const existing = rows.find((g) => g.save_request_id && g.save_request_id === args.p_request_id);
      if (existing) return existing;
      const row = {
        id: uuid(),
        created_by: currentUser?.email,
        created_date: nowIso(),
        updated_date: nowIso(),
        archived: false,
        image_urls: [],
        save_request_id: args.p_request_id || null,
        ...record,
      };
      rows.push(row);
      if (args.p_record_weight && record.weight_grams != null) {
        table('weight_records').push({
          id: uuid(),
          gecko_id: row.id,
          weight_grams: record.weight_grams,
          record_date: args.p_record_date,
          created_by: currentUser?.email,
          created_date: nowIso(),
        });
      }
      return row;
    },
    read_profiles: () => table('profiles').map(({ id, full_name, business_name, profile_image_url, email }) => ({ id, full_name, business_name, profile_image_url, email })),
    ...rpc,
  };

  async function handle(route) {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname;
    const params = url.searchParams;
    let body = null;
    try {
      body = request.postDataJSON();
    } catch {
      body = request.postData();
    }
    calls.push({ method, path, search: url.search, body });

    const json = (payload, status = 200, headers = {}) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*', ...headers },
        body: payload === undefined ? '' : JSON.stringify(payload),
      });

    if (method === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          'access-control-allow-origin': '*',
          'access-control-allow-headers': '*',
          'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,HEAD,OPTIONS',
        },
      });
    }

    // ---- Auth ----
    if (path === '/auth/v1/signup') {
      const email = String(body?.email || '').toLowerCase();
      const user = {
        id: uuid(),
        aud: 'authenticated',
        role: 'authenticated',
        email,
        email_confirmed_at: null,
        app_metadata: { provider: 'email', providers: ['email'] },
        user_metadata: body?.data || {},
        identities: [{ id: uuid(), provider: 'email' }],
        created_at: nowIso(),
      };
      accounts.set(email, { user, password: body?.password });
      // Email confirmation is on, as in production: no session yet.
      return json(user);
    }
    if (path === '/auth/v1/token') {
      const grant = params.get('grant_type');
      if (grant === 'password') {
        const email = String(body?.email || '').toLowerCase();
        const account = accounts.get(email);
        if (!account || account.password !== body?.password) {
          return json({ error: 'invalid_grant', error_description: 'Invalid login credentials', code: 'invalid_credentials' }, 400);
        }
        // Treat the account as confirmed once it signs in (the test stands
        // in for the click on the confirmation email).
        account.user.email_confirmed_at ||= nowIso();
        currentUser = account.user;
        profileFor(currentUser);
        return json(sessionFor(currentUser));
      }
      if (grant === 'refresh_token' && currentUser) return json(sessionFor(currentUser));
      return json({ error: 'invalid_grant', error_description: 'Invalid refresh token' }, 400);
    }
    if (path === '/auth/v1/user') {
      if (!currentUser) return json({ msg: 'not signed in', code: 401 }, 401);
      if (method === 'PUT') Object.assign(currentUser.user_metadata, body?.data || {});
      return json(currentUser);
    }
    if (path === '/auth/v1/logout') {
      currentUser = null;
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
    }
    if (path.startsWith('/auth/v1/')) return json({});

    // ---- Edge functions ----
    if (path.startsWith('/functions/v1/')) {
      const name = path.slice('/functions/v1/'.length);
      if (name === 'send-collection-invite') return json({ delivered: 1 });
      return json({ ok: true });
    }

    // ---- Storage ----
    if (path.startsWith('/storage/v1/')) {
      if (method === 'GET') return route.fulfill({ status: 404, headers: { 'access-control-allow-origin': '*' }, body: '' });
      return json({ Key: path, Id: uuid() });
    }

    // ---- RPC ----
    if (path.startsWith('/rest/v1/rpc/')) {
      const name = path.slice('/rest/v1/rpc/'.length);
      const handler = rpcHandlers[name];
      const args = method === 'GET' ? Object.fromEntries(params) : body || {};
      const result = handler ? await handler(args, { table, currentUser }) : null;
      // A set-returning RPC can be filtered and shaped like a table.
      if (Array.isArray(result)) return json(applyOrderAndLimit(applyFilters(result, params), params));
      return json(result);
    }

    // ---- Tables ----
    if (path.startsWith('/rest/v1/')) {
      const name = path.slice('/rest/v1/'.length);
      const rows = table(name);
      const wantsObject = (request.headers()['accept'] || '').includes('application/vnd.pgrst.object+json');
      const prefer = request.headers()['prefer'] || '';
      const returnRows = prefer.includes('return=representation');

      if (method === 'GET' || method === 'HEAD') {
        const matched = applyFilters(rows, params);
        const page = applyOrderAndLimit(matched, params);
        const range = { 'content-range': `0-${Math.max(page.length - 1, 0)}/${matched.length}` };
        if (method === 'HEAD') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', ...range } });
        if (wantsObject) {
          if (page.length !== 1) {
            return json({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${page.length} rows` }, 406);
          }
          return json(page[0], 200, range);
        }
        return json(page, 200, range);
      }

      if (method === 'POST') {
        const input = Array.isArray(body) ? body : [body];
        const upsert = prefer.includes('resolution=merge-duplicates');
        const conflict = (params.get('on_conflict') || 'id').split(',');
        const written = input.map((values) => {
          if (upsert) {
            const existing = rows.find((r) => conflict.every((c) => values[c] !== undefined && r[c] === values[c]));
            if (existing) return Object.assign(existing, values);
          }
          const row = { id: uuid(), created_date: nowIso(), created_by: currentUser?.email, ...values };
          rows.push(row);
          return row;
        });
        if (!returnRows) return route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' }, body: '' });
        return json(wantsObject ? written[0] : written, 201);
      }

      if (method === 'PATCH') {
        const matched = applyFilters(rows, params);
        for (const row of matched) Object.assign(row, body || {});
        if (!returnRows) return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
        return json(wantsObject ? matched[0] ?? null : matched);
      }

      if (method === 'DELETE') {
        const matched = applyFilters(rows, params);
        tables.set(name, rows.filter((r) => !matched.includes(r)));
        if (!returnRows) return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
        return json(matched);
      }
    }

    return json({});
  }

  // Realtime: accept the socket and answer joins and heartbeats, so
  // channels report SUBSCRIBED instead of timing out.
  function handleSocket(ws) {
    ws.onMessage((message) => {
      let msg;
      try {
        msg = JSON.parse(String(message));
      } catch {
        return;
      }
      if (msg.event === 'phx_join') {
        const changes = msg.payload?.config?.postgres_changes || [];
        ws.send(JSON.stringify({
          topic: msg.topic,
          event: 'phx_reply',
          ref: msg.ref,
          join_ref: msg.join_ref,
          payload: { status: 'ok', response: { postgres_changes: changes.map((c, i) => ({ ...c, id: i + 1 })) } },
        }));
      } else if (msg.event === 'heartbeat' || msg.event === 'access_token' || msg.event === 'phx_leave') {
        ws.send(JSON.stringify({ topic: msg.topic, event: 'phx_reply', ref: msg.ref, payload: { status: 'ok', response: {} } }));
      }
    });
  }

  return {
    calls,
    table,
    get currentUser() {
      return currentUser;
    },
    /** Install on a Playwright BrowserContext. */
    async install(context) {
      await context.route(`${FAKE_SUPABASE_URL}/**`, handle);
      await context.routeWebSocket(/e2e\.supabase\.test\/realtime/, handleSocket);
    },
  };
}

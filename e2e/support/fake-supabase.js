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
// The 6-digit code the fake "emails" to every new account.
export const SIGNUP_CODE = '246810';

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

// Owner emails (decision E16, docs/planning/owner-emails-2026-11.md). These
// seven tables carry the owner's email in created_by. Signed-out visitors
// cannot read it, and step 2 takes it from signed-in members too, so the
// fake refuses every read that names it (select=* included, and filters or
// orders on it) the way Postgres does, and returns only the columns asked
// for. The database keeps owner_profile_id in step with created_by; so
// does the fake (syncOwners below).
const OWNED_TABLES = new Set([
  'geckos', 'breeding_plans', 'weight_records', 'feeding_records',
  'shed_records', 'vet_records', 'ownership_records',
]);

/** The plain column list a request asks for, or null for * or embedded resources. */
function plainColumns(params) {
  const select = params.get('select');
  if (select == null || select.includes('(')) return null;
  const cols = select.split(',').map((c) => c.trim()).filter(Boolean);
  return cols.includes('*') ? null : cols;
}

/** The Postgres refusal for a read that names created_by on an owned table, or null. */
function ownedReadRefusal(name, params, { checkSelect = true } = {}) {
  if (!OWNED_TABLES.has(name)) return null;
  const refuse = { code: '42501', message: `permission denied for table ${name}`, details: null, hint: null };
  if (checkSelect) {
    const select = params.get('select');
    const cols = (select ?? '*').split(',').map((c) => c.trim());
    if (cols.includes('*') || cols.includes('created_by') || cols.some((c) => /^created_by[:!]/.test(c))) return refuse;
  }
  for (const [key, value] of params) {
    if (key === 'created_by') return refuse;
    if ((key === 'or' || key === 'and') && /(^|[(,])(not\.)?created_by\./.test(value)) return refuse;
    if (key === 'order' && /(^|,)created_by(\.|,|$)/.test(value)) return refuse;
  }
  return null;
}

/** Rows cut down to the columns asked for (owned tables only). */
function project(name, rows, params) {
  const cols = OWNED_TABLES.has(name) ? plainColumns(params) : null;
  if (!cols) return rows;
  return rows.map((row) => Object.fromEntries(cols.map((c) => [c, row[c] ?? null])));
}

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
 * handlers (name -> (args, db) => result), and `functions` answers edge
 * functions by name (name -> (body, db) => JSON payload).
 */
export function createFakeSupabase({ seed = {}, rpc = {}, functions = {}, confirmOnPasswordSignIn = true } = {}) {
  const tables = new Map(Object.entries(seed).map(([name, rows]) => [name, rows.map((r) => ({ ...r }))]));
  const table = (name) => {
    if (!tables.has(name)) tables.set(name, []);
    return tables.get(name);
  };
  const accounts = new Map(); // email -> { user, password }
  const calls = [];
  // Reads refused for naming created_by on an owned table (see OWNED_TABLES).
  const refusals = [];
  let currentUser = null;

  const nowIso = () => new Date().toISOString();

  function addAccount({ email, password = 'correct-horse-battery', name = 'Fixture Keeper', confirmed = true, id = uuid() }) {
    const user = {
      id, email: email.toLowerCase(), aud: 'authenticated', role: 'authenticated',
      email_confirmed_at: confirmed ? nowIso() : null,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: { full_name: name },
      identities: [{ id: uuid(), provider: 'email' }], created_at: nowIso(),
    };
    accounts.set(user.email, { user, password });
    if (confirmed) profileFor(user);
    return user;
  }

  function userForRequest(request) {
    const token = request.headers().authorization?.replace(/^Bearer /i, '');
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
      return [...accounts.values()].find(({ user }) => user.id === payload.sub)?.user || null;
    } catch {
      return null;
    }
  }

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

  // public.set_owner_profile_id(): owner_profile_id is the profile of the
  // row's created_by. Run before every request on an owned table, so seeds
  // and accounts added after them line up too.
  function syncOwners(name) {
    if (!OWNED_TABLES.has(name)) return;
    const idByEmail = new Map(table('profiles').map((p) => [p.email, String(p.id)]));
    for (const row of table(name)) {
      if (row.created_by && idByEmail.has(row.created_by)) row.owner_profile_id = idByEmail.get(row.created_by);
    }
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

  // Sale prices are kept apart from rows other members can read
  // (supabase/migrations/20261113172624_private_sale_prices.sql). The
  // database's triggers move a price written to geckos.sold_price or
  // ownership_records.sale_price into its own table and leave the column
  // null; a gecko's price goes when it is unarchived or changes owner. The
  // fake does the same, so a test sees what production stores.
  function keepSalePricesPrivate(name, row, before) {
    const upsert = (tableName, key, id, price) => {
      const list = table(tableName);
      const existing = list.find((p) => p[key] === id);
      if (existing) Object.assign(existing, { [key === 'gecko_id' ? 'sold_price' : 'sale_price']: Number(price), updated_date: nowIso() });
      else list.push({ [key]: id, [key === 'gecko_id' ? 'sold_price' : 'sale_price']: Number(price), created_date: nowIso(), updated_date: nowIso() });
    };
    if (name === 'geckos') {
      if (before) {
        const unarchived = Boolean(before.archived) && !row.archived;
        const newOwner = String(before.created_by || '').toLowerCase() !== String(row.created_by || '').toLowerCase();
        if (unarchived || newOwner) tables.set('gecko_sale_prices', table('gecko_sale_prices').filter((p) => p.gecko_id !== row.id));
      }
      if (row.sold_price != null) {
        upsert('gecko_sale_prices', 'gecko_id', row.id, row.sold_price);
        row.sold_price = null;
      }
    } else if (name === 'ownership_records' && row.sale_price != null) {
      upsert('ownership_record_prices', 'record_id', row.id, row.sale_price);
      row.sale_price = null;
    }
  }

  const rpcHandlers = {
    // The atomic gecko save (GeckoForm, Quick Add, the first gecko flow).
    save_gecko_record: (args, { currentUser }) => {
      const record = { ...(args.p_record || {}) };
      const rows = table('geckos');
      if (args.p_gecko_id) {
        const row = rows.find((g) => g.id === args.p_gecko_id);
        Object.assign(row, record, { updated_date: nowIso() });
        syncOwners('geckos');
        return { ...row, created_by: null };
      }
      const existing = rows.find((g) => g.save_request_id && g.save_request_id === args.p_request_id);
      // Members cannot read created_by (decision E16): the saved row comes
      // back without it, as gecko_row_as_member returns it after step 2.
      if (existing) return { ...existing, created_by: null };
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
      syncOwners('geckos');
      syncOwners('weight_records');
      return { ...row, created_by: null };
    },
    read_profiles: () => table('profiles').map(({ id, full_name, business_name, profile_image_url, email }) => ({ id, full_name, business_name, profile_image_url, email })),
    // The profile ids of the members the caller blocked, public profile or not.
    my_blocked_profile_ids: (args, { currentUser }) => {
      const blocked = new Set(table('user_blocks').filter((b) => currentUser && b.blocker_email === currentUser.email).map((b) => b.blocked_email));
      return table('profiles').filter((p) => blocked.has(p.email)).map((p) => ({ id: String(p.id) }));
    },
    // Members never read another member's email column; these answer the
    // way supabase/migrations/20261028040000_member_email_reads.sql does.
    forum_like_state: (args, { currentUser }) => {
      const ids = (args.p_target_ids || []).map(String);
      const likes = table('forum_likes').filter((l) => ids.includes(String(l.target_id)));
      return [...new Set(likes.map((l) => String(l.target_id)))].map((id) => {
        const rows = likes.filter((l) => String(l.target_id) === id);
        const liked = Boolean(currentUser) && rows.some((l) => l.created_by === currentUser.email || l.user_email === currentUser.email);
        return { target_id: id, like_count: rows.length, liked };
      });
    },
    community_reaction_state: (args, { currentUser }) => {
      const types = (args.p_event_types || []).map(String);
      const ids = (args.p_event_ids || []).map(String);
      const groups = new Map();
      for (const r of table('community_event_reactions')) {
        if (!types.includes(String(r.event_type)) || !ids.includes(String(r.event_id))) continue;
        const key = `${r.event_type}|${r.event_id}|${r.reaction}`;
        const g = groups.get(key) || { event_type: r.event_type, event_id: r.event_id, reaction: r.reaction, reaction_count: 0, mine: false };
        g.reaction_count += 1;
        g.mine = g.mine || (Boolean(currentUser) && r.user_email === currentUser.email);
        groups.set(key, g);
      }
      return [...groups.values()];
    },
    my_row_ids: (args, { currentUser }) => {
      const column = { user_badges: 'user_email', morph_guide_comments: 'user_email' }[args.p_table] || 'created_by';
      return table(args.p_table).filter((r) => currentUser && r[column] === currentUser.email).map((r) => String(r.id));
    },
    notify_forum_thread_author: () => false,
    ...rpc,
  };

  async function handle(route) {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const path = url.pathname;
    const params = url.searchParams;
    // Authenticate each request, not the last browser that signed in. This
    // permits independent sender/recipient contexts and cross-device links.
    const requestUser = userForRequest(request);
    let body = null;
    try {
      body = request.postDataJSON();
    } catch {
      body = request.postData();
    }
    calls.push({ method, path, search: url.search, body, userId: requestUser?.id || null });

    const json = (payload, status = 200, headers = {}) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', ...headers },
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
      const user = addAccount({ email, password: body?.password, name: body?.data?.full_name, confirmed: false });
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
        if (!confirmOnPasswordSignIn && !account.user.email_confirmed_at) {
          return json({ error: 'email_not_confirmed', error_description: 'Email not confirmed', code: 'email_not_confirmed' }, 400);
        }
        account.user.email_confirmed_at ||= nowIso();
        currentUser = account.user;
        profileFor(currentUser);
        return json(sessionFor(currentUser));
      }
      const refreshed = [...accounts.values()].find(({ user }) => body?.refresh_token === `refresh-${user.id}`)?.user;
      if (grant === 'refresh_token' && refreshed) return json(sessionFor(refreshed));
      return json({ error: 'invalid_grant', error_description: 'Invalid refresh token' }, 400);
    }
    if (path === '/auth/v1/verify') {
      // Two ways to confirm, as in production: the token link in the email
      // (token_hash), or the 6-digit code from the same email typed into
      // the "Check your email" screen (email + token).
      const byCode = body?.email && body?.token
        ? accounts.get(String(body.email).toLowerCase())
        : null;
      const account = byCode
        ? (String(body.token) === SIGNUP_CODE ? byCode : null)
        : [...accounts.values()].find(({ user }) => body?.token_hash === `confirmation-${user.id}`);
      if (!account) return json({ code: 'otp_expired', msg: 'Email link is invalid or has expired' }, 403);
      account.user.email_confirmed_at ||= nowIso();
      currentUser = account.user;
      profileFor(currentUser);
      return json(sessionFor(currentUser));
    }
    if (path === '/auth/v1/user') {
      if (!requestUser) return json({ msg: 'not signed in', code: 401 }, 401);
      if (method === 'PUT') Object.assign(requestUser.user_metadata, body?.data || {});
      return json(requestUser);
    }
    if (path === '/auth/v1/logout') {
      currentUser = null;
      return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
    }
    if (path.startsWith('/auth/v1/')) return json({});

    // ---- Edge functions ----
    if (path.startsWith('/functions/v1/')) {
      const name = path.slice('/functions/v1/'.length);
      if (functions[name]) return json(await functions[name](body, { table, currentUser: requestUser }));
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
      let result;
      try {
        result = handler ? await handler(args, { table, currentUser: requestUser }) : null;
      } catch (error) {
        return json({ code: error.code || 'P0001', message: error.message, hint: error.hint }, error.status || 400);
      }
      // A set-returning RPC can be filtered and shaped like a table.
      if (Array.isArray(result)) return json(applyOrderAndLimit(applyFilters(result, params), params));
      return json(result);
    }

    // ---- Tables ----
    if (path.startsWith('/rest/v1/')) {
      const name = path.slice('/rest/v1/'.length);
      syncOwners(name);
      const rows = table(name);
      const wantsObject = (request.headers()['accept'] || '').includes('application/vnd.pgrst.object+json');
      const prefer = request.headers()['prefer'] || '';
      const returnRows = prefer.includes('return=representation');

      if (method === 'GET' || method === 'HEAD') {
        const refusal = ownedReadRefusal(name, params);
        if (refusal) { refusals.push({ method, path, search: url.search }); return json(refusal, 403); }
        const matched = applyFilters(rows, params);
        const page = project(name, applyOrderAndLimit(matched, params), params);
        const range = { 'content-range': `0-${Math.max(page.length - 1, 0)}/${matched.length}` };
        if (method === 'HEAD') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', ...range } });
        if (wantsObject) {
          if (page.length !== 1) {
            return json({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${page.length} rows` }, 406);
          }
          return json(page[0], 200, range);
        }
        return json(page, 200, range);
      }

      if (method === 'POST') {
        if (returnRows) {
          const refusal = ownedReadRefusal(name, params);
          if (refusal) { refusals.push({ method, path, search: url.search }); return json(refusal, 403); }
        }
        const input = Array.isArray(body) ? body : [body];
        const upsert = prefer.includes('resolution=merge-duplicates');
        const conflict = (params.get('on_conflict') || 'id').split(',');
        const written = input.map((values) => {
          if (upsert) {
            const existing = rows.find((r) => conflict.every((c) => values[c] !== undefined && r[c] === values[c]));
            if (existing) {
              const before = { ...existing };
              Object.assign(existing, values);
              keepSalePricesPrivate(name, existing, before);
              return existing;
            }
          }
          const row = { id: uuid(), created_date: nowIso(), created_by: requestUser?.email, ...values };
          rows.push(row);
          keepSalePricesPrivate(name, row, null);
          return row;
        });
        syncOwners(name);
        if (!returnRows) return route.fulfill({ status: 201, headers: { 'access-control-allow-origin': '*' }, body: '' });
        const shown = project(name, written, params);
        return json(wantsObject ? shown[0] : shown, 201);
      }

      if (method === 'PATCH') {
        const refusal = ownedReadRefusal(name, params, { checkSelect: returnRows });
        if (refusal) { refusals.push({ method, path, search: url.search }); return json(refusal, 403); }
        const matched = applyFilters(rows, params);
        for (const row of matched) {
          const before = { ...row };
          Object.assign(row, body || {});
          keepSalePricesPrivate(name, row, before);
        }
        syncOwners(name);
        if (!returnRows) return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
        const shown = project(name, matched, params);
        return json(wantsObject ? shown[0] ?? null : shown);
      }

      if (method === 'DELETE') {
        const refusal = ownedReadRefusal(name, params, { checkSelect: returnRows });
        if (refusal) { refusals.push({ method, path, search: url.search }); return json(refusal, 403); }
        const matched = applyFilters(rows, params);
        tables.set(name, rows.filter((r) => !matched.includes(r)));
        if (!returnRows) return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
        return json(project(name, matched, params));
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
    refusals,
    table,
    addAccount,
    account: (email) => accounts.get(email.toLowerCase())?.user,
    sessionFor,
    confirmAccount(email) {
      const user = accounts.get(email.toLowerCase())?.user;
      if (!user) throw new Error('Fixture account does not exist');
      user.email_confirmed_at ||= nowIso();
      profileFor(user);
      return sessionFor(user);
    },
    async signIn(context, user) {
      const session = sessionFor(user);
      await context.addInitScript(({ key, session }) => {
        localStorage.setItem(key, JSON.stringify(session));
      }, { key: FAKE_STORAGE_KEY, session });
    },
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

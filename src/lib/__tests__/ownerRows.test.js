// Owner email addresses kept from other members (decision E16,
// docs/planning/owner-emails-2026-11.md). Step 1 is the app reading the
// seven tables whose owner is an email with named columns and finding
// "mine" by owner_profile_id; step 2 takes created_by away. These tests
// keep the lists in step and fail when a page goes back to reading the
// column directly.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const fx = vi.hoisted(() => ({
  calls: [],
  session: { user: { id: 'auth-me', email: 'me@example.com' } },
  profileId: 'p-me',
  profiles: [{ id: 'p-other', email: 'other@example.com' }],
  rows: {},
  guest: false,
}));

vi.mock('@/lib/guestMode', () => ({
  isGuestMode: () => fx.guest,
  blockIfGuest: () => {},
}));

vi.mock('@/lib/supabaseLazy', () => {
  const chain = (table, resolveData) => {
    const filters = [];
    const q = {
      then: (resolve, reject) => Promise.resolve(resolveData(filters)).then(resolve, reject),
    };
    for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'is', 'not', 'or', 'order', 'limit', 'range', 'gt', 'gte', 'lt', 'lte']) {
      q[m] = (...args) => { fx.calls.push([table, m, ...args]); filters.push([m, ...args]); return q; };
    }
    q.maybeSingle = () => Promise.resolve(resolveData(filters)).then((r) => ({ ...r, data: Array.isArray(r.data) ? r.data[0] ?? null : r.data }));
    q.single = q.maybeSingle;
    return q;
  };
  const client = {
    from: (table) => chain(table, (filters) => {
      if (table === 'profiles') {
        const email = filters.find(([m, col]) => m === 'eq' && col === 'email')?.[2];
        return { data: fx.profileId && email === fx.session?.user?.email ? [{ id: fx.profileId }] : [], error: null };
      }
      return { data: (fx.rows[table] || []).map((r) => ({ ...r })), error: null };
    }),
    rpc: (name, args) => chain(`rpc:${name}`, () => {
      if (name === 'read_profiles') {
        const wanted = (args?.p_emails || []).map((e) => e.toLowerCase());
        const all = [...fx.profiles, ...(fx.profileId ? [{ id: fx.profileId, email: 'me@example.com' }] : [])];
        return { data: all.filter((p) => wanted.includes(p.email)), error: null };
      }
      return { data: null, error: null };
    }),
    auth: {
      getSession: async () => ({ data: { session: fx.session } }),
      getUser: async () => ({ data: { user: fx.session?.user || null } }),
      refreshSession: async () => ({ error: null }),
    },
  };
  return { getSupabase: async () => client };
});
vi.mock('@/lib/activation', () => ({ noteEntityCreated: () => {} }));

const ownerRows = await import('@/lib/ownerRows');
const entities = await import('@/api/supabaseEntities');
const { PUBLIC_READ_COLUMNS, geckoSelect } = await import('@/lib/publicColumns');
const { OWNED_COLUMNS_BY_TABLE, OWNED_HIDDEN_COLUMNS, GECKO_MEMBER_COLUMNS } = await import('@/lib/memberColumns');

const sorted = (list) => [...list].sort();

beforeEach(() => {
  fx.calls = [];
  fx.session = { user: { id: 'auth-me', email: 'me@example.com' } };
  fx.profileId = 'p-me';
  fx.rows = {};
  fx.guest = false;
  ownerRows.forgetOwner();
});

describe('the member column lists for the seven tables', () => {
  it('name the same seven tables everywhere', () => {
    const tables = Object.values(ownerRows.OWNED_TABLES).sort();
    expect(Object.keys(OWNED_COLUMNS_BY_TABLE).sort()).toEqual(tables);
    expect(Object.keys(OWNED_HIDDEN_COLUMNS).sort()).toEqual(tables);
    for (const [entity, table] of Object.entries(ownerRows.OWNED_TABLES)) {
      expect(entities.TABLE_MAP[entity]).toBe(table);
    }
  });

  it.each(Object.entries(ownerRows.OWNED_TABLES))('%s: every column but created_by, the owner id kept', (entity, table) => {
    ownerRows.registerOwnedColumns();
    const list = OWNED_COLUMNS_BY_TABLE[table];
    expect(list).not.toContain('created_by');
    expect(list).toContain('owner_profile_id');
    expect(new Set(list).size).toBe(list.length);
    // The entity layer builds the same list from the signed-out one.
    expect(sorted(entities.memberReadColumns(entity).split(','))).toEqual(sorted(list));
    expect(entities.memberReadColumns(entity)).toBe(PUBLIC_READ_COLUMNS[entity] + ownerRows.OWNED_MEMBER_EXTRAS[entity]);
  });

  it('give a signed-in geckos read in a page the same list (geckoSelect)', () => {
    expect(sorted(geckoSelect(true).split(','))).toEqual(sorted(GECKO_MEMBER_COLUMNS));
    expect(geckoSelect(false)).toBe(PUBLIC_READ_COLUMNS.Gecko);
  });
});

describe('ownerFilterFor', () => {
  it('turns the member\'s own email into their profile id, whatever its case', async () => {
    expect(await ownerRows.ownerFilterFor({ created_by: 'Me@Example.com', archived: false })).toEqual({ owner_profile_id: 'p-me', archived: false });
  });

  it('looks another member up by the address it was given', async () => {
    expect(await ownerRows.ownerFilterFor({ created_by: 'other@example.com' })).toEqual({ owner_profile_id: 'p-other' });
    expect(fx.calls.some(([t]) => t === 'rpc:read_profiles')).toBe(true);
  });

  it('matches nobody for an address with no profile, as created_by did', async () => {
    expect(await ownerRows.ownerFilterFor({ created_by: 'nobody@example.com' })).toEqual({ owner_profile_id: ownerRows.NO_OWNER });
    expect(await ownerRows.ownerFilterFor({ created_by: { $in: ['nobody@example.com'] } })).toEqual({ owner_profile_id: { $in: [ownerRows.NO_OWNER] } });
  });

  it('handles $in, $ne, null and $or clauses', async () => {
    expect(await ownerRows.ownerFilterFor({ created_by: { $in: ['me@example.com', 'other@example.com', 'nobody@example.com'] } }))
      .toEqual({ owner_profile_id: { $in: ['p-me', 'p-other'] } });
    expect(await ownerRows.ownerFilterFor({ created_by: { $ne: 'me@example.com' } })).toEqual({ owner_profile_id: { $ne: 'p-me' } });
    expect(await ownerRows.ownerFilterFor({ created_by: null })).toEqual({ owner_profile_id: null });
    expect(await ownerRows.ownerFilterFor({ $or: [{ created_by: 'me@example.com' }, { collection_id: 'c1' }] }))
      .toEqual({ $or: [{ owner_profile_id: 'p-me' }, { collection_id: 'c1' }] });
  });

  it('leaves a filter without created_by alone', async () => {
    const filter = { collection_id: 'c1' };
    expect(await ownerRows.ownerFilterFor(filter)).toBe(filter);
    expect(fx.calls).toEqual([]);
  });
});

describe('restoreOwnEmail', () => {
  it('puts the member\'s email on their own rows only', async () => {
    const rows = [
      { id: 'g1', owner_profile_id: 'p-me' },
      { id: 'g2', owner_profile_id: 'p-other' },
      { id: 'g3', owner_profile_id: null },
    ];
    await ownerRows.restoreOwnEmail(rows);
    expect(rows.map((r) => r.created_by)).toEqual(['me@example.com', undefined, undefined]);
  });

  it('takes a single row, keeps a row that already has its email, and never throws', async () => {
    const one = { id: 'g1', owner_profile_id: 'p-me' };
    expect(await ownerRows.restoreOwnEmail(one)).toBe(one);
    expect(one.created_by).toBe('me@example.com');
    const kept = { id: 'g2', owner_profile_id: 'p-me', created_by: 'me@example.com' };
    await ownerRows.restoreOwnEmail(kept);
    expect(kept.created_by).toBe('me@example.com');
    expect(await ownerRows.restoreOwnEmail(null)).toBeNull();
    fx.session = null;
    ownerRows.forgetOwner();
    const signedOut = { id: 'g1', owner_profile_id: 'p-me' };
    await ownerRows.restoreOwnEmail(signedOut);
    expect(signedOut.created_by).toBeUndefined();
  });

  it('does nothing when the member\'s profile cannot be read', async () => {
    fx.profileId = null;
    const row = { id: 'g1', owner_profile_id: 'p-me' };
    await ownerRows.restoreOwnEmail(row);
    expect(row.created_by).toBeUndefined();
  });
});

describe('the seven entities', () => {
  it('read named columns, filter by owner id and give the member back their own email', async () => {
    fx.rows.geckos = [
      { id: 'g1', name: 'Mango', owner_profile_id: 'p-me' },
      { id: 'g2', name: 'Pip', owner_profile_id: 'p-other' },
    ];
    const geckos = await entities.Gecko.filter({ created_by: 'me@example.com' });
    const select = fx.calls.find(([t, m]) => t === 'geckos' && m === 'select');
    expect(select[2]).toBe(entities.memberReadColumns('Gecko'));
    expect(select[2]).not.toMatch(/created_by|\*/);
    expect(fx.calls.some(([t, m, col, val]) => t === 'geckos' && m === 'eq' && col === 'owner_profile_id' && val === 'p-me')).toBe(true);
    expect(fx.calls.some(([t, , col]) => t === 'geckos' && col === 'created_by')).toBe(false);
    expect(geckos.find((g) => g.id === 'g1').created_by).toBe('me@example.com');
    expect(geckos.find((g) => g.id === 'g2').created_by).toBeUndefined();
  });

  it('read every one of the seven with named columns, saves included', async () => {
    for (const entity of Object.keys(ownerRows.OWNED_TABLES)) {
      fx.calls = [];
      await entities[entity].filter({});
      await entities[entity].create({ notes: 'Lilly White pairing' });
      await entities[entity].update('row-1', { notes: 'Harlequin' });
      const selects = fx.calls.filter(([, m]) => m === 'select').map(([, , cols]) => cols);
      expect(selects).toHaveLength(3);
      for (const cols of selects) expect(cols).toBe(entities.memberReadColumns(entity));
    }
  });

  it('serve the demo\'s sample rows untouched', async () => {
    fx.guest = true;
    await entities.WeightRecord.filter({ created_by: 'guest@example.com' });
    expect(fx.calls.some(([t]) => t === 'rpc:read_profiles' || t === 'profiles')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Step 2: the SQL, its test and the app's lists agree.
// ---------------------------------------------------------------------------

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');

describe('step 2 of the plan', () => {
  // It waits in supabase/pending until the app change has been live for a
  // few days, then moves to supabase/migrations with a timestamp.
  const pending = readdirSync(join(ROOT, 'supabase/pending')).filter((f) => f.endsWith('owner_emails_step2.sql'));
  const moved = readdirSync(join(ROOT, 'supabase/migrations')).filter((f) => f.endsWith('_owner_emails_step2.sql'));
  const where = moved.length ? `migrations/${moved[0]}` : `pending/${pending[0]}`;
  const STEP2 = readFileSync(join(ROOT, 'supabase', where), 'utf8');
  const STEP2_TEST = readFileSync(join(ROOT, 'supabase/tests/owner_emails_step2_regressions.sql'), 'utf8');

  it('is in exactly one place, and its test applies it from there', () => {
    expect(pending.length + moved.length).toBe(1);
    expect(STEP2_TEST).toContain(`\\ir ../${where}`);
  });

  it('takes away exactly created_by on the seven tables', () => {
    const hidden = Object.fromEntries([...STEP2.matchAll(/\('(\w+)',\s+array\[([^\]]*)\]\)/g)]
      .map(([, table, cols]) => [table, cols.split(',').map((c) => c.trim().replace(/'/g, ''))]));
    expect(hidden).toEqual(OWNED_HIDDEN_COLUMNS);
  });

  it('is tested against the lists the app reads with', () => {
    const block = STEP2_TEST.slice(STEP2_TEST.indexOf('insert into _member_lists values'));
    const inSql = Object.fromEntries([...block.slice(0, block.indexOf(';')).matchAll(/\('(\w+)', '([^']*)'\)/g)]
      .map(([, table, cols]) => [table, cols.split(',').map((c) => c.trim())]));
    expect(inSql).toEqual(OWNED_COLUMNS_BY_TABLE);
  });
});

// ---------------------------------------------------------------------------
// No page reads created_by on the seven tables some other way.
// ---------------------------------------------------------------------------

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return /\.(jsx?|tsx?)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

const TABLES = Object.values(ownerRows.OWNED_TABLES).join('|');
const TABLE_FROM = new RegExp(`\\.from\\(\\s*['"\`](${TABLES})['"\`]\\s*\\)`, 'g');
// headCount('geckos', ...) and similar helpers that take the table name.
const TABLE_ARG = new RegExp(`\\b\\w*[Cc]ount\\w*\\(\\s*['"\`](${TABLES})['"\`]\\s*,`, 'g');
const BAD_IN_CHAIN = [
  /\.select\(\s*\)/,
  /\.select\(\s*['"`]\*['"`]/,
  /\.select\([^)]*['"`][^'"`]*\bcreated_by\b/,
  /\.(eq|neq|in|is|not|ilike|like|filter|order)\(\s*['"`]created_by['"`]/,
  /\.match\(\s*\{[^}]*\bcreated_by\s*:/,
  /\.or\(\s*['"`][^'"`]*\bcreated_by\./,
];

function ownerEmailReads() {
  const found = [];
  for (const path of sourceFiles(join(ROOT, 'src'))) {
    const file = relative(ROOT, path);
    const text = readFileSync(path, 'utf8');
    for (const re of [TABLE_FROM, TABLE_ARG]) {
      for (const m of text.matchAll(re)) {
        const rest = text.slice(m.index + m[0].length);
        const ends = [rest.indexOf(';'), rest.indexOf('.from(')].filter((i) => i >= 0);
        const chain = m[0] + rest.slice(0, ends.length ? Math.min(...ends) : 400);
        if (BAD_IN_CHAIN.some((b) => b.test(chain))) found.push([file, chain.replace(/\s+/g, ' ').slice(0, 160)]);
      }
    }
  }
  return found;
}

describe('no page reads created_by on the seven tables', () => {
  it('finds no select *, created_by column or created_by filter in a direct read', () => {
    expect(ownerEmailReads()).toEqual([]);
  });

  it('still recognises the reads it is guarding against', () => {
    const sample = "const a = supabase.from('geckos').select('*').eq('is_public', true);\n"
      + "const b = supabase.from('breeding_plans').select('id').eq('created_by', me.email);\n"
      + "const c = headCount('weight_records', (q) => q.eq('created_by', email));\n";
    const chains = [...sample.matchAll(TABLE_FROM), ...sample.matchAll(TABLE_ARG)]
      .map((m) => sample.slice(m.index, sample.indexOf(';', m.index)));
    expect(chains).toHaveLength(3);
    for (const chain of chains) expect(BAD_IN_CHAIN.some((b) => b.test(chain))).toBe(true);
  });
});

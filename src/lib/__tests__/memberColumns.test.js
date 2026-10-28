// Members' email addresses off the rows other members read (Part E item
// E1 4). Step 1 is the app reading these tables with named columns and
// finding "mine" without the email column; step 2
// (supabase/pending/member_email_columns_revoke.sql) takes the columns away.
// These tests keep the app's lists, the pending SQL and its regression file
// in step, and fail when a page goes back to `select *` or to filtering on
// another member's email.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const fx = vi.hoisted(() => ({ calls: [], session: { user: { id: 'u1' } } }));

vi.mock('@/lib/supabaseLazy', () => {
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'is', 'not', 'or', 'order', 'limit', 'range', 'gt', 'gte', 'lt', 'lte'];
  const query = (table) => {
    const q = { then: (resolve) => resolve({ data: [], error: null }) };
    for (const m of methods) q[m] = (...args) => { fx.calls.push([table, m, ...args]); return q; };
    q.single = () => Promise.resolve({ data: { id: 'row-1' }, error: null });
    q.maybeSingle = q.single;
    return q;
  };
  const client = {
    from: (table) => query(table),
    auth: {
      getSession: async () => ({ data: { session: fx.session } }),
      getUser: async () => ({ data: { user: { id: 'u1', email: 'sam@example.com' } } }),
      refreshSession: async () => ({ error: null }),
    },
  };
  return { getSupabase: async () => client };
});
vi.mock('@/lib/activation', () => ({ noteEntityCreated: () => {} }));

const {
  MEMBER_COLUMNS_BY_TABLE,
  MEMBER_HIDDEN_COLUMNS,
  GECKO_IMAGE_MEMBER_COLUMNS,
  FORUM_POST_MEMBER_COLUMNS,
  FORUM_COMMENT_MEMBER_COLUMNS,
} = await import('@/lib/memberColumns');
const { BREEDER_PROFILE_PUBLIC_COLUMNS, PUBLIC_READ_COLUMNS } = await import('@/lib/publicColumns');
const entities = await import('@/api/supabaseEntities');

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const PENDING = read('supabase/pending/member_email_columns_revoke.sql');
const PENDING_TEST = read('supabase/pending/member_email_columns_revoke_regressions.sql');
// Found by its name, not its date: the date changes when the file is re-dated at merge.
const STEP1 = read(`supabase/migrations/${readdirSync(resolve(ROOT, 'supabase/migrations')).find((f) => f.endsWith('_member_email_reads.sql'))}`);

/** The ('table', array['col', ...]) rows of a SQL values list. */
function hiddenLists(sql) {
  return Object.fromEntries([...sql.matchAll(/\('(\w+)',\s+array\[([^\]]*)\]\)/g)]
    .map(([, table, cols]) => [table, cols.split(',').map((c) => c.trim().replace(/'/g, ''))]));
}

const LISTS_BY_TABLE = MEMBER_COLUMNS_BY_TABLE;
const member = (entity) => entities.memberReadColumns(entity);

const EMAIL_COLUMNS = ['created_by', 'user_email', 'owner_email', 'uploader_email', 'winner_emails'];

describe('the member column lists', () => {
  it.each(Object.entries(LISTS_BY_TABLE))('%s: no email column, nothing step 2 takes away', (table, list) => {
    for (const col of [...EMAIL_COLUMNS, ...MEMBER_HIDDEN_COLUMNS[table]]) expect(list).not.toContain(col);
    expect(new Set(list).size).toBe(list.length);
  });

  it('cover every table step 2 narrows, and only those', () => {
    expect(Object.keys(LISTS_BY_TABLE).sort()).toEqual(Object.keys(MEMBER_HIDDEN_COLUMNS).sort());
  });

  it('keep the columns pages use to say who owns a row', () => {
    for (const list of [GECKO_IMAGE_MEMBER_COLUMNS, FORUM_POST_MEMBER_COLUMNS, FORUM_COMMENT_MEMBER_COLUMNS]) {
      expect(list).toContain('owner_profile_id');
    }
    expect(BREEDER_PROFILE_PUBLIC_COLUMNS).toContain('user_id');
  });

  it('match the lists the step 2 regression file proves members can still read', () => {
    const block = PENDING_TEST.slice(PENDING_TEST.indexOf('insert into _member_lists values'));
    const inSql = Object.fromEntries([...block.slice(0, block.indexOf(';')).matchAll(/\('(\w+)', '([^']*)'\)/g)]
      .map(([, table, cols]) => [table, cols.split(',').map((c) => c.trim())]));
    expect(inSql).toEqual(LISTS_BY_TABLE);
  });

  it('hide exactly what the pending revoke and its test take away', () => {
    expect(hiddenLists(PENDING)).toEqual(MEMBER_HIDDEN_COLUMNS);
    expect(hiddenLists(PENDING_TEST.slice(PENDING_TEST.indexOf('insert into _hidden values')))).toEqual(MEMBER_HIDDEN_COLUMNS);
  });

  it('are what the entity layer reads with (it builds them from the signed-out lists)', () => {
    for (const entity of Object.keys(entities.MEMBER_COLUMN_EXTRAS)) {
      expect(member(entity).split(',').sort()).toEqual([...LISTS_BY_TABLE[entities.TABLE_MAP[entity]]].sort());
    }
    // Every member-read entity is one of these tables.
    for (const entity of Object.keys(entities.MEMBER_COLUMN_EXTRAS)) {
      expect(Object.keys(MEMBER_HIDDEN_COLUMNS)).toContain(entities.TABLE_MAP[entity]);
    }
  });

  it('cover every entity on these tables the app reads through the entity layer', () => {
    // UserBadge, MorphGuideComment and Giveaway have no entity reads: My
    // Profile reads badges with its own list, and nothing reads the other two.
    const covered = Object.keys(entities.MEMBER_COLUMN_EXTRAS);
    expect(covered.sort()).toEqual(['BreederProfile', 'BreederReview', 'ForumComment', 'ForumLike', 'ForumPost', 'GeckoImage', 'MorphPriceEntry']);
    for (const path of sourceFiles(join(ROOT, 'src'))) {
      const text = readFileSync(path, 'utf8');
      for (const entity of ['UserBadge', 'MorphGuideComment', 'Giveaway']) {
        const reads = [...text.matchAll(new RegExp(`\\b${entity}\\.(filter|list|get)\\(\\s*([^)]*)`, 'g'))]
          .filter((m) => !(entity === 'UserBadge' && /user_email/.test(m[2])));
        expect(reads.map((m) => `${relative(ROOT, path)}: ${m[0]}`)).toEqual([]);
      }
    }
  });
});

describe('the step 2 file waits in supabase/pending', () => {
  it('is not a migration yet, and says when it may become one', () => {
    expect(readdirSync(join(ROOT, 'supabase/migrations')).some((f) => f.includes('member_email_columns_revoke'))).toBe(false);
    expect(PENDING).toMatch(/live for 3 days/);
    expect(read('supabase/pending/README.md')).toMatch(/member_email_columns_revoke\.sql[\s\S]*live for 3 days/);
  });

  it('leaves geckos.created_by alone (it waits for the identity migration)', () => {
    expect(Object.keys(hiddenLists(PENDING))).not.toContain('geckos');
  });

  it('step 1 grants each new function only to the roles that call it', () => {
    expect(STEP1).toContain('revoke all on function public.my_row_ids(text) from public, anon;');
    expect(STEP1).toContain('revoke all on function public.notify_forum_thread_author(text) from public, anon;');
    expect(STEP1).toContain('grant execute on function public.forum_like_state(text[]) to anon, authenticated, service_role;');
  });
});

describe('entity reads and writes on these tables', () => {
  beforeEach(() => {
    fx.calls = [];
    fx.session = { user: { id: 'u1' } };
  });

  it('read members\' rows with the member list, everything else with every column', async () => {
    expect(await entities.readColumns('GeckoImage')).toBe(member('GeckoImage'));
    expect(await entities.readColumns('ForumComment')).toBe(member('ForumComment'));
    expect(await entities.readColumns('BreederProfile')).toBe(BREEDER_PROFILE_PUBLIC_COLUMNS.join(','));
    expect(await entities.readColumns('Gecko')).toBe('*');
    fx.session = null;
    expect(await entities.readColumns('GeckoImage')).toBe(PUBLIC_READ_COLUMNS.GeckoImage);
  });

  it('read a saved row back with the member list, never select *', async () => {
    await entities.GeckoImage.create({ image_url: 'https://example.com/lilly-white.jpg' });
    await entities.ForumPost.update('post-1', { title: 'Harlequin or Pinstripe?' });
    await entities.ForumComment.delete('comment-1');
    await entities.Gecko.create({ name: 'Mango' });
    const selects = fx.calls.filter(([, m]) => m === 'select').map(([table, , cols]) => [table, cols]);
    expect(selects).toEqual([
      ['gecko_images', member('GeckoImage')],
      ['forum_posts', member('ForumPost')],
      ['forum_comments', member('ForumComment')],
      ['geckos', '*'],
    ]);
    for (const [, cols] of selects.slice(0, 3)) expect(cols).not.toMatch(/created_by|\*/);
    // The member's own email still goes on their new row.
    const insert = fx.calls.find(([table, m]) => table === 'gecko_images' && m === 'insert');
    expect(insert[2].created_by).toBe('sam@example.com');
  });
});

// ---------------------------------------------------------------------------
// No page goes back to reading another member's email on these tables.
// ---------------------------------------------------------------------------

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return /\.(jsx?|tsx?)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

// Each one a fallback that runs only until
// supabase/migrations/20261028040000_member_email_reads.sql is applied
// (the database helper is missing), so never after step 2.
const ALLOWED = [
  ['src/lib/memberReads.js', ".from('forum_likes')"],
  ['src/lib/memberReads.js', ".from('community_event_reactions')"],
  ['src/pages/MyProfile.jsx', 'UserBadge.filter({ user_email'],
  ['src/lib/trustScore.js', 'BreederProfile.filter({ created_by'],
];

const EMAIL = '(created_by|user_email|winner_emails)';
// An email key anywhere in the filter's argument, conditional ones included
// (cond ? {...} : { created_by: x }), up to the end of the statement.
const ENTITY_FILTER = new RegExp(`\\b(${[...Object.keys(entities.MEMBER_COLUMN_EXTRAS), 'UserBadge', 'MorphGuideComment', 'Giveaway'].join('|')})\\.filter\\([^;)]{0,300}?\\b${EMAIL}\\s*:`, 'g');
const TABLE_FROM = new RegExp(`\\.from\\(\\s*['"\`](${Object.keys(MEMBER_HIDDEN_COLUMNS).join('|')})['"\`]\\s*\\)`, 'g');
const BAD_IN_CHAIN = [
  /\.select\(\s*\)/,
  /\.select\(\s*['"`]\*['"`]/,
  new RegExp(`\\.select\\([^)]*['"\`][^'"\`]*\\b${EMAIL}\\b`),
  new RegExp(`\\.(eq|neq|in|is|not|ilike|like|filter|order)\\(\\s*['"\`]${EMAIL}['"\`]`),
  new RegExp(`\\.match\\(\\s*\\{[^}]*\\b${EMAIL}\\s*:`),
  new RegExp(`\\.or\\(\\s*['"\`][^'"\`]*\\b${EMAIL}\\.`),
];

/** Every place in the app that reads an email column on these tables. */
function emailReads() {
  const found = [];
  for (const path of sourceFiles(join(ROOT, 'src'))) {
    const file = relative(ROOT, path);
    const text = readFileSync(path, 'utf8');
    for (const m of text.matchAll(ENTITY_FILTER)) found.push([file, m[0]]);
    for (const m of text.matchAll(TABLE_FROM)) {
      const rest = text.slice(m.index + m[0].length);
      const ends = [rest.indexOf(';'), rest.indexOf('.from(')].filter((i) => i >= 0);
      const chain = m[0] + rest.slice(0, ends.length ? Math.min(...ends) : 400);
      if (BAD_IN_CHAIN.some((re) => re.test(chain))) found.push([file, chain.replace(/\s+/g, ' ').slice(0, 160)]);
    }
  }
  return found;
}

describe('no page reads another member\'s email on these tables', () => {
  const isAllowed = ([file, snippet], [allowedFile, start]) =>
    file === allowedFile && snippet.replace(/\s+/g, ' ').startsWith(start);

  it('finds no select *, email column or email filter outside the stated fallbacks', () => {
    const unexpected = emailReads().filter((read) => !ALLOWED.some((allowed) => isAllowed(read, allowed)));
    expect(unexpected).toEqual([]);
  });

  it('lists only fallbacks that still exist (so the scan is really reading the pages)', () => {
    const found = emailReads();
    for (const allowed of ALLOWED) expect(found.some((read) => isAllowed(read, allowed))).toBe(true);
  });

  it('still recognises the reads it is guarding against', () => {
    const sample = "const a = supabase.from('gecko_images').select('*').eq('verified', true);\n"
      + "const b = GeckoImage.filter({ created_by: me.email });\n"
      + "const c = GeckoImage.filter(id ? { owner_profile_id: id } : { created_by: me.email });\n";
    const chains = [...sample.matchAll(TABLE_FROM)].map((m) => sample.slice(m.index, sample.indexOf(';', m.index)));
    expect(chains.some((c) => BAD_IN_CHAIN.some((re) => re.test(c)))).toBe(true);
    expect([...sample.matchAll(ENTITY_FILTER)]).toHaveLength(2);
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GECKO_PUBLIC_COLUMNS,
  GECKO_IMAGE_PUBLIC_COLUMNS,
  FORUM_POST_PUBLIC_COLUMNS,
  FORUM_COMMENT_PUBLIC_COLUMNS,
  FORUM_LIKE_PUBLIC_COLUMNS,
  FORUM_CATEGORY_PUBLIC_COLUMNS,
  CARE_GUIDE_SECTION_PUBLIC_COLUMNS,
  MORPH_GUIDE_PUBLIC_COLUMNS,
  PAGE_CONFIG_PUBLIC_COLUMNS,
  GECKO_OF_THE_DAY_COLUMNS,
  BREEDER_STORE_PAGE_PUBLIC_COLUMNS,
  BREEDING_PLAN_PUBLIC_COLUMNS,
  WEIGHT_RECORD_PUBLIC_COLUMNS,
  FEEDING_RECORD_PUBLIC_COLUMNS,
  SHED_RECORD_PUBLIC_COLUMNS,
  VET_RECORD_PUBLIC_COLUMNS,
  OWNERSHIP_RECORD_PUBLIC_COLUMNS,
  NO_ANON_READ_TABLES,
  PUBLIC_READ_COLUMNS,
  EVERYONE_READ_COLUMNS,
  geckoSelect,
  nameWithoutEmail,
  publicDisplayName,
} from '../publicColumns';

const getSession = vi.fn();
vi.mock('@/lib/supabaseClient', () => ({
  supabase: { auth: { getSession: (...args) => getSession(...args) } },
}));

const { readColumns, TABLE_MAP } = await import('@/api/supabaseEntities');

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const migration = (name) => readFileSync(
  resolve(__dirname, '../../../supabase/migrations', name),
  'utf8',
);
const GECKO_MIGRATION = migration('20261008081011_anon_hide_owner_email_columns.sql');
const MORE_MIGRATION = migration('20261008081043_anon_hide_email_columns_more.sql');
const WEIGHT_MIGRATION = migration('20261003004122_passport_transfers_lineage.sql');
const WELCOME_MIGRATION = migration('20261003022738_owner_profile_id_forum_store_welcome.sql');

/** The column list of the `grant select (...) on public.<table> to <role>` in a migration. */
function grantedColumns(sql, table, role = 'anon') {
  const match = sql.match(new RegExp(`grant select \\(([^)]*)\\)\\s+on public\\.${table} to ${role};`));
  if (!match) throw new Error(`no ${role} grant for ${table}`);
  return match[1].split(',').map((c) => c.trim()).filter(Boolean);
}

/** Columns that hold an email address somewhere in these tables. */
const EMAIL_COLUMNS = ['created_by', 'owner_email', 'user_email', 'uploader_email'];

// Table name -> the signed-out list the client reads it with.
const LISTS_BY_TABLE = {
  forum_posts: FORUM_POST_PUBLIC_COLUMNS,
  forum_comments: FORUM_COMMENT_PUBLIC_COLUMNS,
  forum_likes: FORUM_LIKE_PUBLIC_COLUMNS,
  forum_categories: FORUM_CATEGORY_PUBLIC_COLUMNS,
  care_guide_sections: CARE_GUIDE_SECTION_PUBLIC_COLUMNS,
  morph_guides: MORPH_GUIDE_PUBLIC_COLUMNS,
  page_config: PAGE_CONFIG_PUBLIC_COLUMNS,
  gecko_of_the_day: GECKO_OF_THE_DAY_COLUMNS,
  breeder_store_pages: BREEDER_STORE_PAGE_PUBLIC_COLUMNS,
  breeding_plans: BREEDING_PLAN_PUBLIC_COLUMNS,
  feeding_records: FEEDING_RECORD_PUBLIC_COLUMNS,
  shed_records: SHED_RECORD_PUBLIC_COLUMNS,
  vet_records: VET_RECORD_PUBLIC_COLUMNS,
  ownership_records: OWNERSHIP_RECORD_PUBLIC_COLUMNS,
};

describe('columns a signed-out visitor may read', () => {
  it('never include an owner email', () => {
    expect(GECKO_PUBLIC_COLUMNS).not.toContain('created_by');
    expect(GECKO_IMAGE_PUBLIC_COLUMNS).not.toContain('created_by');
    expect(GECKO_IMAGE_PUBLIC_COLUMNS).not.toContain('user_id');
    expect(GECKO_IMAGE_PUBLIC_COLUMNS).not.toContain('image_embedding');
    // The reviewer's email sits inside training_meta.
    expect(GECKO_IMAGE_PUBLIC_COLUMNS).not.toContain('training_meta');
  });

  it('carry the owner profile id so pages can show a display name', () => {
    expect(GECKO_PUBLIC_COLUMNS).toContain('owner_profile_id');
    expect(GECKO_IMAGE_PUBLIC_COLUMNS).toContain('owner_profile_id');
  });

  it('match the anon column grants in the database migration exactly', () => {
    expect(grantedColumns(GECKO_MIGRATION, 'geckos')).toEqual(GECKO_PUBLIC_COLUMNS);
    expect(grantedColumns(GECKO_MIGRATION, 'gecko_images')).toEqual(GECKO_IMAGE_PUBLIC_COLUMNS);
  });

  it('geckoSelect reads everything only when signed in', () => {
    expect(geckoSelect(true)).toBe('*');
    expect(geckoSelect(false)).toBe(GECKO_PUBLIC_COLUMNS.join(','));
  });
});

describe('the other tables signed-out pages read', () => {
  it.each(Object.entries(LISTS_BY_TABLE))('%s: client list matches the anon grant exactly', (table, list) => {
    expect(grantedColumns(MORE_MIGRATION, table)).toEqual(list);
  });

  it.each(Object.entries(LISTS_BY_TABLE))('%s: no email column in the list', (table, list) => {
    for (const col of EMAIL_COLUMNS) expect(list).not.toContain(col);
  });

  it('every table the migration narrows has a client list', () => {
    const narrowed = [...MORE_MIGRATION.matchAll(/on public\.(\w+) to anon;/g)].map((m) => m[1]);
    expect([...new Set(narrowed)].sort()).toEqual(Object.keys(LISTS_BY_TABLE).sort());
  });

  it('weigh-ins match the anon grant from the passport migration', () => {
    expect(grantedColumns(WEIGHT_MIGRATION, 'weight_records')).toEqual(WEIGHT_RECORD_PUBLIC_COLUMNS);
  });

  it('forum rows and store pages say who owns them by profile id', () => {
    expect(FORUM_POST_PUBLIC_COLUMNS).toContain('owner_profile_id');
    expect(FORUM_COMMENT_PUBLIC_COLUMNS).toContain('owner_profile_id');
    expect(BREEDER_STORE_PAGE_PUBLIC_COLUMNS).toContain('owner_profile_id');
  });

  it('every entity list belongs to a table the migrations grant', () => {
    const covered = new Set([...Object.keys(LISTS_BY_TABLE), 'geckos', 'gecko_images', 'weight_records']);
    for (const entity of Object.keys(PUBLIC_READ_COLUMNS)) {
      expect(covered.has(TABLE_MAP[entity])).toBe(true);
    }
    for (const [table, list] of Object.entries(LISTS_BY_TABLE)) {
      const entity = Object.keys(TABLE_MAP).find((e) => TABLE_MAP[e] === table);
      expect(PUBLIC_READ_COLUMNS[entity]).toBe(list.join(','));
    }
  });

  it('tables signed-out visitors lose entirely are revoked and have no public list', () => {
    for (const table of NO_ANON_READ_TABLES) {
      expect(MORE_MIGRATION).toContain(`revoke select on public.${table} from anon;`);
      const entity = Object.keys(TABLE_MAP).find((e) => TABLE_MAP[e] === table);
      expect(PUBLIC_READ_COLUMNS[entity]).toBeUndefined();
    }
  });
});

describe('signed-in members', () => {
  it('Gecko of the Day is read with the same list for everyone, matching the member grant', () => {
    expect(EVERYONE_READ_COLUMNS.GeckoOfTheDay).toBe(GECKO_OF_THE_DAY_COLUMNS.join(','));
    expect(grantedColumns(MORE_MIGRATION, 'gecko_of_the_day', 'authenticated')).toEqual(GECKO_OF_THE_DAY_COLUMNS);
  });

  it('question and answer grants leave out created_by', () => {
    expect(grantedColumns(MORE_MIGRATION, 'questions', 'authenticated')).not.toContain('created_by');
    expect(grantedColumns(MORE_MIGRATION, 'answers', 'authenticated')).not.toContain('created_by');
  });
});

describe('welcome_shelf never hands out an email', () => {
  const body = (sql) => sql.slice(sql.indexOf('create or replace function public.welcome_shelf'));

  it('the applied version drops the email key for signed-out callers and never builds a name from it', () => {
    const fn = body(WELCOME_MIGRATION);
    expect(fn).toContain("to_jsonb(rows) - 'email'");
    expect(fn).not.toMatch(/split_part\(p\.email/);
  });

  it('the pending version does not select the email at all', () => {
    expect(body(MORE_MIGRATION)).not.toMatch(/p\.email/);
  });
});

describe('display names', () => {
  it('never fall back to an email address', () => {
    expect(nameWithoutEmail('keeper@example.com')).toBe('Geck Inspect keeper');
    expect(nameWithoutEmail('', 'Geck Inspect member')).toBe('Geck Inspect member');
    expect(nameWithoutEmail('Lilly White Co')).toBe('Lilly White Co');
    expect(publicDisplayName({ email: 'a@b.co' })).toBe('Geck Inspect keeper');
    expect(publicDisplayName({ full_name: '', business_name: 'Harlequin House' })).toBe('Harlequin House');
    expect(publicDisplayName(null, 'A keeper')).toBe('A keeper');
  });
});

describe('entity reads pick columns by sign-in state', () => {
  beforeEach(() => getSession.mockReset());

  it('uses the public columns when signed out', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    expect(await readColumns('Gecko')).toBe(GECKO_PUBLIC_COLUMNS.join(','));
    expect(await readColumns('GeckoImage')).toBe(GECKO_IMAGE_PUBLIC_COLUMNS.join(','));
    expect(await readColumns('ForumPost')).toBe(FORUM_POST_PUBLIC_COLUMNS.join(','));
    expect(await readColumns('PageConfig')).toBe(PAGE_CONFIG_PUBLIC_COLUMNS.join(','));
    expect(await readColumns('ShedRecord')).toBe(SHED_RECORD_PUBLIC_COLUMNS.join(','));
    expect(await readColumns('WeightRecord')).toBe(WEIGHT_RECORD_PUBLIC_COLUMNS.join(','));
  });

  it('reads every column when signed in', async () => {
    getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    expect(await readColumns('Gecko')).toBe('*');
    expect(await readColumns('GeckoImage')).toBe('*');
    expect(await readColumns('ForumPost')).toBe('*');
  });

  it('reads the Gecko of the Day list for everyone without checking the session', async () => {
    expect(await readColumns('GeckoOfTheDay')).toBe(GECKO_OF_THE_DAY_COLUMNS.join(','));
    expect(getSession).not.toHaveBeenCalled();
  });

  it('leaves other tables alone without checking the session', async () => {
    expect(await readColumns('Egg')).toBe('*');
    expect(getSession).not.toHaveBeenCalled();
  });
});
